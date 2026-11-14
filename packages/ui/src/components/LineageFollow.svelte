<script lang="ts">
  import { useSvelteFlow, type Viewport } from '@xyflow/svelte';
  import { untrack } from 'svelte';

  /**
   * Inside the canvas of the Lineage: it moves the view to what was walked, at once the first time, then
   * as fast as a fold box turns, or at once when the User asks for less motion (DEC-UX-152). Only a new
   * view moves it: a zoom or a pan of the User stays until the next step.
   */
  let { view }: { view: Viewport | null } = $props();

  const flow = useSvelteFlow();
  let first = true;

  function duration(): number {
    if (first || typeof matchMedia !== 'function' || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return 0;
    }
    return Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--motion-fold')) || 0;
  }

  $effect(() => {
    const next = view;
    if (next) {
      // setViewport reads the viewport of the canvas: untracked, or every zoom and pan would run this again
      // and move the view back.
      untrack(() => void flow.setViewport(next, { duration: duration() }));
      first = false;
    }
  });
</script>
