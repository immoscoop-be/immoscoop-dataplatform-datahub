<script lang="ts">
  import { NO_PASSWORD_MANAGER } from '@datahub/ui/foundations/fields.js';
  import Icon from '@datahub/ui/foundations/Icon.svelte';
  import { currentLanguage, t } from '@datahub/ui/foundations/texts.svelte.js';
  import Button from '@datahub/ui/primitives/Button.svelte';
  import { buttonsOf, type Conversation, SUBJECT_TITLES } from '../lib/messages.js';

  /**
   * The decision of the Data Team on a Request that waits (FR-CV-08): a reason, which Refuse needs, who hears it, and
   * Refuse and Accept with the labels of the Message Catalogue (FR-CV-13). Where a Request is opened, and on a Resource
   * in its Messages, for a Request about a description from dbt (FR-CV-17).
   */
  let {
    message,
    note,
    ondecide,
    box = $bindable(),
  }: {
    message: Conversation;
    /** Who hears the decision, and what it does. */
    note: string;
    /** Records the decision; throws when it could not be saved. */
    ondecide: (outcome: 'accepted' | 'refused', reason: string) => Promise<void>;
    /** Its element, for the quick window, which puts the focus on its buttons (DEC-UX-239). */
    box?: HTMLElement;
  } = $props();

  const language = $derived(currentLanguage());
  const kindName = $derived(SUBJECT_TITLES[message.subject.kind]);
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
      await ondecide(outcome, reason.trim());
      reason = '';
    } catch (error) {
      console.error('The decision could not be saved', error);
      problem = t('messages.decision.failed');
    } finally {
      busy = false;
    }
  }
</script>

<div class="decision" bind:this={box}>
  <label class="label" for="reason-{message.id}">{t('messages.decision')}</label>
  <textarea {...NO_PASSWORD_MANAGER}
    id="reason-{message.id}"
    rows="2"
    maxlength="1000"
    bind:value={reason}
    placeholder={message.writer
      ? t('messages.decision.placeholder', { writer: message.writer.name, kind: kindName })
      : t('messages.decision.placeholder.dataHub', { kind: kindName })}
  ></textarea>
  <p class="meta note" role={problem ? 'alert' : undefined}>{#if problem}{problem}{:else}<Icon name="bell-simple-fill" />{note}{/if}</p>
  <div class="buttons">
    <Button variant="outline" disabled={busy} onclick={() => decide('refused')}><Icon name="x" />{label('Refuse')}</Button>
    <Button disabled={busy} onclick={() => decide('accepted')}><Icon name="check-fill" />{label('Accept')}</Button>
  </div>
</div>

<style>
  .decision { border-radius: var(--radius-lg); padding: 14px 16px; background: var(--surface-sub); margin-top: 6px; }
  .label { display: block; margin-bottom: 8px; font-size: var(--text-meta); font-weight: var(--weight-medium); color: var(--text-secondary); }
  textarea { width: 100%; box-sizing: border-box; font: var(--text-small) var(--font-family); line-height: 1.5; color: var(--text-primary); background: var(--surface-solid);
    border: 1px solid var(--tint-active); border-radius: var(--radius-field); padding: 8px 10px; resize: vertical; }
  textarea:focus { outline: 2px solid var(--text-secondary); outline-offset: 1px; }
  .note { margin: 8px 0 0; display: flex; align-items: center; gap: 5px; line-height: 1.4; }
  .buttons { display: flex; justify-content: flex-end; gap: 10px; margin-top: 10px; }
</style>
