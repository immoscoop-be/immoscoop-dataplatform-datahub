<script lang="ts" module>
  import type { IconName } from '../foundations/icons.js';

  /** One step of a flow, as a Flow Box shows it (DEC-UX-299). */
  export interface FlowStep {
    id: string;
    name: string;
    /** Done: what it holds; open: what it misses. */
    said: string;
    done: boolean;
    /** Its number on its card, counted in the progress; left out for the step that ends the flow, which shows `icon`. */
    number?: number;
    icon?: IconName;
    /** While open, what it misses asks for action: the warning colour. */
    warn?: boolean;
    what: string;
    why: string;
    how: string;
    /** Its Learning Card. */
    card?: { number: string; title: string };
    /** The way to where it is done; without it, the step only explains. */
    go?: string;
    /** Its place is open on the page now. */
    here?: boolean;
  }
</script>

<script lang="ts">
  import type { Snippet } from 'svelte';
  import Icon from '../foundations/Icon.svelte';
  import { t } from '../foundations/texts.svelte.js';

  /**
   * A Flow Box (DEC-UX-299): a frame of its own, docked on the right of the main area, that takes a User through the
   * steps of one flow. It is purely a guide (DEC-UX-303): each step, done or open, folds open on What, Why and How,
   * its Learning Card and one way to where it is done; the step to do now is outlined and open. Minimize folds it to a
   * strip on the right edge with its progress; the strip opens it again (DEC-UX-301). It keeps nothing of its own: it
   * shows the steps it is given, from the first still open (DEC-UX-306).
   */
  let {
    title,
    object,
    steps,
    now,
    progress,
    foot,
    minimized = false,
    ended,
    onstep,
    oncard,
    onobject,
    onminimize,
    onclose,
  }: {
    title: string;
    /** What the flow is about, a link back to it. */
    object: { label: string; icon?: IconName };
    steps: readonly FlowStep[];
    /** The step to do now: outlined, and open until another is. */
    now: string | undefined;
    /** How far the flow is, in words, such as "4 of 7 steps required to publish done". */
    progress: string;
    foot?: string;
    minimized?: boolean;
    /** Once the flow is through: said once, in place of its steps. */
    ended?: Snippet;
    onstep: (step: FlowStep) => void;
    oncard?: (card: string) => void;
    onobject: () => void;
    onminimize: (minimized: boolean) => void;
    onclose: () => void;
  } = $props();

  // A step opened by hand stays open until the step to do now moves on, which then opens.
  let opened: { id: string | null; for: string | undefined } | undefined = $state();
  const unfolded = $derived(opened && opened.for === now ? opened.id : (now ?? null));
  const toggle = (id: string) => (opened = { id: unfolded === id ? null : id, for: now });

  const counted = $derived(steps.filter((step) => step.number !== undefined));
  const done = $derived(counted.filter((step) => step.done).length);
</script>

{#if minimized}
  <aside class="strip" aria-label={`${title} · ${object.label} · ${progress}`}>
    <button type="button" class="button" aria-label={t('flowbox.maximize')} title={t('flowbox.maximize')} onclick={() => onminimize(false)}><Icon name="arrows-out-simple" /></button>
    <span class="mark" aria-hidden="true"><Icon name="signpost-fill" /></span>
    <span class="count" aria-hidden="true"><b>{done}</b>/{counted.length}</span>
    <ol class="dots" aria-hidden="true">
      {#each counted as step (step.id)}<li class:done={step.done} class:now={step.id === now}></li>{/each}
    </ol>
    <button type="button" class="vertical" onclick={() => onminimize(false)}>{title} · {object.label}</button>
  </aside>
{:else}
  <aside class="box" aria-label={`${title} · ${object.label}`}>
    <div class="inner">
      <div class="head">
        <span class="mark" aria-hidden="true"><Icon name="signpost-fill" /></span>
        <div class="titles">
          <b class="title">{title}</b>
          <button type="button" class="object" onclick={onobject}>{#if object.icon}<Icon name={object.icon} />{/if}<span>{object.label}</span></button>
        </div>
        <button type="button" class="button" aria-label={t('flowbox.minimize')} title={t('flowbox.minimize')} onclick={() => onminimize(true)}><Icon name="arrows-in-simple" /></button>
        <button type="button" class="button" aria-label={t('flowbox.close')} title={t('flowbox.close')} onclick={onclose}><Icon name="x" /></button>
      </div>
      <div class="progress">
        <div class="bar" aria-hidden="true">
          {#each counted as step (step.id)}<span class:done={step.done} class:now={step.id === now}></span>{/each}
        </div>
        <span class="meta">{progress}</span>
      </div>
      <div class="scroll">
        {#if ended}
          <div class="ended">{@render ended()}</div>
        {:else}
          <ol class="steps">
            {#each steps as step (step.id)}
              {@const open = unfolded === step.id}
              <li class="step" class:done={step.done} class:now={step.id === now} class:open>
                <button type="button" class="row" aria-expanded={open} aria-controls={`flow-step-${step.id}`} onclick={() => toggle(step.id)}>
                  {#if step.done}
                    <span class="tick"><Icon name="check-circle-fill" /></span>
                  {:else if step.number !== undefined}
                    <span class="num" aria-hidden="true">{step.number}</span>
                  {:else}
                    <span class="num end" aria-hidden="true"><Icon name={step.icon ?? 'check'} /></span>
                  {/if}
                  <span class="name">
                    <b>{step.name}</b>
                    <span class="said">{#if !step.done && step.warn}<Icon name="warning-circle-fill" />{/if}<span>{step.said}</span></span>
                  </span>
                  <span class="sr-only">, {t(step.done ? 'flowbox.done' : 'flowbox.open')}</span>
                  <span class="chev" aria-hidden="true"><Icon name="caret-down" /></span>
                </button>
                <div class="detail" id={`flow-step-${step.id}`} hidden={!open}>
                  {#if step.here}<span class="here"><Icon name="map-pin-fill" />{t('flowbox.here')}</span>{/if}
                  <dl class="wwh">
                    <dt>{t('flowbox.what')}</dt><dd>{step.what}</dd>
                    <dt>{t('flowbox.why')}</dt><dd>{step.why}</dd>
                    <dt>{t('flowbox.how')}</dt><dd>{step.how}</dd>
                  </dl>
                  {#if step.card}
                    {@const card = step.card}
                    <button type="button" class="card" onclick={() => oncard?.(card.number)}><Icon name="graduation-cap-fill" /><span class="number">{card.number}</span><span class="card-title">{card.title}</span><Icon name="arrow-up-right" /></button>
                  {/if}
                  {#if step.go}
                    <button type="button" class="go" class:primary={step.id === now} onclick={() => onstep(step)}>{step.go}<Icon name="arrow-right" /></button>
                  {/if}
                </div>
              </li>
            {/each}
          </ol>
        {/if}
      </div>
      {#if foot && !ended}<p class="foot">{foot}</p>{/if}
    </div>
  </aside>
{/if}

<style>
  .box, .strip { flex-shrink: 0; background: var(--surface-glass); border-radius: var(--radius-xl); }
  .box { --card: var(--surface-soft); width: var(--flow-box-width); display: flex; overflow: hidden; }
  .box:hover, .box:focus-within { --card: var(--surface-solid); }
  .inner { flex: 1; min-width: 0; display: flex; flex-direction: column; transition: opacity var(--motion-focus) var(--delay-focus); }
  @media (hover: hover) { .box:not(:hover):not(:focus-within) .inner { opacity: var(--opacity-out-of-focus); } }
  .head { display: flex; align-items: center; gap: 8px; padding: 16px 10px 12px 16px; }
  .mark { width: 30px; height: 30px; flex: none; border-radius: var(--radius-pill); background: var(--card); display: inline-flex; align-items: center; justify-content: center; font-size: 16px; color: var(--text-primary); }
  .titles { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
  .title { font-size: var(--text-section); font-weight: var(--weight-medium); }
  .object { all: unset; display: inline-flex; align-items: center; gap: 4px; min-width: 0; font-size: var(--text-meta); color: var(--text-secondary); cursor: pointer; }
  .object span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .object:hover span { text-decoration: underline; text-underline-offset: 3px; }
  .object:focus-visible { outline: 2px solid var(--text-secondary); outline-offset: 2px; }
  .button { width: 30px; height: 30px; flex: none; display: inline-flex; align-items: center; justify-content: center; border: 0; border-radius: var(--radius-sm); background: none; color: var(--text-secondary); cursor: pointer; font-size: 15px; }
  .button:hover { background: var(--surface-float-hover); }
  .button:focus-visible { outline: 2px solid var(--text-secondary); }
  .progress { display: grid; gap: 6px; padding: 0 16px 12px; }
  .bar { display: grid; grid-auto-flow: column; grid-auto-columns: 1fr; gap: 3px; }
  .bar span { height: 5px; border-radius: var(--radius-mark); background: var(--tint-active); }
  .bar span.done { background: var(--text-primary); }
  .bar span.now:not(.done) { background: var(--text-muted); }
  .meta { font-size: var(--text-meta); color: var(--text-muted); }
  .scroll { flex: 1; min-height: 0; overflow: auto; padding: 0 10px 6px; }
  .steps { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
  .step { border-radius: var(--radius-md); background: var(--card); transition: background-color var(--motion-focus) var(--delay-focus); }
  .step.now { outline: 1.5px solid var(--text-primary); outline-offset: -1.5px; }
  .row { all: unset; box-sizing: border-box; width: 100%; display: flex; align-items: flex-start; gap: 10px; padding: 10px 12px; border-radius: var(--radius-md); cursor: pointer; }
  .row:focus-visible { outline: 2px solid var(--text-secondary); }
  .tick { flex: none; margin-top: 1px; font-size: 18px; color: var(--text-secondary); display: inline-flex; }
  .num { flex: none; width: 18px; height: 18px; margin-top: 1px; border-radius: var(--radius-pill); outline: 1.5px solid var(--text-muted); outline-offset: -1.5px; display: inline-flex; align-items: center; justify-content: center; font-size: 10px; font-weight: var(--weight-medium); color: var(--text-secondary); }
  .num.end { font-size: 11px; }
  .step.now .num { background: var(--text-primary); outline-color: var(--text-primary); color: var(--surface-solid); }
  .name { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .name b { font-size: var(--text-small); font-weight: var(--weight-medium); }
  .step.done .name b { color: var(--text-secondary); }
  .said { display: flex; align-items: baseline; gap: 5px; font-size: var(--text-meta); line-height: 1.45; color: var(--text-muted); }
  .said :global(.icon) { flex: none; position: relative; top: 1px; font-size: 12px; color: var(--signal-warn); }
  .chev { margin-top: 3px; color: var(--text-muted); display: inline-flex; transition: transform var(--motion-fade); }
  .step.open .chev { transform: rotate(180deg); }
  .detail { display: grid; gap: 12px; padding: 4px 18px 18px 40px; }
  .detail[hidden] { display: none; }
  .here { display: inline-flex; align-items: center; gap: 5px; font-size: var(--text-meta); color: var(--text-secondary); }
  /* The labels take the room their longest needs, "Waarom" too, and keep apart from their texts. */
  .wwh { display: grid; grid-template-columns: max-content minmax(0, 1fr); gap: 10px 16px; margin: 0; font-size: var(--text-small); line-height: 1.5; }
  .wwh dt { padding-top: 2px; font-size: var(--text-meta); color: var(--text-muted); }
  .wwh dd { margin: 0; color: var(--text-primary); }
  .card { all: unset; box-sizing: border-box; display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-radius: var(--radius-sm); background: var(--surface-sub); font-size: var(--text-small); cursor: pointer; }
  .card:hover { outline: 1px solid var(--tint-active); }
  .card:focus-visible { outline: 2px solid var(--text-secondary); }
  .number { font-size: var(--text-meta); color: var(--text-muted); font-variant-numeric: tabular-nums; }
  .card-title { flex: 1; min-width: 0; }
  .go { justify-self: start; display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px; border: 0; border-radius: var(--radius-pill); background: var(--card); outline: 1px solid var(--tint-active); font: var(--weight-medium) var(--text-small) var(--font-family); color: var(--text-primary); cursor: pointer; }
  .go.primary { background: var(--text-primary); color: var(--surface-solid); outline: 0; }
  .go:focus-visible { outline: 2px solid var(--text-secondary); outline-offset: 2px; }
  .foot { margin: 0; padding: 10px 16px 16px; font-size: var(--text-meta); line-height: 1.5; color: var(--text-muted); }
  .ended { padding: 24px 16px; text-align: center; }
  .strip { width: var(--flow-strip-width); display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 12px 0; }
  .count { font-size: var(--text-meta); color: var(--text-muted); }
  .count b { font-size: var(--text-small); font-weight: var(--weight-medium); color: var(--text-primary); }
  .dots { display: grid; gap: 6px; margin: 0; padding: 0; list-style: none; }
  .dots li { width: 8px; height: 8px; border-radius: var(--radius-pill); outline: 1.5px solid var(--text-muted); outline-offset: -1.5px; }
  .dots li.done { background: var(--text-primary); outline-color: var(--text-primary); }
  .dots li.now:not(.done) { outline: 2px solid var(--text-primary); outline-offset: 1px; }
  .vertical { all: unset; flex: 1; margin-top: 4px; writing-mode: vertical-rl; white-space: nowrap; font-size: var(--text-meta); color: var(--text-secondary); cursor: pointer; }
  .vertical:hover { color: var(--text-primary); }
  .vertical:focus-visible { outline: 2px solid var(--text-secondary); }
  .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
</style>
