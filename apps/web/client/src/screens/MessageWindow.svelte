<script lang="ts">
  import FloatingWindow from '@datahub/ui/containers/FloatingWindow.svelte';
  import Icon from '@datahub/ui/foundations/Icon.svelte';
  import { t } from '@datahub/ui/foundations/texts.svelte.js';
  import { type Conversation, type MessagesClient, SUBJECT_TITLES } from '../lib/messages.js';
  import { messagePath, messagesOnPath } from '../lib/routes.js';
  import MessageOpened from './MessageOpened.svelte';
  import { KIND_NAMES } from './MessageThread.svelte';

  /**
   * A Message opened in context (DEC-UX-30, FR-CV-09): the page of its object stays usable behind a floating
   * window in the lower right, which holds the Message with its replies and what it asks: a reply, or for a
   * Request the decision of the Data Team. At its foot all the Messages on the object, in the slide-in, and
   * the way back to the Message Centre; Close goes back there too.
   */
  let {
    id,
    message,
    count,
    client,
    dataTeam,
    decideLens,
    onchanged,
    onclose,
  }: {
    id: string;
    /** The Message: undefined while it comes, null when it could not be read. */
    message: Conversation | null | undefined;
    /** How many Messages are on its object, for the way to all of them; null where it has no slide-in. */
    count: number | null;
    client: MessagesClient;
    dataTeam: boolean;
    decideLens: (lensId: string, outcome: 'accepted' | 'refused', text: string) => Promise<void>;
    onchanged: (message: Conversation) => void;
    onclose: () => void;
  } = $props();

  const kindName = $derived(message ? SUBJECT_TITLES[message.subject.kind] : '');
</script>

<FloatingWindow
  title={message?.subject.name ?? '…'}
  meta={message ? t('messages.window.meta', { message: message.kind === 'dataHub' ? 'Message' : KIND_NAMES[message.kind], kind: kindName }) : undefined}
  wide={message?.kind === 'request'}
  {onclose}
>
  {#if message}
    {#key message.id}
      <MessageOpened {message} {client} {dataTeam} {decideLens} {onchanged} />
    {/key}
  {:else if message === null}
    <p class="meta" role="alert">{t('messages.failed.read')}</p>
  {:else}
    <p class="meta">…</p>
  {/if}
  {#snippet foot()}
    {#if message && count !== null && message.kind !== 'request'}
      <a class="link" href={messagesOnPath(message.subject)}><Icon name="chat-circle-text-fill" />{t('messages.window.all', { count, kind: kindName })}</a>
    {/if}
    <a class="link end" href={message ? messagePath(message.id) : messagePath(id)}>{t('messages.toCentre')}<Icon name="arrow-right" /></a>
  {/snippet}
</FloatingWindow>

<style>
  .link { display: inline-flex; align-items: center; gap: 5px; font-size: var(--text-meta); color: var(--text-primary); text-decoration: none; }
  .link:hover { text-decoration: underline; }
  .end { margin-left: auto; }
  .meta { margin: 10px 0; }
</style>
