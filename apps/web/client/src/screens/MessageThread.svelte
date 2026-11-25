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
    closing: 'Closing',
    notice: 'Notice',
    dataHub: 'Data Hub',
  };

  /** How a writer stands to the object, by its name: Owner, Data Team. */
  export const STANDING_NAMES = { owner: 'Owner', dataTeam: 'Data Team' } as const;

  /** The states a Message shows, with their icons: open, answered; waiting, accepted, refused, withdrawn; broken, works again. */
  export const STATE_ICONS: Record<string, IconName> = {
    open: 'circle',
    answered: 'check-circle',
    waiting: 'hourglass-medium',
    accepted: 'check-circle',
    refused: 'x-circle',
    broken: 'warning-circle-fill',
    worksAgain: 'check-circle',
    withdrawn: 'prohibit-fill',
    closed: 'minus-circle',
    corrected: 'check-circle',
  };
</script>

<script lang="ts">
  import { formatBytes } from '@datahub/ui/foundations/bytes.js';
  import Icon from '@datahub/ui/foundations/Icon.svelte';
  import { currentLanguage, t } from '@datahub/ui/foundations/texts.svelte.js';
  import { ago } from '@datahub/ui/foundations/when.js';
  import Avatar from '@datahub/ui/primitives/Avatar.svelte';
  import Button from '@datahub/ui/primitives/Button.svelte';
  import { initialsOf } from '../lib/initials.js';
  import { cardOfType, type Conversation, joinersOf, messageText, REPORT, STATE_TEXTS, SUBJECT_TITLES } from '../lib/messages.js';
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
    onclose,
    onreopen,
    ondelete,
    onjoin,
    notify = '',
  }: {
    message: Conversation;
    /** Offers "Reply" under a Question, Remark or Signal; true when the reply was posted. */
    onreply?: (text: string) => Promise<boolean>;
    /** Offers "Close" on an open Question or Signal to whoever may close it, with an optional line why (FR-CV-16). */
    onclose?: (text: string) => Promise<boolean>;
    /** Offers "Reopen" on a closed one to the same people. */
    onreopen?: () => Promise<boolean>;
    /**
     * Offers "Delete" on what the User may delete, the Message with its replies or a reply alone, after a confirm in
     * place that says what goes (FR-CV-18, DEC-UX-339); true when it is gone.
     */
    ondelete?: (id: string) => Promise<boolean>;
    /** Offers "Join it" on a waiting Request about a description from dbt the User did not send or join (FR-CV-17). */
    onjoin?: () => Promise<boolean>;
    /** Who a reply notifies, under its field. */
    notify?: string;
  } = $props();

  const language = $derived(currentLanguage());
  const person = $derived(message.writer !== null);
  const rich = $derived(person ? null : messageText(message, language, 'rich'));
  /** What Data Hub writes carries the card that explains it (FR-LR-38). */
  const learningCard = $derived(person ? null : cardOfType(message.type));
  const isRequest = $derived(message.kind === 'request');
  const repliable = $derived(onreply !== undefined && ['question', 'remark', 'signal'].includes(message.kind) && message.mayReply !== false);
  let replying = $state(false);
  let closing = $state(false);
  let reopening = $state(false);
  let reopenFailed = $state(false);
  const closable = $derived(message.mayClose && message.state === 'open' && onclose !== undefined);
  const reopenable = $derived(message.mayClose && message.state === 'closed' && onreopen !== undefined);

  /** Close, as its button: the field for why opens, with the cursor in it; the quick window does it too (DEC-UX-255). */
  export function startClose(): void {
    if (closable) closing = true;
  }
  /** Reopen, as its button. */
  export async function reopen(): Promise<void> {
    if (!onreopen) return;
    reopening = true;
    reopenFailed = !(await onreopen().catch(() => false));
    reopening = false;
  }

  /** The Message or reply asking to be deleted, and whether that failed. */
  let deleting = $state<string | null>(null);
  let deleteFailed = $state(false);
  let removing = $state(false);
  async function remove(id: string): Promise<void> {
    if (!ondelete) return;
    removing = true;
    deleteFailed = !(await ondelete(id).catch(() => false));
    removing = false;
    if (!deleteFailed) deleting = null;
  }

  /** A description from dbt reported as wrong (FR-CV-17): what it quotes, what is wrong, and who joined it. */
  const report = $derived(message.type === REPORT);
  const joiners = $derived(report ? joinersOf(message.params) : []);
  const joinable = $derived(report && message.mayJoin === true && onjoin !== undefined);
  let joining = $state(false);
  let joinFailed = $state(false);
  async function join(): Promise<void> {
    if (!onjoin) return;
    joining = true;
    joinFailed = !(await onjoin().catch(() => false));
    joining = false;
  }

  const name = (writer: Conversation['writer']) => writer?.name ?? 'Data Hub';
  const reads = $derived(Number(message.params.reads ?? 0));
  const threshold = $derived(Number(message.params.threshold ?? 0));
</script>

{#snippet confirm(id: string, what: string)}
  <div class="confirm" role="group" aria-label={t('messages.delete')}>
    <Icon name="warning-fill" />
    <p><b>{what}</b> {t('messages.delete.goes')}</p>
    <Button variant="outline" disabled={removing} onclick={() => (deleting = null)}>{t('collection.cancel')}</Button>
    <Button variant="danger" disabled={removing} onclick={() => remove(id)}>{t('messages.delete')}</Button>
  </div>
  {#if deleteFailed}<p class="meta failed" role="alert">{t('messages.delete.failed')}</p>{/if}
{/snippet}

<article class="thread">
  <Avatar initials={message.writer ? initialsOf(message.writer.name) : 'DH'} />
  <div class="body">
    <div class="head">
      <span class="kind {message.kind}">{KIND_NAMES[message.kind]}</span>
      {#if message.state && STATE_ICONS[message.state] && STATE_TEXTS[message.state]}<span class="state"><Icon name={STATE_ICONS[message.state]!} />{t(STATE_TEXTS[message.state]!)}</span>{/if}
      <span class="who">{name(message.writer)}</span>
      {#if message.writer?.as}<span class="meta">{STANDING_NAMES[message.writer.as]}</span>{/if}
      <span class="meta">{ago(message.createdAt, language)}</span>
      {#if closable && !closing}<span class="end"><Button variant="outline" title={t('messages.close.who')} onclick={() => (closing = true)}><Icon name="minus-circle" />{t('messages.close')}</Button></span>{/if}
      {#if reopenable}<span class="end"><Button variant="outline" disabled={reopening} onclick={reopen}><Icon name="arrow-counter-clockwise" />{t('messages.reopen')}</Button></span>{/if}
    </div>
    {#if reopenFailed}<p class="meta failed" role="alert">{t('messages.failed.close')}</p>{/if}
    {#if report}
      <p class="meta about">{message.params.field ? t('messages.report.aboutField', { field: message.params.field }) : t('messages.report.about')}</p>
      <blockquote class="quoted">{message.params.quoted}</blockquote>
      <p class="words"><b class="label">{t('messages.report.wrong')}</b>{message.params.text}</p>
      {#if message.params.should}<p class="words"><b class="label">{t('messages.report.should')}</b>{message.params.should}</p>{/if}
      {#each joiners as joiner (joiner.id)}
        <p class="joined"><Icon name="users" /><span>{t('messages.report.joined', { name: joiner.name })}{#if joiner.text}: “{joiner.text}”{/if}</span></p>
      {/each}
    {:else if person && message.params.text}
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
            {#if reply.kind === 'closing'}<span class="state"><Icon name="minus-circle" />{t('messages.state.closed')}</span>{/if}
            {#if reply.mayDelete && ondelete && deleting !== reply.id}<button type="button" class="link end" onclick={() => (deleting = reply.id)}><Icon name="trash" />{t('messages.delete')}</button>{/if}
          </div>
          {#if reply.writer === null}
            <!-- What Data Hub replies, such as a description corrected in dbt (MSG-RES-11), in the texts of the Message Catalogue. -->
            {@const said = messageText({ ...reply, subject: message.subject }, language, 'rich')}
            {#if said}<div class="rich"><MessageText text={said} /></div>{/if}
          {:else if reply.params.text}<p class="words">{reply.params.text}</p>{/if}
          {#if deleting === reply.id}{@render confirm(reply.id, t('messages.delete.reply'))}{/if}
        </div>
      </div>
    {/each}
    {#if closing && onclose}
      <div class="inline">
        <MessageComposer
          label={t('messages.close.title', { kind: KIND_NAMES[message.kind] })}
          placeholder={t('messages.close.placeholder', { kind: SUBJECT_TITLES[message.subject.kind] })}
          notify={message.mine ? t('messages.notify.closeOwn') : t('messages.notify.close', { writer: message.writer?.name ?? '' })}
          button={t('messages.close')}
          icon="minus-circle"
          optional
          autofocus
          oncancel={() => (closing = false)}
          onsend={async (text) => {
            const done = await onclose(text);
            if (done) closing = false;
            return done;
          }}
        />
      </div>
    {/if}
    {#if deleting === message.id}
      {@render confirm(message.id, message.replies.length > 0 ? t('messages.delete.conversation', { kind: KIND_NAMES[message.kind], count: message.replies.length }) : t('messages.delete.one', { kind: KIND_NAMES[message.kind] }))}
    {:else if (repliable && !replying) || (message.mayDelete && ondelete) || joinable}
      <div class="actions">
        {#if repliable && !replying}<button type="button" class="link" onclick={() => (replying = true)}><Icon name="arrow-bend-up-left-fill" />{t('messages.reply')}</button>{/if}
        {#if joinable}<button type="button" class="link" title={t('messages.join.who')} disabled={joining} onclick={join}><Icon name="users" />{t('messages.join')}</button>{/if}
        {#if message.mayDelete && ondelete}<button type="button" class="link" title={t('messages.delete.who')} onclick={() => (deleting = message.id)}><Icon name="trash" />{t('messages.delete')}</button>{/if}
      </div>
    {/if}
    {#if joinFailed}<p class="meta failed" role="alert">{t('messages.join.failed')}</p>{/if}
    {#if repliable && !replying}
      <!-- Reply sits in the actions above. -->
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
  .about { display: block; margin: 2px 0 6px; }
  .quoted { margin: 0 0 8px; padding: 2px 0 2px 10px; border-left: 2px solid var(--tint-active); color: var(--text-secondary); font-size: var(--text-small); line-height: 1.5; white-space: pre-line; }
  .label { display: block; font-size: var(--text-meta); font-weight: var(--weight-medium); color: var(--text-muted); }
  .joined { display: flex; align-items: baseline; gap: 6px; margin: 6px 0 0; font-size: var(--text-meta); color: var(--text-secondary); line-height: 1.5; }
  .joined :global(.icon) { flex: none; }
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
  .end { margin-left: auto; }
  .failed { margin: 6px 0 0; color: var(--signal-urgent); }
  .confirm { display: flex; align-items: center; gap: 10px; margin-top: 10px; padding: 8px 10px; border-radius: var(--radius-md); background: var(--surface-sub); font-size: var(--text-small); line-height: 1.5; }
  .confirm > :global(svg) { flex: none; color: var(--signal-urgent); font-size: 18px; }
  .confirm p { flex: 1; margin: 0; color: var(--text-secondary); }
  .confirm b { color: var(--text-primary); font-weight: var(--weight-medium); }
</style>
