import { can, canWith, type Permissions, permissionValue, reach } from '@datahub/contracts';

/**
 * What the MCP server offers a User, read once from the Permissions of their Permission group (TR-PL-09, FR-PL-14).
 * The server registers only the tools a User may use, so that Claude never offers what is not theirs; the services
 * still refuse whatever a User may not do. Every tool reads its decision from here, never from a role.
 */

/** How a result of a query or a Preview reaches Claude (FR-CL-28, DEC-PL-05): in Claude, in a card only, or not in Claude. */
export type Results = 'claude' | 'card' | 'none';

/** What Claude may write for a User, as the several choices of `claude.use` name them. */
export type ClaudeWrite = 'descriptions' | 'messages' | 'deprecations' | 'changesSeen';

/** The attributes of a Resource as `resources.describe` names them, for each part of the Resource Card Claude writes. */
export const CARD_ATTRIBUTES = {
  businessDescription: 'description',
  intendedUse: 'behaviour',
  pitfalls: 'pitfalls',
  knownGaps: 'gaps',
  reliableSince: 'availableSince',
  keyFields: 'keyFields',
  parameters: 'keyFields',
} as const;

export type CardKey = keyof typeof CARD_ATTRIBUTES;

export interface Permits {
  /** `claude.use`: whether they work with Data Hub in Claude at all; without it, only who_am_i and how_to_use. */
  claude: boolean;
  /** `claude.results`: how a result reaches Claude. */
  results: Results;
  /** `queries.make`: make, check, run and change queries of their own. */
  query: boolean;
  /** `queries.outside`: a power user also reads the tables Data Hub knows that are no Resource, also without Resources (FR-SR-56). */
  outside: boolean;
  /** Read queries: their own, with `queries.make`, or those of others, with `queries.seeOthers`. */
  readQueries: boolean;
  /** `queries.seeOthers` on every query: list_queries with everyone (DEC-CL-12). */
  everyQuery: boolean;
  /** `queries.seeOthers`: the queries and Lenses that read a Resource, with who ran them. */
  queriesOnResource: boolean;
  /** `resources.preview`. */
  preview: boolean;
  /** The parts of the Resource Card Claude may write for them: `claude.use` descriptions and `resources.describe`. */
  card: CardKey[];
  /** The Business Description of fields: the attribute description of `resources.describe`. */
  fields: boolean;
  /** Mark the changes of a Resource seen: `claude.use` changesSeen and the attribute description. */
  changesSeen: boolean;
  /** The kinds of Message Claude may place for them: `claude.use` messages and `messages.write`. */
  messageKinds: string[];
  /** Reply to a Message through Claude: `claude.use` messages; on those of others only with `messages.reply`. */
  reply: boolean;
  /** `messages.reply`: also on the Messages of others. */
  replyToOthers: boolean;
  /** Deprecate and undeprecate: `claude.use` deprecations and `resources.deprecate`. */
  deprecate: boolean;
  /** `resources.publish`: open the publication, which only the User confirms (DEC-CL-07). */
  publish: boolean;
  /** The note of their Permission group for Claude, given with the how-to-use; empty when it has none. */
  note: string;
}

/**
 * How a result reaches Claude, as `claude.results` of the Permission group says. A value Data Hub does not know
 * counts as the narrowest, not in Claude, as a Permission it lacks counts as no (TR-PL-05).
 */
export function resultsOf(permissions: Permissions): Results {
  const show = permissionValue(permissions, 'claude.results', 'show');
  return show === 'claude' || show === 'card' ? show : 'none';
}

/** Whether Claude may write a kind of change for the User: never without `claude.use`. */
export function claudeWrites(permissions: Permissions, kind: ClaudeWrite): boolean {
  return canWith(permissions, 'claude.use', 'writes', kind);
}

/** The attributes of a Resource the User may describe, when `resources.describe` is yes. */
function attributes(permissions: Permissions): string[] {
  const value = permissionValue(permissions, 'resources.describe', 'attributes');
  return can(permissions, 'resources.describe') && Array.isArray(value) ? value : [];
}

/** The decisions of the MCP server for a User, from their Permissions (TR-PL-09). */
export function permitsOf(permissions: Permissions): Permits {
  const claude = can(permissions, 'claude.use');
  const described = claudeWrites(permissions, 'descriptions') ? attributes(permissions) : [];
  const kinds = permissionValue(permissions, 'messages.write', 'kinds');
  const note = permissionValue(permissions, 'claude.use', 'note');
  return {
    claude,
    results: resultsOf(permissions),
    query: can(permissions, 'queries.make'),
    outside: can(permissions, 'queries.make') && can(permissions, 'queries.outside'),
    readQueries: can(permissions, 'queries.make') || can(permissions, 'queries.seeOthers'),
    everyQuery: reach(permissions, 'queries.seeOthers') === 'every',
    queriesOnResource: can(permissions, 'queries.seeOthers'),
    preview: can(permissions, 'resources.preview'),
    card: (Object.keys(CARD_ATTRIBUTES) as CardKey[]).filter((key) => described.includes(CARD_ATTRIBUTES[key])),
    fields: described.includes('description'),
    changesSeen: claudeWrites(permissions, 'changesSeen') && attributes(permissions).includes('description'),
    messageKinds: claudeWrites(permissions, 'messages') && can(permissions, 'messages.write') && Array.isArray(kinds) ? kinds : [],
    // A User always replies in their own Questions and Signals; messages.reply adds those of others.
    reply: claudeWrites(permissions, 'messages'),
    replyToOthers: can(permissions, 'messages.reply'),
    deprecate: claudeWrites(permissions, 'deprecations') && can(permissions, 'resources.deprecate'),
    publish: can(permissions, 'resources.publish'),
    note: claude && typeof note === 'string' ? note.trim() : '',
  };
}
