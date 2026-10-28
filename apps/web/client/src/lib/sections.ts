import type { IconName } from '@datahub/ui/foundations/icons.js';
import { t } from '@datahub/ui/foundations/texts.svelte.js';

/** A section is called by a name, never translated (Collections, Query), or by a sentence of the translation files. */
type Label = { readonly name: string } | { readonly text: string };

/**
 * The main sections in the rail, in its order (DEC-UX-89): Collections, Query, Charts, Messages and
 * the learning centre, each with its start screen and its panel (DEC-UX-03). Lenses and Reports live
 * in their Collections (DEC-UX-66). The learning centre stands on top, as the prototypes show it
 * (OP-UX-37).
 */
export const SECTIONS = [
  { id: 'collections', path: '/collections', icon: 'stack-fill', label: { name: 'Collections' } },
  { id: 'query', path: '/query', icon: 'terminal-window-fill', label: { name: 'Query' } },
  { id: 'charts', path: '/charts', icon: 'chart-bar-fill', label: { text: 'section.charts' } },
  { id: 'messages', path: '/messages', icon: 'chat-circle-text-fill', label: { text: 'section.messages' } },
  { id: 'learning', path: '/learning', icon: 'graduation-cap-fill', label: { text: 'section.learning' } },
] as const satisfies readonly { id: string; path: string; icon: IconName; label: Label }[];

export type Section = (typeof SECTIONS)[number];
export type SectionId = Section['id'];

export function sectionLabel(section: Section): string {
  return 'name' in section.label ? section.label.name : t(section.label.text);
}
