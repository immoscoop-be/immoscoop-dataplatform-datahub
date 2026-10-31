/**
 * A row of a list that is no link (DEC-UX-157): a click anywhere on it opens what it is, Enter too, so that a
 * drag anywhere on it moves it. A click with Cmd or Ctrl opens it in a new tab; a click on a button in the
 * row does what the button does.
 */
export function rowOf(href: string, go: (path: string) => void) {
  return {
    tabindex: 0,
    role: 'link' as const,
    onclick: (event: MouseEvent) => {
      if ((event.target as Element | null)?.closest('button, a, input, textarea, select')) return;
      if (event.metaKey || event.ctrlKey) {
        window.open(href, '_blank', 'noopener');
        return;
      }
      go(href);
    },
    onkeydown: (event: KeyboardEvent) => {
      if (event.key === 'Enter' && event.target === event.currentTarget) go(href);
    },
  };
}
