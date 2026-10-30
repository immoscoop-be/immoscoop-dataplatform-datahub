<script lang="ts">
  import { useSvelteFlow, type Viewport } from '@xyflow/svelte';

  /**
   * Inside the canvas of the Lineage: it moves the view to what was walked, at once the first time, then
   * as fast as a fold box turns, or at once when the User asks for less motion (DEC-UX-152).
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
    if (view) {
      void flow.setViewport(view, { duration: duration() });
      first = false;
    }
  });
</script>
