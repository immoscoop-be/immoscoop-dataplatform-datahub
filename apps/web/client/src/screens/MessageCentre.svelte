<script lang="ts">
  import KindIcon from '@datahub/ui/marks/KindIcon.svelte';
  import Icon from '@datahub/ui/foundations/Icon.svelte';
  import type { IconName } from '@datahub/ui/foundations/icons.js';
  import { currentLanguage, t } from '@datahub/ui/foundations/texts.svelte.js';
  import { ago } from '@datahub/ui/foundations/when.js';
  import Button from '@datahub/ui/primitives/Button.svelte';
  import Segmented from '@datahub/ui/primitives/Segmented.svelte';
  import {
    CONTEXT_BUTTON,
    type Conversation,
    type Counts,
    type Filter,
    isAnswered,
    isOpen,
    type Message,
    type MessagesClient,
    messageText,
    STATE_TEXTS,
    SUBJECT_TITLES,
    VIEW_TEXTS,
  } from '../lib/messages.js';
  import { contextPath, messagePath } from '../lib/routes.js';
  import MessageOpened from './MessageOpened.svelte';
  import { KIND_NAMES, STATE_ICONS } from './MessageThread.svelte';

  /**
   * The Message Centre (FR-CV-06, DEC-UX-29): the view chosen in the panel, its Messages newest first, each
   * with its object, kind, state, who and when and its first lines, a dot when it is unread; chips for all,
   * open and answered. The Message opened shows on the right with its replies and "Open in context"
   * (FR-CV-09), and what it asks of the User: a reply, or for the Data Team the decision on a Request.
   */
  let {
    filter,
    found,
    opened,
    client,
    dataTeam,
    decideLens,
    onchanged,
  }: {
    filter: Filter;
    /** The Messages of the view and its counts: undefined while they come, null when they could not be read. */
    found: { messages: Message[]; counts: Counts } | null | undefined;
    /** The Message opened: undefined while it comes or when none is, null when it could not be read. */
    opened: { id: string; message?: Conversation | null } | undefined;
    client: MessagesClient;
    dataTeam: boolean;
    decideLens: (lensId: string, outcome: 'accepted' | 'refused', text: string) => Promise<void>;
    /** After a reply or a decision: the Message as it is now. */
    onchanged: (message: Conversation) => void;
  } = $props();

  const language = $derived(currentLanguage());
  let chip = $state<'all' | 'open' | 'answered'>('all');
  const messages = $derived(found?.messages ?? []);
  const shown = $derived(messages.filter((message) => chip === 'all' || (chip === 'open' ? isOpen(message) : isAnswered(message))));
  /** Nothing unread at all, not just nothing that matches a filter (DEC-UX-136). */
  const caughtUp = $derived(filter.view === 'unread' && !filter.kind && !filter.on && !filter.search && chip === 'all');
  const about = $derived(filter.view === 'forYou' && dataTeam ? t('messages.about.forYou.dataTeam') : t(VIEW_TEXTS[filter.view].about));

  /** The icon of the kind of an object, as the panel shows it. */
  const SUBJECT_ICONS: Record<string, IconName> = { collection: 'stack', query: 'terminal-window', report: 'file-text', learningCard: 'graduation-cap-fill' };

  /** Its first lines: the words of whoever wrote it, or the first line of what Data Hub tells (FR-CV-15). */
  function excerpt(message: Message): string {
    if (message.writer && message.kind !== 'request') return message.params.text ?? '';
    return messageText(message, language, 'plain') ?? '';
  }

  /** "Open in context", which every Message has, with its label from the Message Catalogue (FR-CV-09, FR-CV-13). */
  function opener(message: Conversation): { label: string; href: string } {
    const context = CONTEXT_BUTTON;
    return { label: context?.label[language] ?? message.subject.name, href: contextPath(message.subject, message.id) };
  }
</script>

<div class="crumb meta">{t('section.messages')}</div>
<h1 class="page-title">{t(VIEW_TEXTS[filter.view].name)}</h1>
<p class="meta about">{about}</p>

<div class="centre">
  <section class="card list" aria-label={t('section.messages')}>
    <div class="chips">
      <Segmented
        options={[
          { value: 'all' as const, label: `${t('messages.all')} ${messages.length}` },
          { value: 'open' as const, label: `${t('messages.open')} ${messages.filter(isOpen).length}` },
          { value: 'answered' as const, label: `${t('messages.answered')} ${messages.filter(isAnswered).length}` },
        ]}
        bind:value={chip}
        label={t('messages.kind')}
      />
    </div>
    {#if found === null}
      <p class="meta empty" role="alert">{t('messages.failed')}</p>
    {:else if found === undefined}
      <p class="meta empty">…</p>
    {:else if shown.length === 0}
      <p class="meta empty">{t(caughtUp ? 'messages.caughtUp' : 'messages.none')}</p>
    {:else}
      {#each shown as message (message.id)}
        <a class="item" class:on={opened?.id === message.id} class:unread={message.unread} href={messagePath(message.id)} aria-current={opened?.id === message.id ? 'true' : undefined}>
          <span class="dot" role={message.unread ? 'img' : undefined} aria-label={message.unread ? t('messages.unread') : undefined}></span>
          <span class="main">
            <span class="row subject">
              {#if message.subject.kind === 'resource' || message.subject.kind === 'lens'}<KindIcon kind={message.subject.kind} />{:else}<Icon name={SUBJECT_ICONS[message.subject.kind] ?? 'stack'} />{/if}
              <span class="kindname">{SUBJECT_TITLES[message.subject.kind]}</span>
              <b>{message.subject.name}</b>
              {#if message.subject.collection}<span class="meta">· {message.subject.collection.name}</span>{/if}
            </span>
            <span class="row">
              <span class="kind {message.kind}">{KIND_NAMES[message.kind]}</span>
              {#if message.state && STATE_ICONS[message.state] && STATE_TEXTS[message.state]}<span class="state"><Icon name={STATE_ICONS[message.state]!} />{t(STATE_TEXTS[message.state]!)}</span>{/if}
              <span class="who">{message.mine ? t('messages.you') : (message.writer?.name ?? 'Data Hub')}</span>
              <span class="meta when">{ago(message.lastAt, language)}</span>
            </span>
            <span class="excerpt">{excerpt(message)}</span>
            {#if message.replyCount > 0}<span class="row meta replies" aria-label={t('messages.replies', { count: message.replyCount })}><Icon name="chat-circle" />{message.replyCount}</span>{/if}
          </span>
        </a>
      {/each}
    {/if}
  </section>

  <section class="card detail" aria-label={opened?.message?.subject.name ?? t('section.messages')}>
    {#if opened?.message}
      {@const message = opened.message}
      {@const open = opener(message)}
      <div class="head">
        {#if message.subject.kind === 'resource' || message.subject.kind === 'lens'}<span class="big"><KindIcon kind={message.subject.kind} /></span>{:else}<span class="big"><Icon name={SUBJECT_ICONS[message.subject.kind] ?? 'stack'} /></span>{/if}
        <div class="titles">
          <div class="meta">{SUBJECT_TITLES[message.subject.kind]}{#if message.subject.collection}{` · ${message.subject.collection.name}`}{/if}</div>
          <div class="title">{message.subject.name}</div>
        </div>
        {#if message.subject.exists}<Button variant="outline" href={open.href} title={t('messages.contextHint')}><Icon name="arrow-square-out" />{open.label}</Button>{/if}
      </div>
      {#if !message.subject.exists}<p class="meta gone">{t('messages.gone', { kind: SUBJECT_TITLES[message.subject.kind] })}</p>{/if}
      {#key message.id}
        <MessageOpened {message} {client} {dataTeam} {decideLens} {onchanged} />
      {/key}
    {:else if opened?.message === null}
      <p class="meta empty" role="alert">{t('messages.failed.read')}</p>
    {:else if opened}
      <p class="meta empty">…</p>
    {:else}
      <p class="meta empty">{t('messages.pick')}</p>
    {/if}
  </section>
</div>

<style>
  .crumb { margin-top: 8px; }
  .about { display: block; margin: 4px 0 0; line-height: 1.5; max-width: 760px; }
  .centre { display: grid; grid-template-columns: minmax(300px, 400px) minmax(0, 1fr); gap: 14px; margin-top: 14px; align-items: start; }
  .card { border-radius: var(--radius-xl); background: var(--surface-solid); }
  .list { padding: 12px 8px 8px; }
  .chips { margin: 0 4px 8px; }
  .empty { padding: 12px; margin: 0; }
  .item { display: grid; grid-template-columns: 8px minmax(0, 1fr); gap: 10px; padding: 12px 12px 12px 8px; border-radius: var(--radius-md); color: var(--text-primary); text-decoration: none; }
  .item:hover { background: var(--tint-hover); }
  .item.on { background: var(--surface-sub); }
  .item:focus-visible { outline: 2px solid var(--text-secondary); }
  .dot { width: 8px; height: 8px; margin-top: 5px; border-radius: 50%; }
  .unread .dot { background: var(--text-primary); }
  .main { min-width: 0; display: flex; flex-direction: column; gap: 6px; }
  .row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: var(--text-small); }
  .subject { gap: 6px; font-size: var(--text-meta); color: var(--text-secondary); }
  .subject b { font-weight: var(--weight-medium); color: var(--text-primary); }
  .subject :global(.icon) { font-size: 14px; }
  .kindname { color: var(--text-muted); }
  .kind { font-size: 10px; font-weight: var(--weight-medium); padding: 2px 8px; border-radius: var(--radius-pill); background: var(--tint-hover); color: var(--text-secondary); }
  .kind.signal { color: var(--signal-warn); background: color-mix(in srgb, var(--signal-warn) 13%, var(--surface-solid)); }
  .kind.request { color: var(--text-primary); background: var(--tint-active); }
  .state { display: inline-flex; align-items: center; gap: 4px; font-size: var(--text-meta); color: var(--text-muted); }
  .who { font-weight: var(--weight-medium); }
  .when { margin-left: auto; }
  .excerpt { display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; font-size: var(--text-small); line-height: 1.5; color: var(--text-secondary); }
  .unread .excerpt { color: var(--text-primary); }
  .replies { gap: 4px; }
  .detail { padding: 18px 20px 20px; }
  .head { display: flex; align-items: center; gap: 12px; padding-bottom: 12px; border-bottom: 1px solid var(--tint-active); }
  .big { display: inline-flex; font-size: 22px; color: var(--text-secondary); }
  .titles { flex: 1; min-width: 0; }
  .title { font-size: var(--text-section); font-weight: var(--weight-medium); }
  .gone { margin: 10px 0 0; }
  .detail :global(.composer), .detail :global(.decision) { margin-top: 6px; }
</style>
