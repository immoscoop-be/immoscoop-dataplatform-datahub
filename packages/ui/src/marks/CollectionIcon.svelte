<script lang="ts" module>
  // Every icon a Collection can carry, in the light weight of Phosphor (DEC-CO-19): each a file of
  // its own in the build, loaded only where a Collection shows it, never with the page.
  const DRAWINGS = import.meta.glob<string>('../../node_modules/@phosphor-icons/core/assets/light/*-light.svg', { query: '?raw', import: 'default' });
  const loaded = new Map<string, Promise<string>>();

  /** The drawing of an icon by its name, such as `house-line`; empty for one Phosphor does not have. */
  function drawing(name: string): Promise<string> {
    let found = loaded.get(name);
    if (!found) {
      const load = DRAWINGS[`../../node_modules/@phosphor-icons/core/assets/light/${name}-light.svg`];
      found = load ? load() : Promise.resolve('');
      loaded.set(name, found);
    }
    return found;
  }
</script>

<script lang="ts">
  /**
   * The icon of a Collection: the line icon its Owner chose, grey and without a circle, the only thing
   * that sets it apart (DEC-UX-15, DEC-UX-105). It takes the size and colour of the text around it;
   * `large` is that of the head of its page. Its name is a name, never read out.
   */
  let { name, large = false }: { name: string | null; large?: boolean } = $props();

  let svg = $state('');
  $effect(() => {
    const wanted = name;
    svg = '';
    if (wanted) {
      drawing(wanted).then((found) => {
        if (name === wanted) {
          svg = found;
        }
      });
    }
  });
</script>

<span class="collection-icon" class:large aria-hidden="true">{@html svg}</span>

<style>
  .collection-icon { width: 26px; height: 34px; display: flex; align-items: center; justify-content: center; font-size: 20px; flex-shrink: 0; color: var(--text-secondary); }
  .large { width: 34px; height: 44px; font-size: 28px; }
  .collection-icon :global(svg) { display: block; width: 1em; height: 1em; }
</style>
