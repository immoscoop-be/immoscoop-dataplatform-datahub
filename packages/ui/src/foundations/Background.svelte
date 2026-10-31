<script lang="ts">
  import { type Background, type Theme, WIND_LAYERS } from './backgrounds.js';
  import { startFlow, type Flow } from './flow.js';
  import { motion } from './motion.svelte.js';

  /**
   * The background of Data Hub, behind everything (Layers and focus): the gradient of the theme, a
   * picture, or the flowing gradient and lights. It moves very slowly, felt rather than seen, and
   * stands still when the system asks to reduce motion (Background and motion). In a photo with wind,
   * mist drifts over its sky and fine snow blows over its ground, in gusts (DEC-UX-153).
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
{:else if background.kind === 'picture' && background.picture && background.wind}
  <div class="wind-fill" style:--picture={`url("${background.picture}")`} aria-hidden="true"></div>
  <div
    class="wind"
    style:--picture={`url("${background.picture}")`}
    style:--ratio={background.wind.ratio}
    style:--span={background.wind.span}
    style:--focus={background.wind.focus}
    style:--sky={background.wind.sky}
    style:--ground={background.wind.ground}
    style:--mist-far={`url("${WIND_LAYERS.mistFar}")`}
    style:--mist-near={`url("${WIND_LAYERS.mistNear}")`}
    style:--drift={`url("${WIND_LAYERS.drift}")`}
    style:--flakes-far={`url("${WIND_LAYERS.flakesFar}")`}
    style:--flakes-near={`url("${WIND_LAYERS.flakesNear}")`}
    aria-hidden="true"
  >
    <div class="sky"><div class="mist far"></div><div class="mist near"></div></div>
    {#if !motion.reduced}
      <div class="ground"><div class="drift"></div><div class="flakes far"></div><div class="flakes near"></div></div>
    {/if}
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
     a blur of the photo itself; a narrower window is covered. Its layers lie over it in its own
     measures, so that the mist stays in its sky and the snow on its ground. The wind blows from the
     left: each layer slides one tile and starts again without a seam. */
  .wind-fill { position: fixed; inset: -60px; z-index: -2; background: var(--picture) 0 0 / 100% 100% no-repeat var(--bg-1); filter: blur(40px) saturate(.9); }
  .wind { --tall: min(100vh / var(--span), max(100vh, 100vw / var(--ratio))); position: fixed; z-index: -2; overflow: hidden;
    width: calc(var(--tall) * var(--ratio)); height: var(--tall);
    left: calc((100vw - var(--tall) * var(--ratio)) / 2); top: calc((100vh - var(--tall)) * var(--focus));
    background: var(--picture) 0 0 / 100% 100% no-repeat;
    mask-image: linear-gradient(to right, transparent, black 9%, black 91%, transparent); }
  .sky { position: absolute; left: 0; right: 0; top: 0; height: calc(var(--sky) * 100% + 6%);
    mask-image: linear-gradient(to bottom, transparent, black 12%, black 72%, transparent); }
  .mist { position: absolute; left: 0; width: 200%; background-repeat: repeat-x; background-size: 50% 100%;
    animation: blow-half var(--wind-cloud) linear infinite; will-change: transform; }
  .mist.far { top: 6%; height: 70%; background-image: var(--mist-far); opacity: .5; }
  .mist.near { top: 38%; height: 58%; background-image: var(--mist-near); opacity: .42; animation-duration: calc(var(--wind-cloud) * .62); }
  .ground { position: absolute; left: 0; right: 0; top: calc(var(--ground) * 100% - 4%); bottom: 0;
    mask-image: linear-gradient(to bottom, transparent, black 22%); }
  .drift { position: absolute; left: 0; bottom: 0; width: 200%; height: 75%; background: var(--drift) 0 100% / 50% 100% repeat-x;
    animation: blow-half calc(var(--wind-snow) * 1.3) linear infinite, gust var(--wind-gust) ease-in-out infinite; will-change: transform, opacity; }
  .flakes { position: absolute; top: 0; bottom: 0; left: 0; will-change: transform; }
  .flakes.far { width: calc(100% + 520px); background: var(--flakes-far) 0 0 / 520px 260px repeat;
    animation: blow-far calc(var(--wind-snow) * 1.7) linear infinite; opacity: .55; }
  .flakes.near { width: calc(100% + 760px); background: var(--flakes-near) 0 0 / 760px 380px repeat;
    animation: blow-near var(--wind-snow) linear infinite, gust calc(var(--wind-gust) * 1.37) ease-in-out infinite; }
  @keyframes blow-half { from { transform: translateX(-50%); } to { transform: translateX(0); } }
  @keyframes blow-far { from { transform: translate(-520px, 0); } 50% { transform: translate(-260px, 6px); } to { transform: translate(0, 0); } }
  @keyframes blow-near { from { transform: translate(-760px, 0); } 30% { transform: translate(-532px, -10px); } 70% { transform: translate(-228px, 8px); } to { transform: translate(0, 0); } }
  /* The wind rises and falls: the blown snow comes in gusts. */
  @keyframes gust { 0%, 100% { opacity: .12; } 22% { opacity: .5; } 36% { opacity: .26; } 58% { opacity: .68; } 76% { opacity: .22; } }
  /* A still grain over the flowing ones */
  .grain { z-index: -1; pointer-events: none; opacity: .32; mix-blend-mode: soft-light;
    background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>"); }
</style>
