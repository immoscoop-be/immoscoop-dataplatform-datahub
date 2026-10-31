<script lang="ts">
  import { type Background, type Theme, WIND_LAYERS } from './backgrounds.js';
  import { startFlow, type Flow } from './flow.js';
  import { motion } from './motion.svelte.js';
  import { startWind, type Wind } from './wind.js';

  /**
   * The background of Data Hub, behind everything (Layers and focus): the gradient of the theme, a
   * picture, or the flowing gradient and lights. It moves very slowly, felt rather than seen, and
   * stands still when the system asks to reduce motion (Background and motion). In a photo with wind,
   * a canvas over it draws mist drifting over its sky and fine snow blowing over its ground, in gusts
   * that come at random (DEC-UX-153).
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

  // The wind in a photo, drawn live over it; without a canvas the photo stays, still (DEC-UX-153).
  let weather: HTMLCanvasElement | undefined = $state();
  let wind: Wind | undefined;
  $effect(() => {
    const view = background.wind;
    if (!view || !weather) {
      return;
    }
    const started = startWind(weather, WIND_LAYERS, () => view, () => motion.reduced);
    wind = started;
    return () => {
      started?.stop();
      wind = undefined;
    };
  });
  $effect(() => {
    void motion.reduced;
    wind?.redraw();
  });
</script>

{#if flowing}
  <canvas class="flow" bind:this={canvas} aria-hidden="true"></canvas>
  <div class="grain" aria-hidden="true"></div>
{:else if background.kind === 'picture' && background.picture && background.wind}
  <div class="wind-fill" style:--picture={`url("${background.picture}")`} aria-hidden="true"></div>
  <div
    class="wind"
    style:--picture={`url("${background.picture}")`}
    style:--ratio={background.wind.ratio}
    style:--span={background.wind.span}
    style:--focus={background.wind.focus}
    aria-hidden="true"
  >
    <canvas class="weather" bind:this={weather}></canvas>
  </div>
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
  /* A photo with wind (DEC-UX-153): the window shows its span whole, in the middle, its sides fading into
     a blur of the photo itself; a narrower window is covered. The canvas of the wind lies over
     it in its own measures, so that the mist stays in its sky and the snow on its ground. */
  .wind-fill { position: fixed; inset: -60px; z-index: -2; background: var(--picture) 0 0 / 100% 100% no-repeat var(--bg-1); filter: blur(40px) saturate(.9); }
  .wind { --tall: min(100vh / var(--span), max(100vh, 100vw / var(--ratio))); position: fixed; z-index: -2; overflow: hidden;
    width: calc(var(--tall) * var(--ratio)); height: var(--tall);
    left: calc((100vw - var(--tall) * var(--ratio)) / 2); top: calc((100vh - var(--tall)) * var(--focus));
    background: var(--picture) 0 0 / 100% 100% no-repeat;
    mask-image: linear-gradient(to right, transparent, black 9%, black 91%, transparent); }
  .weather { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
  /* A still grain over the flowing ones */
  .grain { z-index: -1; pointer-events: none; opacity: .32; mix-blend-mode: soft-light;
    background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>"); }
</style>
