import { createHash, randomInt, timingSafeEqual } from 'node:crypto';
import type { Language } from '@datahub/contracts/messages';
import type { Kysely } from 'kysely';
import type { CatalogueDatabase } from './database.js';
import type { Slack, SlackMessage } from './notifications.js';

/** How long a code holds, and how many times a User may type it (OP-LN-08). */
export const CODE_MINUTES = 10;
export const CODE_TRIES = 5;

/** Who asks: their fixed Google ID and the address of their Google account. */
export interface SlackUser {
  id: string;
  email: string;
}

/** What Profile shows of Slack (FR-LN-07). */
export interface SlackState {
  /** Whether the Slack app of Data Hub is set up in this environment: without its token, there is no tile (OP-UX-78). */
  on: boolean;
  /** The address of the User's Google account. */
  google: string;
  /** The address Data Hub finds them by in Slack: a confirmed one, or the Google address. */
  address: string;
  /** When they confirmed another address; null while Data Hub uses the Google address. */
  confirmedAt: string | null;
  /** The name of the Slack account of that address; null when none has it (EC-LN-01). */
  name: string | null;
}

export type CodeSent = { name: string; expiresAt: string } | 'absent' | 'off';
export type Confirmed = { state: 'confirmed' } | { state: 'wrong'; triesLeft: number } | { state: 'expired' } | { state: 'none' };

const normal = (email: string) => email.trim().toLowerCase();

/** The direct message with the code, in the User's language; whoever did not ask can ignore it (OP-LN-08). */
export function codeMessage(code: string, language: Language): SlackMessage {
  const spaced = `${code.slice(0, 3)} ${code.slice(3)}`;
  const [lead, rest] =
    language === 'en'
      ? ['Your code for Data Hub is', 'Someone asked Data Hub to send their notifications to this Slack account. If that was not you, ignore this message.']
      : ['Je code voor Data Hub is', 'Iemand vroeg Data Hub om meldingen naar dit Slack-account te sturen. Was jij dat niet, negeer dan dit bericht.'];
  return {
    text: `${lead} ${spaced}. ${rest}`,
    blocks: [{ type: 'section', text: { type: 'mrkdwn', text: `${lead} *${spaced}*.\n${rest}` } }],
  };
}

/**
 * The address by which Data Hub finds a User in Slack (DEC-LN-08, FR-LN-07): the address of their Google account,
 * or another one they confirmed with a code of six digits sent to that Slack account, valid for 10 minutes and
 * five tries, the newest only (OP-LN-08). The code is kept as a hash, never as itself.
 */
export function createSlackAddresses(
  db: Kysely<CatalogueDatabase>,
  slack: Pick<Slack, 'find' | 'send'>,
  options: { now?: () => Date; code?: () => string } = {},
) {
  const now = options.now ?? (() => new Date());
  const newCode = options.code ?? (() => String(randomInt(0, 1_000_000)).padStart(6, '0'));
  const hash = (userId: string, code: string) => createHash('sha256').update(`${userId}:${code}`).digest();

  return {
    async state(user: SlackUser): Promise<SlackState> {
      const google = normal(user.email);
      const kept = await db.selectFrom('slackAddresses').select(['email', 'confirmedAt']).where('userId', '=', user.id).executeTakeFirst();
      const address = kept?.email ?? google;
      const found = await slack.find(address);
      if (found === 'off') return { on: false, google, address: google, confirmedAt: null, name: null };
      return { on: true, google, address, confirmedAt: kept ? kept.confirmedAt.toISOString() : null, name: found?.name ?? null };
    },

    /** Who has this address in Slack. */
    async find(email: string) {
      return slack.find(normal(email));
    },

    /** Sends a new code to the Slack account of the address; a code sent earlier no longer counts. */
    async sendCode(user: SlackUser, email: string, language: Language): Promise<CodeSent> {
      const address = normal(email);
      const found = await slack.find(address);
      if (found === 'off') return 'off';
      if (found === null) return 'absent';
      const code = newCode();
      const expiresAt = new Date(now().getTime() + CODE_MINUTES * 60_000);
      const row = { email: address, slackName: found.name, codeHash: hash(user.id, code).toString('hex'), expiresAt, triesLeft: CODE_TRIES };
      await db
        .insertInto('slackCodes')
        .values({ userId: user.id, ...row })
        .onConflict((conflict) => conflict.column('userId').doUpdateSet(row))
        .execute();
      const sent = await slack.send(address, codeMessage(code, language));
      if (sent !== 'sent') {
        await db.deleteFrom('slackCodes').where('userId', '=', user.id).execute();
        return sent;
      }
      return { name: found.name, expiresAt: expiresAt.toISOString() };
    },

    /** Takes the address once the code is right; a wrong code costs a try, and the last one ends the code. */
    async confirm(user: SlackUser, code: string): Promise<Confirmed> {
      const typed = code.replace(/\s/g, '');
      return db.transaction().execute(async (trx) => {
        const pending = await trx.selectFrom('slackCodes').selectAll().where('userId', '=', user.id).forUpdate().executeTakeFirst();
        if (!pending) return { state: 'none' };
        const end = () => trx.deleteFrom('slackCodes').where('userId', '=', user.id).execute();
        if (pending.expiresAt.getTime() <= now().getTime() || pending.triesLeft <= 0) {
          await end();
          return { state: 'expired' };
        }
        if (!/^\d{6}$/.test(typed) || !timingSafeEqual(Buffer.from(pending.codeHash, 'hex'), hash(user.id, typed))) {
          const triesLeft = pending.triesLeft - 1;
          if (triesLeft <= 0) await end();
          else await trx.updateTable('slackCodes').set({ triesLeft }).where('userId', '=', user.id).execute();
          return { state: 'wrong', triesLeft };
        }
        await end();
        // Confirming the Google address itself is going back to it: nothing to keep.
        if (pending.email === normal(user.email)) {
          await trx.deleteFrom('slackAddresses').where('userId', '=', user.id).execute();
        } else {
          const kept = { email: pending.email, confirmedAt: now() };
          await trx
            .insertInto('slackAddresses')
            .values({ userId: user.id, ...kept })
            .onConflict((conflict) => conflict.column('userId').doUpdateSet(kept))
            .execute();
        }
        return { state: 'confirmed' };
      });
    },

    /** Back to the address of the Google account. */
    async reset(user: SlackUser): Promise<void> {
      await db.deleteFrom('slackAddresses').where('userId', '=', user.id).execute();
      await db.deleteFrom('slackCodes').where('userId', '=', user.id).execute();
    },
  };
}

export type SlackAddresses = ReturnType<typeof createSlackAddresses>;
