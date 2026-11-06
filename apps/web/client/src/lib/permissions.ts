import {
  can,
  canWith,
  NO_PERMISSIONS,
  PERMISSION_KEYS,
  PERMISSIONS,
  permissionValue,
  reach,
  sees,
  type PermissionKey,
  type PermissionPart,
  type Permissions,
  type PermissionSetting,
  type PermissionValue,
  type ValueSpec,
} from '@datahub/contracts/permissions';
import type { IconName } from '@datahub/ui/foundations/icons.js';
import { currentLanguage, t } from '@datahub/ui/foundations/texts.svelte.js';

/**
 * The Permissions of the User in the web app (FR-PL-14, TR-PL-06): read from `GET /me` once, at the start. The web
 * app shows a section of the rail, a page or an action from them, and from the flags the services send per object,
 * never from a role. Here too what Admin shows of a Permission: its name and sentence, its values with their labels,
 * and what changes for a User between two Permission groups (FR-PL-07).
 */

export { can, canWith, NO_PERMISSIONS, PERMISSION_KEYS, PERMISSIONS, permissionValue, reach, sees };
export type { PermissionKey, PermissionPart, Permissions, PermissionSetting, PermissionValue, ValueSpec };

/** The tools of Admin a User may open, by the option of `admin.open` that names them. */
export function adminOptions(permissions: Permissions): readonly string[] {
  const tools = permissionValue(permissions, 'admin.open', 'tools');
  return can(permissions, 'admin.open') && Array.isArray(tools) ? tools : [];
}

/** Query shows to a User who may make queries or Preview a Resource (FR-PL-14). */
export function mayQuery(permissions: Permissions): boolean {
  return can(permissions, 'queries.make') || can(permissions, 'resources.preview');
}

/** The parts of Data Hub, in the order of the rail, each with its icon (DEC-UX-186). */
export const PARTS: readonly { id: PermissionPart; icon: IconName; title: string }[] = [
  { id: 'collections', icon: 'stack-fill', title: 'permission.part.collections' },
  { id: 'query', icon: 'terminal-window-fill', title: 'permission.part.query' },
  { id: 'lenses', icon: 'aperture-fill', title: 'permission.part.lenses' },
  { id: 'messages', icon: 'chat-circle-text-fill', title: 'permission.part.messages' },
  { id: 'claude', icon: 'plugs-connected-fill', title: 'permission.part.claude' },
  { id: 'excel', icon: 'key-fill', title: 'permission.part.excel' },
  { id: 'admin', icon: 'toolbox-fill', title: 'permission.part.admin' },
];

/** The Permissions of a part, in the order of the catalogue. */
export function keysOf(part: PermissionPart): PermissionKey[] {
  return PERMISSION_KEYS.filter((key) => PERMISSIONS[key].part === part);
}

/** The sentences of one value of a Permission: its label, its options, and a hint under it. */
interface ValueText {
  readonly label: string;
  readonly options?: Readonly<Record<string, string>>;
  readonly hint?: string;
}

type ValuesOf<K extends PermissionKey> = keyof (typeof PERMISSIONS)[K]['values'];

/** The sentences of every Permission, by key: its name, what it allows, and its values (FR-PL-05). */
export const PERMISSION_TEXTS: { readonly [K in PermissionKey]: { name: string; about: string; values: { readonly [V in ValuesOf<K>]: ValueText } } } = {
  'catalogue.see': {
    name: 'permission.catalogue.see',
    about: 'permission.catalogue.see.about',
    values: {
      see: {
        label: 'permission.catalogue.see.see',
        options: { theirs: 'permission.catalogue.see.see.theirs', public: 'permission.catalogue.see.see.public', all: 'permission.catalogue.see.see.all' },
      },
    },
  },
  'collections.make': {
    name: 'permission.collections.make',
    about: 'permission.collections.make.about',
    values: {
      ownerUnit: {
        label: 'permission.collections.make.ownerUnit',
        options: { theirs: 'permission.collections.make.ownerUnit.theirs', any: 'permission.collections.make.ownerUnit.any' },
      },
    },
  },
  'collections.manage': {
    name: 'permission.collections.manage',
    about: 'permission.collections.manage.about',
    values: {
      reach: { label: 'permission.collections.manage.reach', options: { theirs: 'permission.collections.manage.reach.theirs', every: 'permission.collections.manage.reach.every' } },
    },
  },
  'resources.assign': { name: 'permission.resources.assign', about: 'permission.resources.assign.about', values: {} },
  'resources.describe': {
    name: 'permission.resources.describe',
    about: 'permission.resources.describe.about',
    values: {
      reach: { label: 'permission.resources.describe.reach', options: { theirs: 'permission.resources.describe.reach.theirs', every: 'permission.resources.describe.reach.every' } },
      attributes: {
        label: 'permission.resources.describe.attributes',
        options: {
          description: 'permission.resources.describe.attributes.description',
          behaviour: 'permission.resources.describe.attributes.behaviour',
          pitfalls: 'permission.resources.describe.attributes.pitfalls',
          availableSince: 'permission.resources.describe.attributes.availableSince',
          gaps: 'permission.resources.describe.attributes.gaps',
          keyFields: 'permission.resources.describe.attributes.keyFields',
          entityMapping: 'permission.resources.describe.attributes.entityMapping',
        },
      },
    },
  },
  'resources.publish': { name: 'permission.resources.publish', about: 'permission.resources.publish.about', values: {} },
  'resources.deprecate': {
    name: 'permission.resources.deprecate',
    about: 'permission.resources.deprecate.about',
    values: {
      reach: { label: 'permission.resources.deprecate.reach', options: { theirs: 'permission.resources.deprecate.reach.theirs', every: 'permission.resources.deprecate.reach.every' } },
    },
  },
  'resources.preview': { name: 'permission.resources.preview', about: 'permission.resources.preview.about', values: {} },
  'queries.make': { name: 'permission.queries.make', about: 'permission.queries.make.about', values: {} },
  'runs.ranges': {
    name: 'permission.runs.ranges',
    about: 'permission.runs.ranges.about',
    values: {
      freeMb: { label: 'permission.runs.ranges.freeMb' },
      approveGb: { label: 'permission.runs.ranges.approveGb' },
      above: { label: 'permission.runs.ranges.above', options: { request: 'permission.runs.ranges.above.request', refuse: 'permission.runs.ranges.above.refuse' } },
    },
  },
  'queries.seeOthers': {
    name: 'permission.queries.seeOthers',
    about: 'permission.queries.seeOthers.about',
    values: {
      reach: { label: 'permission.queries.seeOthers.reach', options: { theirs: 'permission.queries.seeOthers.reach.theirs', every: 'permission.queries.seeOthers.reach.every' } },
    },
  },
  'requests.decide': { name: 'permission.requests.decide', about: 'permission.requests.decide.about', values: {} },
  'lenses.make': { name: 'permission.lenses.make', about: 'permission.lenses.make.about', values: {} },
  'lenses.manage': {
    name: 'permission.lenses.manage',
    about: 'permission.lenses.manage.about',
    values: {
      reach: { label: 'permission.lenses.manage.reach', options: { theirs: 'permission.lenses.manage.reach.theirs', every: 'permission.lenses.manage.reach.every' } },
    },
  },
  'messages.write': {
    name: 'permission.messages.write',
    about: 'permission.messages.write.about',
    values: {
      kinds: {
        label: 'permission.messages.write.kinds',
        options: { question: 'permission.messages.write.kinds.question', remark: 'permission.messages.write.kinds.remark', signal: 'permission.messages.write.kinds.signal' },
      },
    },
  },
  'messages.reply': {
    name: 'permission.messages.reply',
    about: 'permission.messages.reply.about',
    values: {
      reach: { label: 'permission.messages.reply.reach', options: { theirs: 'permission.messages.reply.reach.theirs', every: 'permission.messages.reply.reach.every' } },
    },
  },
  'messages.close': {
    name: 'permission.messages.close',
    about: 'permission.messages.close.about',
    values: {
      reach: { label: 'permission.messages.close.reach', options: { theirs: 'permission.messages.close.reach.theirs', every: 'permission.messages.close.reach.every' } },
    },
  },
  'messages.dataTeam': { name: 'permission.messages.dataTeam', about: 'permission.messages.dataTeam.about', values: {} },
  'claude.use': {
    name: 'permission.claude.use',
    about: 'permission.claude.use.about',
    values: {
      writes: {
        label: 'permission.claude.use.writes',
        options: {
          descriptions: 'permission.claude.use.writes.descriptions',
          messages: 'permission.claude.use.writes.messages',
          deprecations: 'permission.claude.use.writes.deprecations',
          changesSeen: 'permission.claude.use.writes.changesSeen',
        },
      },
      note: { label: 'permission.claude.use.note', hint: 'permission.claude.use.note.hint' },
    },
  },
  'claude.results': {
    name: 'permission.claude.results',
    about: 'permission.claude.results.about',
    values: {
      show: {
        label: 'permission.claude.results.show',
        options: { claude: 'permission.claude.results.show.claude', card: 'permission.claude.results.show.card', none: 'permission.claude.results.show.none' },
      },
    },
  },
  'excel.keys': {
    name: 'permission.excel.keys',
    about: 'permission.excel.keys.about',
    values: {
      most: { label: 'permission.excel.keys.most', hint: 'permission.excel.keys.most.hint' },
      lifetimeDays: { label: 'permission.excel.keys.lifetimeDays' },
    },
  },
  'admin.open': {
    name: 'permission.admin.open',
    about: 'permission.admin.open.about',
    values: {
      tools: {
        label: 'permission.admin.open.tools',
        options: {
          webhooks: 'permission.admin.open.tools.webhooks',
          excelKeys: 'permission.admin.open.tools.excelKeys',
          users: 'permission.admin.open.tools.users',
          permissionGroups: 'permission.admin.open.tools.permissionGroups',
        },
      },
    },
  },
};

/** The texts of one value of a Permission. */
export function valueText(key: PermissionKey, name: string): ValueText {
  return (PERMISSION_TEXTS[key].values as Readonly<Record<string, ValueText>>)[name] ?? { label: name };
}

/** The values of a Permission, each with its kind, in the order of the catalogue. */
export function valuesOf(key: PermissionKey): [string, ValueSpec][] {
  return Object.entries(PERMISSIONS[key].values) as [string, ValueSpec][];
}

/** A whole number with its unit beside a field, and with its amount in a sentence. */
const UNIT_WORDS: Record<'MB' | 'GB' | 'keys' | 'days', string> = { MB: 'permission.unit.MB', GB: 'permission.unit.GB', keys: 'permission.unit.keys', days: 'permission.unit.days' };
const AMOUNTS: Record<'MB' | 'GB' | 'keys' | 'days', string> = { MB: 'permission.amount.MB', GB: 'permission.amount.GB', keys: 'permission.amount.keys', days: 'permission.amount.days' };

export function unitWord(unit: keyof typeof UNIT_WORDS): string {
  return t(UNIT_WORDS[unit]);
}

/** One value as a sentence shows it: 100 MB, no limit, every Collection, Questions and Signals. */
export function shownValue(key: PermissionKey, name: string, value: PermissionValue | undefined): string {
  const spec = (PERMISSIONS[key].values as Readonly<Record<string, ValueSpec>>)[name];
  const options = valueText(key, name).options ?? {};
  const option = (one: string) => (options[one] ? t(options[one]) : one);
  switch (spec?.kind) {
    case 'number':
      return value === null || value === undefined ? t('permission.noLimit') : t(AMOUNTS[spec.unit], { count: Number(value) });
    case 'choice':
      return typeof value === 'string' ? option(value) : '';
    case 'several': {
      const chosen = Array.isArray(value) ? value : [];
      return chosen.length === 0 ? t('permission.noneChosen') : new Intl.ListFormat(currentLanguage() === 'nl' ? 'nl-BE' : 'en-GB').format(chosen.map(option));
    }
    case 'yesno':
      return t(value ? 'permission.yes' : 'permission.no');
    case 'text':
      return typeof value === 'string' && value.trim() ? value : t('permission.noText');
    default:
      return '';
  }
}

/** The values of a Permission in one line, as Admin shows them locked: "Which Collections: every Collection · …". */
export function summaryOf(key: PermissionKey, setting: PermissionSetting): string {
  return valuesOf(key)
    // A text left empty says nothing.
    .filter(([name, spec]) => spec.kind !== 'text' || String(setting.values[name] ?? '').trim() !== '')
    .map(([name]) => `${t(valueText(key, name).label)}: ${shownValue(key, name, setting.values[name])}`)
    .join(' · ');
}

/** Two values of the same kind are the same, several choices in any order. */
function same(one: PermissionValue | undefined, other: PermissionValue | undefined): boolean {
  if (Array.isArray(one) && Array.isArray(other)) {
    return one.length === other.length && one.every((option) => other.includes(option));
  }
  return (one ?? null) === (other ?? null);
}

/** Two settings of a Permission are the same: yes or no, and every value. */
export function sameSetting(one: PermissionSetting, other: PermissionSetting): boolean {
  const names = new Set([...Object.keys(one.values), ...Object.keys(other.values)]);
  return one.on === other.on && [...names].every((name) => same(one.values[name], other.values[name]));
}

/** The Permissions changed between what a group holds and what is being edited, in the order of the catalogue. */
export function changedKeys(saved: Permissions, edited: Permissions): PermissionKey[] {
  return PERMISSION_KEYS.filter((key) => !sameSetting(saved[key], edited[key]));
}

/** The options of a choice from the narrowest to the widest, where the catalogue lists them otherwise. */
const NARROW_TO_WIDE: Readonly<Record<string, readonly string[]>> = {
  'runs.ranges.above': ['refuse', 'request'],
  'claude.results.show': ['none', 'card', 'claude'],
};

/** Whether another value of a Permission lets a User do more (1), less (-1), or neither (0). */
function direction(key: PermissionKey, name: string, spec: ValueSpec, was: PermissionValue | undefined, now: PermissionValue | undefined): number {
  switch (spec.kind) {
    case 'number': {
      const size = (value: PermissionValue | undefined) => (value === null || value === undefined ? Number.POSITIVE_INFINITY : Number(value));
      return Math.sign(size(now) - size(was));
    }
    case 'choice': {
      const order = NARROW_TO_WIDE[`${key}.${name}`] ?? spec.options;
      return Math.sign(order.indexOf(String(now)) - order.indexOf(String(was)));
    }
    case 'several': {
      const before = Array.isArray(was) ? was : [];
      const after = Array.isArray(now) ? now : [];
      const gained = after.some((option) => !before.includes(option));
      const lost = before.some((option) => !after.includes(option));
      return gained && !lost ? 1 : lost && !gained ? -1 : 0;
    }
    case 'yesno':
      return Math.sign(Number(Boolean(now)) - Number(Boolean(was)));
    case 'text':
      return 0;
  }
}

/** One line of what changes for a User: what they gain, lose, or what changes otherwise, with the value it was. */
export interface Change {
  readonly kind: 'gain' | 'loss' | 'change';
  readonly key: PermissionKey;
  /** The name of the Permission. */
  readonly name: string;
  /** What it is now: its values, or one value with its label. */
  readonly detail: string;
  /** What it was, struck through. */
  readonly was: string;
}

/**
 * What changes for a User who moves from one Permission group to another (FR-PL-07): a Permission they gain, with
 * its values; one they lose; and every value that goes further, less far, or only otherwise, with what it was. The
 * gains first, then the losses, then the rest, each in the order of the catalogue.
 */
export function changesBetween(from: Permissions, to: Permissions): Change[] {
  const lines: Change[] = [];
  for (const key of PERMISSION_KEYS) {
    const name = t(PERMISSION_TEXTS[key].name);
    const [before, after] = [can(from, key), can(to, key)];
    if (!before && after) {
      lines.push({ kind: 'gain', key, name, detail: summaryOf(key, to[key]), was: '' });
    } else if (before && !after) {
      lines.push({ kind: 'loss', key, name, detail: '', was: '' });
    } else if (after) {
      for (const [value, spec] of valuesOf(key)) {
        const [was, now] = [from[key].values[value], to[key].values[value]];
        if (same(was, now)) continue;
        const way = direction(key, value, spec, was, now);
        const label = t(valueText(key, value).label);
        lines.push(
          spec.kind === 'text'
            ? { kind: 'change', key, name, detail: `${label}: ${t('permission.textChanged')}`, was: '' }
            : { kind: way > 0 ? 'gain' : way < 0 ? 'loss' : 'change', key, name, detail: `${label}: ${shownValue(key, value, now)}`, was: shownValue(key, value, was) },
        );
      }
    }
  }
  const rank = { gain: 0, loss: 1, change: 2 } as const;
  return lines.map((line, index) => ({ line, index })).sort((one, other) => rank[one.line.kind] - rank[other.line.kind] || one.index - other.index).map(({ line }) => line);
}
