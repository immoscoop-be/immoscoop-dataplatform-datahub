<script lang="ts">
  import Icon from '@datahub/ui/foundations/Icon.svelte';
  import { currentLanguage, t } from '@datahub/ui/foundations/texts.svelte.js';
  import Button from '@datahub/ui/primitives/Button.svelte';
  import { buttonsOf, type Conversation, type MessagesClient, SUBJECT_TITLES } from '../lib/messages.js';
  import MessageComposer from './MessageComposer.svelte';
  import MessageThread from './MessageThread.svelte';
  import RequestDecision from './RequestDecision.svelte';
  import { command, useScreenCommands } from '../lib/commands.svelte.js';
  import type { QuickRow } from '../lib/quick.js';

  /**
   * A Message opened, in the Message Centre or in context (FR-CV-09): the Message with its replies, and what
   * it asks of the User. A Question, Remark or Signal takes a reply; a Request that waits takes the decision
   * of the Data Team, from a User who may decide on Requests (`requests.decide`), Refuse needing a reason, while its
   * author sees that it waits (FR-CV-08, Request decision, FR-PL-14).
   */
  let {
    message,
    client,
    decides,
    decideLens,
    onchanged,
    ondeleted,
  }: {
    message: Conversation;
    client: MessagesClient;
    /** The User may decide on a Request (`requests.decide`). */
    decides: boolean;
    /** Decides on a Request on a Lens, in query, which changes the Lens with it (FR-LE-09). */
    decideLens: (lensId: string, outcome: 'accepted' | 'refused', text: string) => Promise<void>;
    /** The Message as it is after a reply or a decision. */
    onchanged: (message: Conversation) => void;
    /** Its conversation is deleted, for everyone (FR-CV-18). */
    ondeleted?: (id: string) => void;
  } = $props();

  const language = $derived(currentLanguage());
  const kindName = $derived(SUBJECT_TITLES[message.subject.kind]);
  /** A reply, where the User may reply (`messages.reply`, DEC-PL-04). */
  const repliable = $derived(['question', 'remark', 'signal'].includes(message.kind) && message.mayReply !== false);
  const waiting = $derived(message.kind === 'request' && message.state === 'waiting');
  /** The labels of Accept and Refuse, from the Message Catalogue (FR-CV-13). */
  const label = (english: string) => buttonsOf(message.type).find((button) => button.label.en === english)?.label[language] ?? english;

  /** The decision of the Data Team: one on a Lens in query, which changes the Lens with it (FR-LE-09). */
  async function decide(outcome: 'accepted' | 'refused', reason: string): Promise<void> {
    if (message.subject.kind === 'lens') {
      await decideLens(message.subject.id, outcome, reason);
      onchanged(await client.conversation(message.id));
    } else {
      onchanged(await client.decide(message.id, outcome, reason));
    }
  }

  const decisionNote = $derived(
    message.subject.kind === 'query'
      ? t('messages.decision.query', { writer: message.writer?.name ?? '' })
      : message.subject.kind === 'resource'
        ? t('messages.decision.resource', { writer: message.writer?.name ?? '' })
        : message.writer
          ? t('messages.decision.lens', { writer: message.writer.name })
          : t('messages.decision.stopped'),
  );

  let replyBox = $state<HTMLElement | undefined>();
  /** Its thread, which Close and Reopen in the quick window act on as their buttons do (DEC-UX-255). */
  let thread = $state<{ startClose: () => void; reopen: () => Promise<void> } | undefined>();
  const closable = $derived(message.mayClose && message.state === 'open');
  const reopenable = $derived(message.mayClose && message.state === 'closed');
  let decisionBox = $state<HTMLElement | undefined>();
  /**
   * In the quick window (DEC-UX-240): Reply puts the cursor in the reply; on a Request that waits, Accept puts the focus
   * on its button, where Enter accepts it, and Refuse on the reason it needs, so that a decision stays a press on its
   * button (DEC-UX-239).
   */
  useScreenCommands(() => {
    const rows: QuickRow[] = [];
    if (repliable) rows.push(command('message:reply', 'arrow-bend-up-left-fill', t('messages.reply'), () => replyBox?.querySelector('textarea')?.focus(), { meta: t('quick.message.reply.meta'), words: t('quick.message.reply.words') }));
    if (closable) rows.push(command('message:close', 'minus-circle', t('quick.message.close'), () => thread?.startClose(), { meta: t('quick.message.close.meta'), words: t('quick.message.close.words') }));
    if (reopenable) rows.push(command('message:close', 'arrow-counter-clockwise', t('quick.message.reopen'), () => void thread?.reopen(), { words: t('quick.message.close.words') }));
    if (waiting && decides) {
      rows.push(command('message:accept', 'check-fill', label('Accept'), () => decisionBox?.querySelector<HTMLButtonElement>('.buttons button:last-child')?.focus(), { meta: t('quick.message.accept.meta'), words: t('quick.message.decide.words') }));
      rows.push(command('message:refuse', 'x', label('Refuse'), () => decisionBox?.querySelector('textarea')?.focus(), { meta: t('quick.message.refuse.meta'), words: t('quick.message.decide.words') }));
    }
    return { group: t('quick.group.message'), rows };
  });
</script>

<MessageThread
  bind:this={thread}
  {message}
  onclose={async (text) => {
    try {
      onchanged(await client.close(message.id, text));
      return true;
    } catch (error) {
      console.error('The Message could not be closed', error);
      return false;
    }
  }}
  onreopen={async () => {
    try {
      onchanged(await client.reopen(message.id));
      return true;
    } catch (error) {
      console.error('The Message could not be reopened', error);
      return false;
    }
  }}
  onjoin={async () => {
    try {
      onchanged(await client.join(message.id));
      return true;
    } catch (error) {
      console.error('The Request could not be joined', error);
      return false;
    }
  }}
  ondelete={async (id) => {
    try {
      const gone = await client.remove(id);
      if (gone.deleted === 'conversation') ondeleted?.(message.id);
      else onchanged(await client.conversation(message.id));
      return true;
    } catch (error) {
      console.error('The Message could not be deleted', error);
      return false;
    }
  }}
/>
{#if repliable}
  <div class="reply" bind:this={replyBox}>
  <MessageComposer
    label={t('messages.yourReply')}
    placeholder={t('messages.replyPlaceholder', { kind: kindName })}
    notify={message.mine ? t('messages.notify.replyOwn') : t('messages.notify.reply', { writer: message.writer?.name ?? '' })}
    button={t('messages.reply')}
    icon="arrow-bend-up-left-fill"
    onsend={async (text) => {
      try {
        onchanged(await client.reply(message.id, text));
        return true;
      } catch (error) {
        console.error('The reply could not be posted', error);
        return false;
      }
    }}
  />
  </div>
{:else if waiting && decides}
  <RequestDecision {message} note={decisionNote} ondecide={decide} bind:box={decisionBox} />
{:else if waiting && message.mine}
  <p class="waiting"><Icon name="hourglass-medium-fill" /><span><b>{t('messages.waiting')}</b> {t('messages.waiting.text')}</span></p>
{/if}

<style>
  .reply { display: contents; }
  .waiting { display: flex; gap: 10px; align-items: flex-start; margin: 6px 0 0; padding: 10px 12px; border-radius: var(--radius-md); background: var(--surface-sub); font-size: var(--text-small); line-height: 1.5; }
  .waiting :global(.icon) { font-size: 18px; color: var(--text-secondary); flex: none; }
  b { font-weight: var(--weight-medium); }
</style>
