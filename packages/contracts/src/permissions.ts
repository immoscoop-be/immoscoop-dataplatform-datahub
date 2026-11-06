import { z } from 'zod';

/**
 * The Permissions of Data Hub (DEC-PL-01, FR-PL-05, TR-PL-03): what a User may do, held by their
 * Permission group. A Permission is yes or no, or always on; its values say how far it goes, each of a
 * kind a Parameter has. Every service, the web app and the MCP server read the keys and values from here.
 */

/** The part of Data Hub a Permission belongs to, in the order of the rail (DEC-UX-186). */
export type PermissionPart = 'collections' | 'query' | 'lenses' | 'messages' | 'claude' | 'excel' | 'admin';

/** The kind of one value of a Permission: those of a Parameter (DEC-UX-71). */
export type ValueSpec =
  | { kind: 'number'; unit: 'MB' | 'GB' | 'keys' | 'days'; min: number; max: number; empty?: true }
  | { kind: 'choice'; options: readonly string[] }
  | { kind: 'several'; options: readonly string[] }
  | { kind: 'yesno' }
  | { kind: 'text'; max: number };

interface PermissionSpec {
  part: PermissionPart;
  /** Always on: it has no yes or no, only its values. */
  always?: true;
  values: Readonly<Record<string, ValueSpec>>;
}

const REACH = { kind: 'choice', options: ['theirs', 'every'] } as const;

export const PERMISSIONS = {
  'catalogue.see': { part: 'collections', always: true, values: { see: { kind: 'choice', options: ['theirs', 'public', 'all'] } } },
  'collections.make': { part: 'collections', values: { ownerUnit: { kind: 'choice', options: ['theirs', 'any'] } } },
  'collections.manage': { part: 'collections', values: { reach: REACH } },
  'resources.assign': { part: 'collections', values: {} },
  'resources.describe': {
    part: 'collections',
    values: {
      reach: REACH,
      attributes: { kind: 'several', options: ['description', 'behaviour', 'pitfalls', 'availableSince', 'gaps', 'keyFields', 'entityMapping'] },
    },
  },
  'resources.publish': { part: 'collections', values: {} },
  'resources.deprecate': { part: 'collections', values: { reach: REACH } },
  'resources.preview': { part: 'query', values: {} },
  'queries.make': { part: 'query', values: {} },
  'runs.ranges': {
    part: 'query',
    always: true,
    values: {
      freeMb: { kind: 'number', unit: 'MB', min: 1, max: 1_000_000 },
      approveGb: { kind: 'number', unit: 'GB', min: 0.1, max: 10_000 },
      above: { kind: 'choice', options: ['request', 'refuse'] },
    },
  },
  'queries.seeOthers': { part: 'query', values: { reach: REACH } },
  'requests.decide': { part: 'query', values: {} },
  'lenses.make': { part: 'lenses', values: {} },
  'lenses.manage': { part: 'lenses', values: { reach: REACH } },
  'messages.write': { part: 'messages', values: { kinds: { kind: 'several', options: ['question', 'remark', 'signal'] } } },
  'messages.reply': { part: 'messages', values: { reach: REACH } },
  'messages.close': { part: 'messages', values: { reach: REACH } },
  'messages.dataTeam': { part: 'messages', values: {} },
  'claude.use': {
    part: 'claude',
    values: {
      writes: { kind: 'several', options: ['descriptions', 'messages', 'deprecations', 'changesSeen'] },
      note: { kind: 'text', max: 1000 },
    },
  },
  'claude.results': { part: 'claude', always: true, values: { show: { kind: 'choice', options: ['claude', 'card', 'none'] } } },
  'excel.keys': {
    part: 'excel',
    values: { most: { kind: 'number', unit: 'keys', min: 1, max: 100, empty: true }, lifetimeDays: { kind: 'number', unit: 'days', min: 1, max: 3650 } },
  },
  'admin.open': { part: 'admin', values: { tools: { kind: 'several', options: ['webhooks', 'excelKeys', 'users', 'permissionGroups'] } } },
} as const satisfies Record<string, PermissionSpec>;

export type PermissionKey = keyof typeof PERMISSIONS;
export const PERMISSION_KEYS = Object.keys(PERMISSIONS) as PermissionKey[];

/** One value of a Permission: a number (or null for no limit), an option, several options, yes or no, or a text. */
export type PermissionValue = number | string | string[] | boolean | null;

/** A Permission as a Permission group holds it: yes or no, and its values, kept also while it is no. */
export interface PermissionSetting {
  on: boolean;
  values: Record<string, PermissionValue>;
}

/** The Permissions of a Permission group, or of a User through it, by key. */
export type Permissions = Record<PermissionKey, PermissionSetting>;

/** The Permission groups to start with (DEC-PL-07). */
export type StartingGroup = 'admin' | 'businessAnalyst' | 'lensUser';

const RANGES = { freeMb: 100, approveGb: 1, above: 'request' };
const ALL_ATTRIBUTES = [...PERMISSIONS['resources.describe'].values.attributes.options];
const ALL_KINDS = [...PERMISSIONS['messages.write'].values.kinds.options];
const ALL_WRITES = [...PERMISSIONS['claude.use'].values.writes.options];
const ALL_TOOLS = [...PERMISSIONS['admin.open'].values.tools.options];
const EXCEL = { most: null, lifetimeDays: 365 };

const on = (values: Record<string, PermissionValue> = {}): PermissionSetting => ({ on: true, values });
const off = (values: Record<string, PermissionValue> = {}): PermissionSetting => ({ on: false, values });

/** Admin: the Data Admins of today, every Permission at its widest, locked (DEC-UX-188). */
const ADMIN: Permissions = {
  'catalogue.see': on({ see: 'all' }),
  'collections.make': on({ ownerUnit: 'any' }),
  'collections.manage': on({ reach: 'every' }),
  'resources.assign': on(),
  'resources.describe': on({ reach: 'every', attributes: ALL_ATTRIBUTES }),
  'resources.publish': on(),
  'resources.deprecate': on({ reach: 'every' }),
  'resources.preview': on(),
  'queries.make': on(),
  'runs.ranges': on(RANGES),
  'queries.seeOthers': on({ reach: 'every' }),
  'requests.decide': on(),
  'lenses.make': on(),
  'lenses.manage': on({ reach: 'every' }),
  'messages.write': on({ kinds: ALL_KINDS }),
  'messages.reply': on({ reach: 'every' }),
  'messages.close': on({ reach: 'every' }),
  'messages.dataTeam': on(),
  'claude.use': on({ writes: ALL_WRITES, note: '' }),
  'claude.results': on({ show: 'claude' }),
  'excel.keys': on(EXCEL),
  'admin.open': on({ tools: ALL_TOOLS }),
};

/** Business analyst: what every User who is not of the Data Team could do before Permission groups. */
const BUSINESS_ANALYST: Permissions = {
  'catalogue.see': on({ see: 'public' }),
  'collections.make': on({ ownerUnit: 'theirs' }),
  'collections.manage': on({ reach: 'theirs' }),
  'resources.assign': off(),
  'resources.describe': on({ reach: 'theirs', attributes: ALL_ATTRIBUTES.filter((attribute) => attribute !== 'entityMapping') }),
  'resources.publish': on(),
  'resources.deprecate': on({ reach: 'theirs' }),
  'resources.preview': on(),
  'queries.make': on(),
  'runs.ranges': on(RANGES),
  'queries.seeOthers': on({ reach: 'theirs' }),
  'requests.decide': off(),
  'lenses.make': on(),
  'lenses.manage': on({ reach: 'theirs' }),
  'messages.write': on({ kinds: ALL_KINDS }),
  'messages.reply': on({ reach: 'every' }),
  'messages.close': on({ reach: 'theirs' }),
  'messages.dataTeam': off(),
  'claude.use': on({ writes: ALL_WRITES, note: '' }),
  'claude.results': on({ show: 'claude' }),
  'excel.keys': on(EXCEL),
  'admin.open': off({ tools: [] }),
};

/** Lens user: only Lenses; results of Claude in a card only (DEC-PL-07); the default for new Users. */
const LENS_USER: Permissions = {
  'catalogue.see': on({ see: 'public' }),
  'collections.make': off({ ownerUnit: 'theirs' }),
  'collections.manage': off({ reach: 'theirs' }),
  'resources.assign': off(),
  'resources.describe': off({ reach: 'theirs', attributes: [] }),
  'resources.publish': off(),
  'resources.deprecate': off({ reach: 'theirs' }),
  'resources.preview': off(),
  'queries.make': off(),
  'runs.ranges': on(RANGES),
  'queries.seeOthers': off({ reach: 'theirs' }),
  'requests.decide': off(),
  'lenses.make': off(),
  'lenses.manage': off({ reach: 'theirs' }),
  'messages.write': on({ kinds: ['question', 'signal'] }),
  'messages.reply': off({ reach: 'theirs' }),
  'messages.close': off({ reach: 'theirs' }),
  'messages.dataTeam': off(),
  'claude.use': on({ writes: ['messages'], note: '' }),
  'claude.results': on({ show: 'card' }),
  'excel.keys': on(EXCEL),
  'admin.open': off({ tools: [] }),
};

/** Every Permission no: where a new Permission group can start, and what fills a key a group lacks. */
export const NO_PERMISSIONS: Permissions = Object.fromEntries(
  PERMISSION_KEYS.map((key) => [key, { on: 'always' in PERMISSIONS[key], values: structuredClone(LENS_USER[key].values) }]),
) as Permissions;
// What a User sees, and how a result reaches Claude, are always on; without a group's word, the narrowest.
NO_PERMISSIONS['catalogue.see'].values = { see: 'theirs' };
NO_PERMISSIONS['claude.results'].values = { show: 'none' };
NO_PERMISSIONS['messages.write'].values = { kinds: [] };
NO_PERMISSIONS['claude.use'].values = { writes: [], note: '' };

export const STARTING_GROUPS: Readonly<Record<StartingGroup, { name: string; sentence: string; permissions: Permissions }>> = {
  admin: { name: 'Admin', sentence: 'Everything, Admin included', permissions: ADMIN },
  businessAnalyst: {
    name: 'Business analyst',
    sentence: 'Queries, Lenses and their own Collections; Claude reads the rows',
    permissions: BUSINESS_ANALYST,
  },
  lensUser: { name: 'Lens user', sentence: 'Finds and runs Lenses; results of Claude in a card only', permissions: LENS_USER },
};

/** The Permissions of a starting group, a copy that can be changed. */
export function startingPermissions(group: StartingGroup): Permissions {
  return structuredClone(STARTING_GROUPS[group].permissions);
}

const valueSchema = (spec: ValueSpec): z.ZodType<PermissionValue> => {
  switch (spec.kind) {
    case 'number': {
      const number = z.number().min(spec.min).max(spec.max);
      return spec.empty ? number.nullable() : number;
    }
    case 'choice':
      return z.enum(spec.options as [string, ...string[]]);
    case 'several':
      return z.array(z.enum(spec.options as [string, ...string[]])).transform((list) => [...new Set(list)]);
    case 'yesno':
      return z.boolean();
    case 'text':
      return z.string().max(spec.max);
  }
};

const settingSchema = (key: PermissionKey) => {
  const spec: PermissionSpec = PERMISSIONS[key];
  return z
    .object({
      on: spec.always ? z.literal(true) : z.boolean(),
      values: z.object(Object.fromEntries(Object.entries(spec.values).map(([name, value]) => [name, valueSchema(value)]))).strict(),
    })
    .strict();
};

/** The Permissions of a Permission group as identity accepts them: every key, every value of its kind. */
export const permissionsSchema = z
  .object(Object.fromEntries(PERMISSION_KEYS.map((key) => [key, settingSchema(key)])) as Record<PermissionKey, ReturnType<typeof settingSchema>>)
  .strict() as unknown as z.ZodType<Permissions>;

/**
 * Permissions as they come, from a token or an older group: every key Data Hub knows, a key that is
 * missing or wrong filled with no, so that a Permission added later is never granted by accident.
 */
export function completePermissions(given: unknown): Permissions {
  const source = given && typeof given === 'object' ? (given as Record<string, unknown>) : {};
  const result = structuredClone(NO_PERMISSIONS);
  for (const key of PERMISSION_KEYS) {
    const parsed = settingSchema(key).safeParse(source[key]);
    if (parsed.success) result[key] = parsed.data as PermissionSetting;
  }
  return result;
}

/** Whether a User may do what a Permission allows: always for one always on. */
export function can(permissions: Permissions, key: PermissionKey): boolean {
  return 'always' in PERMISSIONS[key] || permissions[key]?.on === true;
}

/** A value of a Permission. */
export function permissionValue(permissions: Permissions, key: PermissionKey, name: string): PermissionValue | undefined {
  return permissions[key]?.values[name];
}

/** How far a Permission reaches, when it is yes: their Owner Units, or every asset; null when it is no. */
export function reach(permissions: Permissions, key: PermissionKey): 'theirs' | 'every' | null {
  if (!can(permissions, key)) return null;
  return permissionValue(permissions, key, 'reach') === 'every' ? 'every' : 'theirs';
}

/** Whether a Permission is yes and one of its several choices holds an option. */
export function canWith(permissions: Permissions, key: PermissionKey, name: string, option: string): boolean {
  const value = permissionValue(permissions, key, name);
  return can(permissions, key) && Array.isArray(value) && value.includes(option);
}

/** What a User sees of the catalogue (DEC-PL-02). */
export function sees(permissions: Permissions): 'theirs' | 'public' | 'all' {
  const see = permissionValue(permissions, 'catalogue.see', 'see');
  return see === 'all' || see === 'public' ? see : 'theirs';
}

/** The ranges of one run of a User, in bytes (DEC-SR-29): free up to, approved up to, and what happens above. */
export function rangesOf(permissions: Permissions): { approve: number; request: number; above: 'request' | 'refuse' } {
  const free = Number(permissionValue(permissions, 'runs.ranges', 'freeMb') ?? RANGES.freeMb);
  const approve = Number(permissionValue(permissions, 'runs.ranges', 'approveGb') ?? RANGES.approveGb);
  return {
    approve: Math.round(free * 1_000_000),
    request: Math.max(Math.round(approve * 1_000_000_000), Math.round(free * 1_000_000)),
    above: permissionValue(permissions, 'runs.ranges', 'above') === 'refuse' ? 'refuse' : 'request',
  };
}
