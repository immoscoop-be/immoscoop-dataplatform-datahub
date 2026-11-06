import { type AccessTokenClaims, can, type PermissionKey, permissionValue, type Permissions, rangesOf, reach, sees } from '@datahub/contracts';
import { bytes } from './context.js';
import type { Permits } from './permits.js';
import { CARD_RULE, NONE_RULE } from './results.js';

/**
 * The server instructions (FR-CL-14): what Data Hub is, its concepts as a User meets them, and the rules
 * Claude follows in it (FR-CL-02 to FR-CL-23). Claude keeps them for the whole conversation.
 */
export const INSTRUCTIONS = `Data Hub is the library of the data of Immoscoop: the one entry point to the data for colleagues and their Claude. You work in it as the signed-in User, with their rights: you see and do exactly what they may in Data Hub, nothing more.

Concepts
- Collection: a functional domain of Immoscoop, such as leads or listings, in which Resources sit together under one Owner Unit, the group that owns it. A Collection is private or public.
- Resource: a table of a dbt project that Data Hub makes available, in one Collection. Its Display Name is how business names it; its Key is its full name in BigQuery.
- Level: how far a Resource is documented and confirmed: 0 · Beta, 1 · Available, 2 · Described, 3 · Confirmed, 4 · Explored, 5 · Monitored. It informs and restricts nothing.
- Publication: its Owner makes a Resource visible to everyone who sees its Collection. It is also the first Confirmation, and it cannot be undone.
- Deprecated: its use is discouraged, with a reason and what to use instead; it still works. Withdrawn: dbt no longer exposes it; only its Owner Unit and the Data Team still see it.
- Data Team: the team that takes data in and makes it a Resource; its Data Admins add Resources to Collections.
- Query: SQL over the Resources a User sees, bounded by the 1 to 10 Resources chosen when it is made. Every query is the User's own, in their panel of Query.
- Pre-flight: what a query reads before it runs. Up to 100 MB it runs; from 100 MB to 1 GB its User approves it; above 1 GB the Data Team accepts a Request first.
- Lens: a query that answers a question that comes back, run with Parameters on its own page.
- Message: a Question, Remark or Signal on a Collection, Resource or Lens. Never private; a Signal says the data seems wrong.
- Learning Card: an explanation in the Learning Centre of Data Hub. Use explain for a concept, rather than a definition of your own.

Rules
1. Name the Level of every Resource you use, and say when it is deprecated, why and what to use instead.
2. Not found means it does not exist or the User may not see it. Say so; never guess at what it might hold.
3. Give the link to the page in Data Hub with what you answer.
4. Before you write a query, call suggest_lenses with its Resources and the question. Offer a Lens that answers it; write a query only when the User wants their own.
5. A query reads only its own Resources. Need another? Make a new query with startedFrom. Check the SQL with check_query until it can run, and fix what the Pre-flight names. Filter on the partition column, and follow the Resource Card, such as a week that is not complete yet.
6. You never approve a run above 100 MB, never send a Request to the Data Team and never publish a Resource: the User does that in the window Data Hub shows, or in Data Hub itself.
7. Before you change anything (a description, a deprecation, changes marked seen, a Message), show the User exactly what you will write, and write only once they agree. Pass what you showed as before, so that Data Hub can tell when a colleague changed it meanwhile.
8. Adding Resources to a Collection, moving them and recording their grain and mappings is the work of the Data Admin, in the web app. Say so, and link to Data Hub.
9. When Data Hub does not answer, say so. Never answer from memory, nor from an earlier answer as if it were current.
10. Data Hub has no exports: show what answers the question, not whole tables.`;

/** The User as the guide reads them: their Permission group and its Permissions (FR-PL-04). */
type Member = Pick<AccessTokenClaims, 'permissionGroup' | 'permissions'>;

/**
 * The instructions for one User: those of Data Hub, and what their Permission group changes for Claude, so that
 * Claude knows it from the start of the conversation (TR-PL-09, FR-CL-28).
 */
export function instructionsFor(user: Member, permits: Permits): string {
  const lines: string[] = [];
  if (!permits.claude) {
    lines.push(
      'Their Permission group does not let them work with Data Hub in Claude: you have no tools of Data Hub for them but who_am_i and how_to_use. Say so when they ask for Data Hub, and point them to Data Hub itself.',
    );
  } else {
    if (!permits.query) lines.push('They do not make queries: find the Lenses that answer their question, which they run on the page of the Lens.');
    if (permits.results === 'card') lines.push(`A result of a query or a Preview shows in a card only. ${CARD_RULE}`);
    if (permits.results === 'none') lines.push(`A result of a query or a Preview is not shown in Claude. ${NONE_RULE}`);
  }
  if (lines.length === 0) return INSTRUCTIONS;
  return `${INSTRUCTIONS}\n\nThis User, of the Permission group ${user.permissionGroup.name}\n${lines.map((line) => `- ${line}`).join('\n')}`;
}

/** Items as a sentence names them: a, b and c. */
const list = (items: string[]): string => (items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`);
/** The several choices of a value of a Permission. */
const several = (permissions: Permissions, key: PermissionKey, name: string): string[] => {
  const value = permissionValue(permissions, key, name);
  return Array.isArray(value) ? value : [];
};
const named = (names: Record<string, string>) => (key: string) => names[key] ?? key;

const SEES = {
  theirs: 'See the Collections of your Owner Units, with what is in them',
  public: 'See the Collections of your Owner Units and every public Collection, with what is in them',
  all: 'See everything in the catalogue, the private Collections of others and the Resources without a Collection included',
};
const ATTRIBUTE = named({
  description: 'the Business Descriptions of a Resource and its fields',
  behaviour: 'its intended use and Anomalies',
  pitfalls: 'its pitfalls',
  availableSince: 'since when it is reliable',
  gaps: 'its Known Gaps',
  keyFields: 'its key fields and Parameters',
  entityMapping: 'its Entity mapping',
});
const KIND = named({ question: 'Questions', remark: 'Remarks', signal: 'Signals' });
const WRITE = named({ descriptions: 'descriptions', messages: 'Messages', deprecations: 'deprecations', changesSeen: 'changes marked seen' });
const TOOL = named({ webhooks: 'webhooks', excelKeys: 'Excel keys', users: 'users', permissionGroups: 'Permission groups' });
const RESULTS = {
  claude: 'Results of queries and Previews reach Claude: it reads their rows and works on them',
  card: 'Results of queries and Previews show in a card only: you see their rows, Claude does not read them',
  none: 'Results of queries and Previews are not shown in Claude: Claude gives the link to open them in Data Hub',
};

/**
 * What the User may do in Data Hub, a line per Permission their group gives them, in the order of the rail
 * (DEC-UX-186): read from their Permissions, never from a role (FR-PL-14). who_am_i and the how-to-use say it.
 */
export function mayDo(permissions: Permissions, permits: Permits): string[] {
  const where = (key: PermissionKey, theirs: string, every: string) => (reach(permissions, key) === 'every' ? every : theirs);
  const ranges = rangesOf(permissions);
  const most = permissionValue(permissions, 'excel.keys', 'most');
  const days = permissionValue(permissions, 'excel.keys', 'lifetimeDays');
  const lines = [
    SEES[sees(permissions)],
    can(permissions, 'collections.make') && (permissionValue(permissions, 'collections.make', 'ownerUnit') === 'any' ? 'Make a Collection, for any group' : 'Make a Collection, for a group you are in'),
    can(permissions, 'collections.manage') && where('collections.manage', 'Change the Collections of your Owner Units', 'Change every Collection'),
    can(permissions, 'resources.assign') && 'Add Resources to Collections, move them, and set their grain and model type, in the web app',
    can(permissions, 'resources.describe') &&
      `Describe ${where('resources.describe', 'the Resources of your Owner Units', 'every Resource')}: ${list(several(permissions, 'resources.describe', 'attributes').map(ATTRIBUTE)) || 'nothing of them'}`,
    can(permissions, 'resources.publish') && 'Publish a Resource of your Owner Units',
    can(permissions, 'resources.deprecate') && `Deprecate ${where('resources.deprecate', 'the Resources of your Owner Units', 'every Resource')}, and undo it`,
    can(permissions, 'resources.preview') && 'Preview a Resource',
    can(permissions, 'queries.make') && 'Make and run queries of your own',
    (can(permissions, 'queries.make') || can(permissions, 'resources.preview')) &&
      `A run reads freely up to ${bytes(ranges.approve)}, up to ${bytes(ranges.request)} once you approve it, and above that ${ranges.above === 'request' ? 'once the Data Team accepts a Request' : 'not at all'}`,
    can(permissions, 'queries.seeOthers') && where('queries.seeOthers', 'See the queries on the Resources of your Owner Units, with who ran them', 'See every query, with who ran it'),
    can(permissions, 'requests.decide') && 'Decide on the Requests to run a large query, Preview or Lens',
    'Find and run the Lenses you see',
    can(permissions, 'lenses.make') && 'Make a query a Lens',
    can(permissions, 'lenses.manage') && where('lenses.manage', 'Change and delete the Lenses of your Owner Units', 'Change and delete every Lens'),
    can(permissions, 'messages.write') && `Write ${list(several(permissions, 'messages.write', 'kinds').map(KIND)) || 'no Messages'}`,
    can(permissions, 'messages.reply') && where('messages.reply', 'Reply to the Messages of others on what your Owner Units hold', 'Reply to every Message you see'),
    can(permissions, 'messages.close') &&
      where('messages.close', 'Close and reopen the Questions and Signals of others on what your Owner Units hold', 'Close and reopen every Question and Signal you see'),
    can(permissions, 'messages.dataTeam') && 'Get and answer the Messages for the Data Team',
    permits.claude
      ? `Work with Data Hub in Claude; Claude writes for you ${list(several(permissions, 'claude.use', 'writes').map(WRITE)) || 'nothing'}, as far as your other Permissions go`
      : 'Not work with Data Hub in Claude: your Permission group does not allow it',
    permits.claude && RESULTS[permits.results],
    can(permissions, 'excel.keys') &&
      `Make Excel keys to fetch the result of a Lens in Excel${typeof most === 'number' ? `, at most ${most}` : ''}${typeof days === 'number' ? `, each lasting ${days} days` : ''}`,
    can(permissions, 'admin.open') && `Open Admin: ${list(several(permissions, 'admin.open', 'tools').map(TOOL)) || 'none of its tools'}`,
  ];
  return lines.filter((line): line is string => typeof line === 'string' && line.length > 0);
}

/**
 * What Claude can do in Data Hub for this User, by what their Permission group lets them do, with example questions
 * and the note of the group for Claude when it has one (FR-CL-16, DEC-CL-09, TR-PL-09). Without Claude, it says so.
 */
export function howToUse(user: Member, permits: Permits, home: string): string {
  const group = user.permissionGroup.name;
  const may = mayDo(user.permissions, permits).map((line) => `- ${line}`);
  if (!permits.claude) {
    return [
      `Your Permission group, ${group}, does not let you work with Data Hub in Claude: Claude cannot find, read or query anything of Data Hub for you. Use Data Hub itself: ${home}`,
      '',
      'What your Permission group lets you do',
      ...may,
    ].join('\n');
  }
  const ranges = rangesOf(user.permissions);
  const look = [
    permits.preview && '- "Show me some rows of last week." Claude opens the Preview in the conversation.',
    permits.query && '- "What share of the credit leads came from partners, per week?" Claude first looks for a Lens, else writes a query of yours, checks it and runs it.',
    !permits.query && '- "Is there a Lens on the share of partner leads?" Claude finds the Lenses that answer it, and you run them on their own page.',
    (permits.query || permits.preview) &&
      `- Up to ${bytes(ranges.approve)} a run goes at once. Above that, you approve it yourself in the window${ranges.above === 'request' ? `; above ${bytes(ranges.request)} you can send a Request to the Data Team` : `, up to ${bytes(ranges.request)}`}.`,
    (permits.query || permits.preview) && permits.results === 'card' && '- Your Permission group shows results in a card only: you see the rows in the window, Claude does not read them. Claude tells you its columns, how many rows and what it read, and can help you raise a Signal.',
    (permits.query || permits.preview) && permits.results === 'none' && '- Your Permission group does not show results in Claude: Claude gives you the link to open them in Data Hub.',
  ];
  const discuss = [
    permits.messageKinds.length > 0
      ? `- "Did anyone ask about this?" or "Ask the Owner why March is missing." Claude shows the Message first, and posts it only once you agree; you write ${list(permits.messageKinds.map(KIND))}.`
      : '- "Did anyone ask about this?" Claude reads the Messages on a Resource with you.',
  ];
  const own = [
    (permits.card.length > 0 || permits.fields) && '- "Write a Business Description for it" or "Describe its fields": Claude shows what it will write, and writes it once you agree.',
    permits.deprecate && '- "Deprecate it, use v2 instead": Claude shows the reason first, and deprecates it once you agree.',
    permits.changesSeen && '- "Mark its changes seen", once you checked them.',
    permits.publish && '- "Publish it": Claude checks it and opens the publication; only you tick the declaration and publish.',
  ];
  const others = [permits.queriesOnResource && '- "Which queries ran on this Resource?"', permits.everyQuery && '- "What did everyone query this week?"'];
  const section = (title: string, lines: (string | false)[]) => {
    const kept = lines.filter((line): line is string => typeof line === 'string' && line.length > 0);
    return kept.length ? ['', title, ...kept] : [];
  };
  return [
    `With Data Hub connected, Claude works with the data as you, with your rights: those of your Permission group, ${group}. Some things to ask:`,
    ...section('Find and read', [
      '- "What can I see in Data Hub?" or "What is there on leads?"',
      '- "What is in Weekly lead volume, and how do I read it?"',
      '- "Where does it come from, and what can I join it with?"',
    ]),
    ...section(permits.query ? 'Look at the data and query it' : 'Look at the data', look),
    ...section('Discuss', discuss),
    ...section('If you are in the Owner Unit of a Collection', own),
    ...section('The queries of others', others),
    ...section('Explain', ['- "What is a Lens?" or "What does the Level mean?" Claude answers with the Learning Cards of Data Hub.']),
    '',
    'What your Permission group lets you do',
    ...may,
    '',
    'What stays in the web app: adding Resources to a Collection, and their grain and mappings.',
    ...(permits.note ? ['', `A note for Claude from the Permission group ${group}: ${permits.note}`] : []),
  ].join('\n');
}
