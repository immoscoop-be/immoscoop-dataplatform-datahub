import type { IconName } from '@datahub/ui/foundations/icons.js';
import { t } from '@datahub/ui/foundations/texts.svelte.js';

/** A section is called by a name, never translated (Collections, Query, Learning Centre), or by a sentence of the translation files. */
type Label = { readonly name: string } | { readonly text: string };

/**
 * The main sections in the rail, in its order (DEC-UX-89): Collections, Query, Charts, Messages and
 * the Learning Centre, each with its start screen and its panel (DEC-UX-03). Lenses and Reports live
 * in their Collections (DEC-UX-66). The Learning Centre stands on top, as the prototypes show it
 * (OP-UX-37). Admin, the section of the Data Team, comes last, a little apart, and only a Data Admin
 * sees it (DEC-UX-130).
 */
export const SECTIONS = [
  { id: 'collections', path: '/collections', icon: 'stack-fill', label: { name: 'Collections' } },
  { id: 'query', path: '/query', icon: 'terminal-window-fill', label: { name: 'Query' } },
  { id: 'charts', path: '/charts', icon: 'chart-bar-fill', label: { text: 'section.charts' } },
  { id: 'messages', path: '/messages', icon: 'chat-circle-text-fill', label: { text: 'section.messages' } },
  { id: 'learning', path: '/learning', icon: 'graduation-cap-fill', label: { name: 'Learning Centre' } },
  { id: 'admin', path: '/admin', icon: 'toolbox-fill', label: { name: 'Admin' }, dataTeam: true },
] as const satisfies readonly { id: string; path: string; icon: IconName; label: Label; dataTeam?: true }[];

export type Section = (typeof SECTIONS)[number];
export type SectionId = Section['id'];

/** Whether the User sees a section in the rail: Admin only for the Data Team (DEC-UX-130). */
export function sectionFor(section: Section, dataTeam: boolean): boolean {
  return !('dataTeam' in section) || dataTeam;
}

/**
 * The tools of Admin, in the order of its panel; the first is where Admin opens (OP-UX-52). A new tool is one
 * entry here, with its page.
 */
export const ADMIN_TOOLS = [{ id: 'webhooks', path: '/admin/webhooks', icon: 'webhooks-logo', name: 'Webhooks' }] as const satisfies readonly {
  id: string;
  path: string;
  icon: IconName;
  name: string;
}[];

export type AdminTool = (typeof ADMIN_TOOLS)[number]['id'];

export function sectionLabel(section: Section): string {
  return 'name' in section.label ? section.label.name : t(section.label.text);
}
