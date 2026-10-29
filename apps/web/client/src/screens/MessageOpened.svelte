<script lang="ts">
  import Icon from '@datahub/ui/foundations/Icon.svelte';
  import { currentLanguage, t } from '@datahub/ui/foundations/texts.svelte.js';
  import Button from '@datahub/ui/primitives/Button.svelte';
  import { buttonsOf, type Conversation, type MessagesClient, SUBJECT_TITLES } from '../lib/messages.js';
  import MessageComposer from './MessageComposer.svelte';
  import MessageThread from './MessageThread.svelte';

  /**
   * A Message opened, in the Message Centre or in context (FR-CV-09): the Message with its replies, and what
   * it asks of the User. A Question, Remark or Signal takes a reply; a Request that waits takes the decision
   * of the Data Team, Refuse needing a reason, while its author sees that it waits (FR-CV-08, Request decision).
   */
  let {
    message,
    client,
    dataTeam,
    decideLens,
    onchanged,
  }: {
    message: Conversation;
    client: MessagesClient;
    dataTeam: boolean;
    /** Decides on a Request on a Lens, in query, which changes the Lens with it (FR-LE-09). */
    decideLens: (lensId: string, outcome: 'accepted' | 'refused', text: string) => Promise<void>;
    /** The Message as it is after a reply or a decision. */
    onchanged: (message: Conversation) => void;
  } = $props();

  const language = $derived(currentLanguage());
  const kindName = $derived(SUBJECT_TITLES[message.subject.kind]);
  const repliable = $derived(['question', 'remark', 'signal'].includes(message.kind));
  const waiting = $derived(message.kind === 'request' && message.state === 'waiting');
  /** The labels of Accept and Refuse, from the Message Catalogue (FR-CV-13). */
  const label = (english: string) => buttonsOf(message.type).find((button) => button.label.en === english)?.label[language] ?? english;

  let reason = $state('');
  let busy = $state(false);
  let problem = $state('');

  async function decide(outcome: 'accepted' | 'refused'): Promise<void> {
    if (outcome === 'refused' && !reason.trim()) {
      problem = t('messages.decision.needReason');
      return;
    }
    busy = true;
    problem = '';
    try {
      if (message.subject.kind === 'lens') {
        await decideLens(message.subject.id, outcome, reason.trim());
        onchanged(await client.conversation(message.id));
      } else {
        onchanged(await client.decide(message.id, outcome, reason.trim()));
      }
      reason = '';
    } catch (error) {
      console.error('The decision could not be saved', error);
      problem = t('messages.decision.failed');
    } finally {
      busy = false;
    }
  }

  const decisionNote = $derived(
    message.subject.kind === 'query'
      ? t('messages.decision.query', { writer: message.writer?.name ?? '' })
      : message.writer
        ? t('messages.decision.lens', { writer: message.writer.name })
        : t('messages.decision.stopped'),
  );
</script>

<MessageThread {message} />
{#if repliable}
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
{:else if waiting && dataTeam}
  <div class="decision">
    <label class="label" for="reason-{message.id}">{t('messages.decision')}</label>
    <textarea
      id="reason-{message.id}"
      rows="2"
      maxlength="1000"
      bind:value={reason}
      placeholder={message.writer
        ? t('messages.decision.placeholder', { writer: message.writer.name, kind: kindName })
        : t('messages.decision.placeholder.dataHub', { kind: kindName })}
    ></textarea>
    <p class="meta note" role={problem ? 'alert' : undefined}>{#if problem}{problem}{:else}<Icon name="bell-simple-fill" />{decisionNote}{/if}</p>
    <div class="buttons">
      <Button variant="outline" disabled={busy} onclick={() => decide('refused')}><Icon name="x" />{label('Refuse')}</Button>
      <Button disabled={busy} onclick={() => decide('accepted')}><Icon name="check-fill" />{label('Accept')}</Button>
    </div>
  </div>
{:else if waiting && message.mine}
  <p class="waiting"><Icon name="hourglass-medium-fill" /><span><b>{t('messages.waiting')}</b> {t('messages.waiting.text')}</span></p>
{/if}

<style>
  .decision { border-radius: var(--radius-lg); padding: 14px 16px; background: var(--surface-sub); margin-top: 6px; }
  .label { display: block; margin-bottom: 8px; font-size: var(--text-meta); font-weight: var(--weight-medium); color: var(--text-secondary); }
  textarea { width: 100%; box-sizing: border-box; font: var(--text-small) var(--font-family); line-height: 1.5; color: var(--text-primary); background: var(--surface-solid);
    border: 1px solid var(--tint-active); border-radius: var(--radius-field); padding: 8px 10px; resize: vertical; }
  textarea:focus { outline: 2px solid var(--text-secondary); outline-offset: 1px; }
  .note { margin: 8px 0 0; display: flex; align-items: center; gap: 5px; line-height: 1.4; }
  .buttons { display: flex; justify-content: flex-end; gap: 10px; margin-top: 10px; }
  .waiting { display: flex; gap: 10px; align-items: flex-start; margin: 6px 0 0; padding: 10px 12px; border-radius: var(--radius-md); background: var(--surface-sub); font-size: var(--text-small); line-height: 1.5; }
  .waiting :global(.icon) { font-size: 18px; color: var(--text-secondary); flex: none; }
  b { font-weight: var(--weight-medium); }
</style>
