<script lang="ts">
  import Sheet from '@datahub/ui/containers/Sheet.svelte';
  import Icon from '@datahub/ui/foundations/Icon.svelte';
  import { t } from '@datahub/ui/foundations/texts.svelte.js';
  import Segmented from '@datahub/ui/primitives/Segmented.svelte';
  import { type Conversation, type MessagesClient, SUBJECT_TITLES, WRITTEN_ON, type WrittenKind, type WrittenOn } from '../lib/messages.js';
  import MessageComposer from './MessageComposer.svelte';
  import MessageThread, { KIND_NAMES } from './MessageThread.svelte';

  /**
   * The Messages on a Collection, a Resource or a Lens, in a slide-in over its page (DEC-UX-29, FR-CV-07): on
   * top a new Message, its kind and who gets a notification; chips by kind; the Messages with their replies;
   * at the bottom that everyone who may see the object sees them, and the way to the Message Centre. It is
   * the Message Centre filtered on the object (DEC-CV-02): what a person writes on it.
   */
  let {
    subject,
    meta,
    owner,
    messages,
    client,
    onchanged,
    onclose,
  }: {
    subject: { kind: WrittenOn; id: string; name: string };
    /** Under its name, such as its kind and its Collection. */
    meta: string;
    /** The name of its Owner Unit, who gets a notification; null when it has none. */
    owner: string | null;
    /** What a person wrote on it: undefined while it is read. */
    messages: readonly Conversation[] | undefined;
    client: MessagesClient;
    /** After a Message or a reply, the page reads its Messages again. */
    onchanged: () => void;
    onclose: () => void;
  } = $props();

  const kinds = $derived(WRITTEN_ON[subject.kind]);
  const PLACEHOLDERS: Record<WrittenKind, string> = { question: 'messages.placeholder.question', remark: 'messages.placeholder.remark', signal: 'messages.placeholder.signal' };
  const kindName = $derived(SUBJECT_TITLES[subject.kind]);
  let kind = $state<WrittenKind>('question');
  type Chip = 'all' | WrittenKind;
  let chip = $state<Chip>('all');
  const shown = $derived((messages ?? []).filter((message) => chip === 'all' || message.kind === chip));
  const count = (of: Chip) => (messages ?? []).filter((message) => of === 'all' || message.kind === of).length;

  /** Who a new Message notifies (FR-CV-03): a Signal also the Data Team. */
  const notify = $derived(
    kind === 'signal'
      ? owner
        ? t('messages.notify.ownerAndTeam', { owner })
        : t('messages.notify.team')
      : owner
        ? t('messages.notify.owner', { owner, kind: kindName })
        : t('messages.notify.team'),
  );
</script>

<Sheet title={subject.name} {onclose}>
  {#snippet top()}<p class="meta over">{t('messages.sheet.title', { kind: kindName })}</p>{/snippet}
  {#snippet head()}<p class="meta">{meta}</p>{/snippet}
  <MessageComposer
    label={t('messages.new')}
    kinds={kinds.map((value) => ({ value, label: KIND_NAMES[value] }))}
    bind:kind
    placeholder={t(PLACEHOLDERS[kind], { kind: kindName })}
    {notify}
    button={t('messages.post')}
    onsend={async (text) => {
      try {
        await client.write(subject, kind, text);
        onchanged();
        return true;
      } catch (error) {
        console.error('The Message could not be posted', error);
        return false;
      }
    }}
  />
  <div class="chips">
    <Segmented
      options={(['all', ...kinds] as Chip[]).map((value) => ({ value, label: `${value === 'all' ? t('messages.all') : `${KIND_NAMES[value]}s`} ${count(value)}` }))}
      bind:value={chip}
      label={t('messages.kind')}
    />
  </div>
  <div class="list">
    {#if messages === undefined}
      <p class="meta">…</p>
    {:else if shown.length === 0}
      <p class="meta none">{t('messages.sheet.none', { kind: kindName })}</p>
    {:else}
      {#each shown as message (message.id)}
        <MessageThread
          {message}
          notify={message.mine ? t('messages.notify.replyOwn') : t('messages.notify.reply', { writer: message.writer?.name ?? 'Data Hub' })}
          onreply={async (text) => {
            try {
              await client.reply(message.id, text);
              onchanged();
              return true;
            } catch (error) {
              console.error('The reply could not be posted', error);
              return false;
            }
          }}
        />
      {/each}
    {/if}
  </div>
  {#snippet foot()}
    <p class="meta note">{t('messages.sheet.foot', { kind: kindName })}</p>
    <a class="link" href="/messages">{t('messages.toCentre')}<Icon name="arrow-right" /></a>
  {/snippet}
</Sheet>

<style>
  .over { display: block; margin: 0 0 2px; }
  .chips { margin-top: 14px; }
  .list { margin: 6px -4px 0; }
  .none { padding: 12px 4px; }
  .note { flex: 1; margin: 0; }
  .link { display: inline-flex; align-items: center; gap: 5px; font-size: var(--text-small); color: var(--text-primary); text-decoration: none; }
  .link:hover { text-decoration: underline; }
</style>
