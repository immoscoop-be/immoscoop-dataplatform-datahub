const STEPS: Readonly<Record<string, (index: number, count: number) => number>> = {
  ArrowRight: (index, count) => (index + 1) % count,
  ArrowDown: (index, count) => (index + 1) % count,
  ArrowLeft: (index, count) => (index - 1 + count) % count,
  ArrowUp: (index, count) => (index - 1 + count) % count,
  Home: () => 0,
  End: (_, count) => count - 1,
};

/**
 * The keys of a group of choices or tabs, as the keyboard expects of one: the group is one stop for
 * Tab, and the arrows, Home and End move within it. Moves the focus to the item the key points at, and
 * returns its index; undefined when the key is not one of these.
 */
export function moveFocus(event: KeyboardEvent, selector: string): number | undefined {
  const step = STEPS[event.key];
  const group = event.currentTarget as HTMLElement;
  const items = [...group.querySelectorAll<HTMLElement>(selector)];
  const index = items.findIndex((item) => item.contains(event.target as Node));
  if (!step || index < 0) {
    return undefined;
  }
  event.preventDefault();
  const next = step(index, items.length);
  items[next]?.focus();
  return next;
}
