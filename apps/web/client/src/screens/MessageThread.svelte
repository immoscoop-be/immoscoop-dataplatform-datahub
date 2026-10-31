<script lang="ts" module>
  import type { MessageKind } from '@datahub/contracts/messages';
  import type { IconName } from '@datahub/ui/foundations/icons.js';

  /** The kinds of Message, by their names: never translated (NFR-LOC-01). */
  export const KIND_NAMES: Record<MessageKind, string> = {
    question: 'Question',
    remark: 'Remark',
    signal: 'Signal',
    request: 'Request',
    reply: 'Reply',
    decision: 'Decision',
    notice: 'Notice',
    dataHub: 'Data Hub',
  };

  /** How a writer stands to the object, by its name: Owner, Data Team. */
  export const STANDING_NAMES = { owner: 'Owner', dataTeam: 'Data Team' } as const;

  /** The states a Message shows, with their icons: open, answered; waiting, accepted, refused; broken, works again. */
  export const STATE_ICONS: Record<string, IconName> = {
    open: 'circle',
    answered: 'check-circle',
    waiting: 'hourglass-medium',
    accepted: 'check-circle',
    refused: 'x-circle',
    broken: 'warning-circle-fill',
    worksAgain: 'check-circle',
  };
</script>

<script lang="ts">
  import { formatBytes } from '@datahub/ui/foundations/bytes.js';
  import Icon from '@datahub/ui/foundations/Icon.svelte';
  import { currentLanguage, t } from '@datahub/ui/foundations/texts.svelte.js';
  import { ago } from '@datahub/ui/foundations/when.js';
  import Avatar from '@datahub/ui/primitives/Avatar.svelte';
  import { initialsOf } from '../lib/initials.js';
  import { cardOfType, type Conversation, messageText, STATE_TEXTS, SUBJECT_TITLES } from '../lib/messages.js';
  import MessageComposer from './MessageComposer.svelte';
  import LearningInline from './LearningInline.svelte';
  import MessageText from './MessageText.svelte';

  /**
   * A Message with its replies (Message): who wrote it and when, its kind and its state, the words of whoever
   * wrote it, or what Data Hub tells in the texts of the Message Catalogue (FR-CV-15); for a Request what it
   * asks to decide on; under it the replies, the decision on a Request among them. "Reply" opens a field
   * under it, where a list of Messages offers it.
   */
  let {
    message,
    onreply,
    notify = '',
  }: {
    message: Conversation;
    /** Offers "Reply" under a Question, Remark or Signal; true when the reply was posted. */
    onreply?: (text: string) => Promise<boolean>;
    /** Who a reply notifies, under its field. */
    notify?: string;
  } = $props();

  const language = $derived(currentLanguage());
  const person = $derived(message.writer !== null);
  const rich = $derived(person ? null : messageText(message, language, 'rich'));
  /** What Data Hub writes carries the card that explains it (FR-LR-38). */
  const learningCard = $derived(person ? null : cardOfType(message.type));
  const isRequest = $derived(message.kind === 'request');
  const repliable = $derived(onreply !== undefined && ['question', 'remark', 'signal'].includes(message.kind));
  let replying = $state(false);

  const name = (writer: Conversation['writer']) => writer?.name ?? 'Data Hub';
  const reads = $derived(Number(message.params.reads ?? 0));
  const threshold = $derived(Number(message.params.threshold ?? 0));
</script>

<article class="thread">
  <Avatar initials={message.writer ? initialsOf(message.writer.name) : 'DH'} />
  <div class="body">
    <div class="head">
      <span class="kind {message.kind}">{KIND_NAMES[message.kind]}</span>
      {#if message.state && STATE_ICONS[message.state] && STATE_TEXTS[message.state]}<span class="state"><Icon name={STATE_ICONS[message.state]!} />{t(STATE_TEXTS[message.state]!)}</span>{/if}
      <span class="who">{name(message.writer)}</span>
      {#if message.writer?.as}<span class="meta">{STANDING_NAMES[message.writer.as]}</span>{/if}
      <span class="meta">{ago(message.createdAt, language)}</span>
    </div>
    {#if person && message.params.text}
      <p class="words">{message.params.text}</p>
    {:else if rich}
      <div class="rich"><MessageText text={rich} /></div>
    {/if}
    {#if !person && learningCard}<LearningInline number={learningCard} />{/if}
    {#if isRequest && reads > 0}
      <dl class="facts">
        <div><dt>{t('messages.facts.reads')}</dt><dd><b>{formatBytes(reads, language)}</b></dd></div>
        {#if threshold > 0}<div><dt>{t('messages.facts.range')}</dt><dd class="urgent">{t('messages.facts.veryLarge', { threshold: formatBytes(threshold, language) })}</dd></div>{/if}
        {#if message.params.partitions}<div><dt>{t('messages.facts.partitions')}</dt><dd>{message.params.partitions}</dd></div>{/if}
      </dl>
    {/if}
    {#each message.replies as reply (reply.id)}
      <div class="reply">
        <Avatar size="mini" initials={reply.writer ? initialsOf(reply.writer.name) : 'DH'} />
        <div class="reply-body">
          <div class="head">
            <span class="who small">{name(reply.writer)}</span>
            <span class="meta">{#if reply.writer?.as}{STANDING_NAMES[reply.writer.as]} · {/if}{ago(reply.createdAt, language)}</span>
            {#if reply.kind === 'decision' && reply.params.outcome && STATE_TEXTS[reply.params.outcome]}<span class="state"><Icon name={STATE_ICONS[reply.params.outcome] ?? 'check-circle'} />{t(STATE_TEXTS[reply.params.outcome]!)}</span>{/if}
          </div>
          {#if reply.params.text}<p class="words">{reply.params.text}</p>{/if}
        </div>
      </div>
    {/each}
    {#if repliable && !replying}
      <div class="actions"><button type="button" class="link" onclick={() => (replying = true)}><Icon name="arrow-bend-up-left-fill" />{t('messages.reply')}</button></div>
    {:else if repliable && onreply}
      <div class="inline">
        <MessageComposer
          placeholder={t('messages.replyPlaceholder', { kind: SUBJECT_TITLES[message.subject.kind] })}
          {notify}
          button={t('messages.reply')}
          icon="arrow-bend-up-left-fill"
          autofocus
          oncancel={() => (replying = false)}
          onsend={async (text) => {
            const posted = await onreply(text);
            if (posted) replying = false;
            return posted;
          }}
        />
      </div>
    {/if}
  </div>
</article>

<style>
  .thread { display: flex; gap: 12px; padding: 16px 4px; border-top: 1px solid var(--tint-active); }
  .thread :global(.avatar) { flex: none; background: var(--tint-active); color: var(--text-primary); }
  .thread:first-child { border-top: 0; }
  .body { flex: 1; min-width: 0; }
  .head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .kind { font-size: 10px; font-weight: var(--weight-medium); padding: 2px 8px; border-radius: var(--radius-pill); background: var(--tint-hover); color: var(--text-secondary); }
  .kind.signal { color: var(--signal-warn); background: color-mix(in srgb, var(--signal-warn) 13%, var(--surface-solid)); }
  .kind.request { color: var(--text-primary); background: var(--tint-active); }
  .state { display: inline-flex; align-items: center; gap: 4px; font-size: var(--text-meta); color: var(--text-muted); }
  .who { font-size: var(--text-small); font-weight: var(--weight-medium); }
  .who.small { font-size: var(--text-meta); }
  .meta { font-size: var(--text-meta); color: var(--text-muted); }
  .words { margin: 6px 0 0; font-size: var(--text-small); line-height: 1.55; white-space: pre-line; overflow-wrap: anywhere; }
  .rich { margin-top: 6px; }
  .facts { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 10px; margin: 10px 0 0; padding: 12px 14px; border-radius: var(--radius-md); background: var(--surface-sub); }
  .facts div { display: flex; flex-direction: column; gap: 2px; font-size: var(--text-small); }
  .facts dt { font-size: var(--text-meta); color: var(--text-muted); }
  .facts dd { margin: 0; }
  .facts b { font-weight: var(--weight-medium); }
  .urgent { color: var(--signal-urgent); font-weight: var(--weight-medium); }
  .reply { display: flex; gap: 10px; margin-top: 12px; padding-left: 12px; border-left: 2px solid var(--tint-active); }
  .reply-body { min-width: 0; flex: 1; }
  .actions { display: flex; gap: 14px; margin-top: 10px; }
  .link { all: unset; display: inline-flex; align-items: center; gap: 5px; font-size: var(--text-meta); color: var(--text-secondary); cursor: pointer; }
  .link:hover { color: var(--text-primary); }
  .link:focus-visible { outline: 2px solid var(--text-secondary); border-radius: var(--radius-sm); }
  .inline { margin-top: 10px; }
</style>
