import type { Slack, SlackMessage } from './notifications.js';

const API = 'https://slack.com/api';

/** The bot token of the Slack app of Data Hub, or null while its secret has no value (DEC-LN-05). */
export type SlackToken = () => Promise<string | null>;

/** Slack did not do what was asked; tried again later. */
export class SlackError extends Error {}

/**
 * Direct messages from the Slack app of Data Hub (DEC-LN-05, DEC-LN-06): it finds the User by the e-mail
 * address of their Google account, opens the direct message with them and posts the Message there, never in
 * a channel. A User who is not in Slack gets e-mail alone.
 */
export function createSlack(token: SlackToken, request: typeof fetch = fetch): Slack {
  async function call(method: string, token: string, body: Record<string, unknown>, form = false): Promise<Record<string, unknown>> {
    const response = await request(`${API}/${method}`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': form ? 'application/x-www-form-urlencoded' : 'application/json; charset=utf-8',
      },
      body: form ? new URLSearchParams(body as Record<string, string>).toString() : JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new SlackError(`Slack answered ${response.status} to ${method}`);
    return (await response.json()) as Record<string, unknown>;
  }

  return {
    async send(email: string, message: SlackMessage) {
      const bot = await token();
      if (!bot) return 'off';
      // users.lookupByEmail reads its arguments from a form, not from JSON.
      const found = await call('users.lookupByEmail', bot, { email }, true);
      if (found.ok !== true) {
        if (found.error === 'users_not_found') return 'absent';
        throw new SlackError(`Slack did not find a user: ${String(found.error)}`);
      }
      const user = (found.user as { id?: string } | undefined)?.id;
      const opened = await call('conversations.open', bot, { users: user });
      const channel = (opened.channel as { id?: string } | undefined)?.id;
      if (opened.ok !== true || !channel) throw new SlackError(`Slack opened no direct message: ${String(opened.error)}`);
      const posted = await call('chat.postMessage', bot, { channel, text: message.text, blocks: message.blocks, unfurl_links: false, unfurl_media: false });
      if (posted.ok !== true) throw new SlackError(`Slack did not post the message: ${String(posted.error)}`);
      return 'sent';
    },
  };
}

/**
 * The bot token from Secret Manager, read when it is first needed and again every ten minutes, so that a
 * token added later is used without a deploy (TR-PF-23). While the secret has no value, Slack is off and
 * Data Hub notifies by e-mail alone; any other failure to read it is tried again with the notification.
 */
export function slackTokenFrom(read: () => Promise<string>, onMissing: (error: unknown) => void, now: () => number = Date.now): SlackToken {
  let kept: { token: string | null; until: number } | undefined;
  return async () => {
    if (kept && kept.until > now()) return kept.token;
    let token: string | null;
    try {
      token = (await read()).trim() || null;
    } catch (error) {
      // No version yet (404), or none enabled (400 FAILED_PRECONDITION): the value is still to be added.
      if (!(error instanceof Error && /: (404|400)\b/.test(error.message))) throw error;
      onMissing(error);
      token = null;
    }
    kept = { token, until: now() + 10 * 60 * 1000 };
    return token;
  };
}
