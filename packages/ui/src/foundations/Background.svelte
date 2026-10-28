<script lang="ts">
  import type { Background, Theme } from './backgrounds.js';
  import { startFlow, type Flow } from './flow.js';
  import { motion } from './motion.svelte.js';

  /**
   * The background of Data Hub, behind everything (Layers and focus): the gradient of the theme, a
   * picture, or the flowing gradient and lights. It moves very slowly, felt rather than seen, and
   * stands still when the system asks to reduce motion (Background and motion).
   */
  let { background, theme }: { background: Background; theme: Theme } = $props();

  let canvas: HTMLCanvasElement | undefined = $state();
  /** Without WebGL, the gradient of the theme stays (DEC-UX-80). */
  let noWebGL = $state(false);
  let flow: Flow | undefined;

  const flowing = $derived((background.kind === 'flow' || background.kind === 'lights') && !noWebGL);

  $effect(() => {
    if (!flowing || !canvas) {
      return;
    }
    const started = startFlow(canvas, () => ({ id: background.id, theme }), () => motion.reduced);
    if (!started) {
      noWebGL = true;
      return;
    }
    flow = started;
    return () => {
      started.stop();
      flow = undefined;
    };
  });

  // A change of theme or background, or of reduced motion, draws again at once.
  $effect(() => {
    void [background.id, theme, motion.reduced];
    flow?.redraw();
  });
</script>

{#if flowing}
  <canvas class="flow" bind:this={canvas} aria-hidden="true"></canvas>
  <div class="grain" aria-hidden="true"></div>
{:else if background.kind === 'picture' && background.picture}
  <div class="layer picture" class:cover={background.cover} style:--picture={`url("${background.picture}")`} aria-hidden="true"></div>
{:else}
  <div class="layer gradient" aria-hidden="true"></div>
{/if}

<style>
  .layer, .flow, .grain { position: fixed; inset: 0; width: 100%; height: 100%; }
  .layer, .flow { z-index: -2; }
  .flow { display: block; }
  /* In light, soft clouds of colour on white (DEC-UX-78); in dark, a slow three-colour gradient. Both drift */
  .gradient { background: var(--app-bg); background-size: var(--app-bg-size); animation: drift var(--background-cycle) ease-in-out infinite alternate; }
  @keyframes drift { 0% { background-position: 0% 20%; } 50% { background-position: 60% 80%; } 100% { background-position: 100% 40%; } }
  /* A picture in place of the gradient (DEC-UX-34), drifting as slowly; a photo shown as it is covers the window */
  .picture { background: 50% 30% / 112% auto no-repeat var(--bg-1); background-image: var(--picture); animation: picture-drift var(--background-cycle) ease-in-out infinite alternate; }
  .picture.cover { background-size: cover; }
  @keyframes picture-drift { 0% { background-position: 40% 25%; } 100% { background-position: 60% 35%; } }
  /* A still grain over the flowing ones */
  .grain { z-index: -1; pointer-events: none; opacity: .32; mix-blend-mode: soft-light;
    background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>"); }
</style>
