import type { IconName } from '@datahub/ui/foundations/icons.js';
import { t } from '@datahub/ui/foundations/texts.svelte.js';
import { adminOptions, mayQuery, type Permissions } from './permissions.js';

/** A section is called by a name, never translated (Collections, Query, Learning Centre), or by a sentence of the translation files. */
type Label = { readonly name: string } | { readonly text: string };

/**
 * The main sections in the rail, in its order (DEC-UX-89): Collections, Query, Charts, Messages and
 * the Learning Centre, each with its start screen and its panel (DEC-UX-03). Lenses and Reports live
 * in their Collections (DEC-UX-66). The Learning Centre stands on top, as the prototypes show it
 * (OP-UX-37). Admin, the section of the Data Team, comes last, a little apart (DEC-UX-130). Which of them a User
 * sees follows from their Permissions, never from a role (FR-PL-14).
 */
export const SECTIONS = [
  { id: 'collections', path: '/collections', icon: 'stack-fill', label: { name: 'Collections' } },
  { id: 'query', path: '/query', icon: 'terminal-window-fill', label: { name: 'Query' } },
  { id: 'charts', path: '/charts', icon: 'chart-bar-fill', label: { text: 'section.charts' } },
  { id: 'messages', path: '/messages', icon: 'chat-circle-text-fill', label: { text: 'section.messages' } },
  { id: 'learning', path: '/learning', icon: 'graduation-cap-fill', label: { name: 'Learning Centre' } },
  { id: 'admin', path: '/admin', icon: 'toolbox-fill', label: { name: 'Admin' } },
] as const satisfies readonly { id: string; path: string; icon: IconName; label: Label }[];

export type Section = (typeof SECTIONS)[number];
export type SectionId = Section['id'];

/**
 * Whether the User sees a section in the rail (FR-PL-14): Query to a User who may make queries or Preview a
 * Resource, Admin to a User with `admin.open` and at least one of its tools, the others to everyone.
 */
export function sectionFor(section: Section, permissions: Permissions): boolean {
  if (section.id === 'query') return mayQuery(permissions);
  if (section.id === 'admin') return toolsFor(permissions).length > 0;
  return true;
}

/**
 * The tools of Admin, in the order of its panel, each with the option of `admin.open` that opens it; the first a
 * User may open is where Admin opens for them (OP-UX-52). A new tool is one entry here, with its page.
 */
export const ADMIN_TOOLS = [
  { id: 'webhooks', path: '/admin/webhooks', icon: 'webhooks-logo', name: 'Webhooks', option: 'webhooks' },
  { id: 'keys', path: '/admin/keys', icon: 'key', name: 'Excel keys', option: 'excelKeys' },
  { id: 'users', path: '/admin/users', icon: 'users', name: 'Users', option: 'users' },
  { id: 'permissionGroups', path: '/admin/permission-groups', icon: 'shield-check', name: 'Permission groups', option: 'permissionGroups' },
] as const satisfies readonly {
  id: string;
  path: string;
  icon: IconName;
  name: string;
  option: string;
}[];

export type AdminTool = (typeof ADMIN_TOOLS)[number]['id'];

/** The tools of Admin the User may open, chosen in `admin.open` (FR-PL-06, FR-PL-09). */
export function toolsFor(permissions: Permissions): AdminTool[] {
  const options = adminOptions(permissions);
  return ADMIN_TOOLS.filter((tool) => options.includes(tool.option)).map((tool) => tool.id);
}

export function sectionLabel(section: Section): string {
  return 'name' in section.label ? section.label.name : t(section.label.text);
}
