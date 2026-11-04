import { type GapScope, hasScope, scopeText } from '@datahub/contracts/gaps';
import { curate, SUMMARY, type SummaryPart, WEIGHT_MEANS, type Weight, WEIGHTS } from '@datahub/contracts/summary';

/** What the Summary of a Resource is made of, as the MCP reads it from catalogue and query. */
export interface SummaryFacts {
  displayName: string;
  key: string;
  levelName: string;
  published: boolean;
  page: string;
  collection: { name: string; owner: string } | null;
  description: string;
  fields: { name: string }[];
  card: {
    businessDescription: string;
    intendedUse: string;
    pitfalls: string;
    /** Each with where it holds, when narrowed down (FR-RC-24). */
    knownGaps: { text: string; scope?: GapScope | null }[];
    reliableSince: string | null;
    keyFields: string[];
    parameters: string[];
  };
  details: {
    partition: { field: string; unit: string | null } | null;
    clusterBy: string[];
    grain: string[];
    grainSentence: string;
    modelType: string | null;
  };
  storage: { size?: string; partitions?: number | null } | null;
  publication: { publishedAt: string; publishedBy: string; confirmedAt: string; confirmedBy: string } | null;
  deprecation: { reason: string; insteadOf: { displayName: string } | null } | null;
  changes: { field: string; change: string }[];
  /** The threads on the Resource, the newest first, with their replies. */
  threads: Thread[];
  /** Its Log, the newest first. */
  log: { text: string; at: string }[];
  /** What it joins: per identity, the Resources that carry it too. */
  related: { field: string; identity: string; resources: { displayName: string }[] }[];
}

interface Said {
  writer: { name: string; as: string | null } | null;
  params: Record<string, string>;
  createdAt: string;
}

interface Thread extends Said {
  kind: string;
  state: string | null;
  replies: (Said & { kind: string })[];
}

const day = (at: string) => at.slice(0, 10);
const upper = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
const ROLE: Record<string, string> = { owner: 'Owner', dataTeam: 'Data Team' };
const KIND: Record<string, string> = { question: 'Question', remark: 'Remark', signal: 'Signal' };

/**
 * A line of a part of the Summary. Claude reads its text; the MCP App draws it by its kind: a label of where what
 * follows comes from (shown as a chip, when it has one to show), Markdown, an item of a list, or a reply under an item.
 */
export interface SummaryLine {
  text: string;
  kind?: 'label' | 'markdown' | 'item' | 'reply';
  /** What the MCP App shows of a label, such as "From dbt"; nothing when left out. */
  shown?: string;
}

/** A part of the Summary with something in it, as Claude and the MCP App read it (FR-CL-25, FR-CL-26). */
export interface SummaryBlock {
  part: SummaryPart;
  weight: Weight;
  /** The name of its weight, such as "Read first", and its rank among the four, 1 to 4, for the MCP App to draw. */
  weightName: string;
  rank: number;
  /** Its number in the order to read; a deprecation, which comes first, has none. */
  number: number | null;
  title: string;
  lines: SummaryLine[];
}

/** A thread as an item, with what the Owner and the Data Team answered under it as replies. */
function threadLines(thread: Thread): SummaryLine[] {
  const role = (said: Said) => (said.writer?.as && ROLE[said.writer.as] ? `, ${ROLE[said.writer.as]}` : '');
  const state = thread.state ? `, ${thread.state}` : '';
  const lines: SummaryLine[] = [{ kind: 'item', text: `${KIND[thread.kind] ?? thread.kind}${state}, ${thread.writer?.name ?? ''}${role(thread)}, ${day(thread.createdAt)}: ${thread.params.text ?? ''}` }];
  for (const reply of thread.replies) {
    // Its closing says who closed it and why, whoever closed it (FR-CV-16); an answer only from the Owner Unit or the Data Team.
    if (reply.kind === 'closing') lines.push({ kind: 'reply', text: `Closed by ${reply.writer?.name ?? ''}${role(reply)}, ${day(reply.createdAt)}${reply.params.text ? `: ${reply.params.text}` : '.'}` });
    else if (reply.writer?.as && ROLE[reply.writer.as]) lines.push({ kind: 'reply', text: `${reply.writer.name}${role(reply)}, ${day(reply.createdAt)}: ${reply.params.text ?? ''}` });
  }
  return lines;
}

/** The title of each part, as the page names it. */
const TITLE: Record<SummaryPart, string> = {
  deprecated: 'Deprecated',
  whatItIs: 'What it is',
  oneRow: 'One row is',
  useFor: 'Use it for',
  queryCheaply: 'How to query it cheaply',
  joins: 'What it joins',
  fields: 'Its fields',
  watchOut: 'Watch out',
  knownGaps: 'Known Gaps',
  qa: 'Q&A of the Owner and the Data Team',
  standing: 'Where it stands',
  colleagues: 'What colleagues noted',
  changes: 'What changed lately',
};

/**
 * The parts of the Summary of a Resource (FR-CL-25): in the order of the Summary, each with its weight (DEC-RC-17); a part
 * with nothing in it is left out, as on the page. Claude reads them as text, the MCP App draws them (FR-CL-26).
 */
export function summaryParts(given: SummaryFacts): SummaryBlock[] {
  // A piece that catalogue or query did not give leaves its part out, never the Summary.
  const facts: SummaryFacts = {
    ...given,
    fields: given.fields ?? [],
    details: given.details ?? { partition: null, clusterBy: [], grain: [], grainSentence: '', modelType: null },
    publication: given.publication ?? null,
    deprecation: given.deprecation ?? null,
    changes: given.changes ?? [],
  };
  const { card, details, storage } = facts;
  const { qa, colleagues } = curate(facts.threads);
  const plain = (text: string): SummaryLine => ({ text });
  const item = (text: string): SummaryLine => ({ kind: 'item', text });
  const gap: SummaryLine = { text: '' };
  const body: Record<SummaryPart, SummaryLine[]> = {
    deprecated: facts.deprecation ? [plain(`${facts.deprecation.reason}${facts.deprecation.insteadOf ? ` Use ${facts.deprecation.insteadOf.displayName} instead.` : ''} It still works.`)] : [],
    whatItIs: [
      ...(card.businessDescription ? [{ kind: 'label', text: 'Business Description, from the Owner, in Markdown:', shown: 'From the Owner' } as SummaryLine, { kind: 'markdown', text: card.businessDescription } as SummaryLine, gap] : []),
      ...(facts.description ? [{ kind: 'label', text: 'Description, from dbt:', shown: 'From dbt' } as SummaryLine, plain(facts.description)] : []),
    ],
    oneRow:
      details.grain.length || details.modelType
        ? [
            plain(
              [
                details.grain.length ? `${upper(details.grainSentence || details.grain.join(' × '))} (${details.grain.join(', ')})` : '',
                details.modelType ? `Model type: ${details.modelType}` : '',
              ]
                .filter(Boolean)
                .join('. ') + '.',
            ),
          ]
        : [],
    useFor: card.intendedUse ? [{ kind: 'label', text: 'Intended use, from the Owner, in Markdown:' }, { kind: 'markdown', text: card.intendedUse }] : [],
    queryCheaply: [
      ...(details.partition ? [plain(`Partitioned by ${details.partition.field}${details.partition.unit ? `, a partition per ${details.partition.unit}` : ''}${storage?.partitions ? `, ${storage.partitions} partitions` : ''}: always filter on it.`)] : []),
      ...(details.clusterBy.length ? [plain(`Clustered by ${details.clusterBy.join(', then ')}.`)] : []),
      ...(storage?.size ? [plain(`Size: ${storage.size}.`)] : []),
      ...(card.keyFields.length ? [plain(`Key fields: ${card.keyFields.join(', ')}.`)] : []),
      ...(card.parameters.length ? [plain(`Parameters: ${card.parameters.join(', ')}.`)] : []),
    ],
    joins: facts.related
      .filter((entry) => entry.resources.length > 0)
      .map((entry) => item(`${entry.identity} on ${entry.field}: ${entry.resources.map((resource) => resource.displayName).join(', ')}`)),
    fields: facts.fields.length ? [plain(`${facts.fields.length} fields, each in \`fields\` with its type, its Business Description and its description from dbt.`)] : [],
    watchOut: [
      ...(card.pitfalls ? [{ kind: 'label', text: 'Pitfalls, from the Owner, in Markdown:' } as SummaryLine, { kind: 'markdown', text: card.pitfalls } as SummaryLine, gap] : []),
      ...(card.reliableSince ? [plain(`Reliable since ${card.reliableSince}: do not read earlier data as reliable.`)] : []),
    ],
    knownGaps: card.knownGaps.map((known) => item(`${known.text}${hasScope(known.scope) ? ` ${scopeText(known.scope)}` : ''}`)),
    qa: qa.flatMap(threadLines),
    standing: [
      plain(
        [
          facts.levelName,
          facts.publication ? `published ${day(facts.publication.publishedAt)} by ${facts.publication.publishedBy}, confirmed ${day(facts.publication.confirmedAt)} by ${facts.publication.confirmedBy}` : 'not published',
        ].join(', ') + '.',
      ),
      ...(facts.changes.length ? [plain(`Changed since its last Confirmation: ${facts.changes.map((change) => `${change.field} ${change.change}`).join(', ')}.`)] : []),
    ],
    colleagues: colleagues.flatMap(threadLines),
    changes: facts.log.slice(0, 5).map((entry) => item(`${day(entry.at)}: ${entry.text}`)),
  };
  let number = 0;
  return SUMMARY.filter(({ part }) => body[part].length > 0).map(({ part, weight }) => ({
    part,
    weight,
    weightName: WEIGHT_MEANS[weight].name,
    rank: WEIGHTS.indexOf(weight) + 1,
    number: part === 'deprecated' ? null : ++number,
    title: TITLE[part],
    lines: body[part],
  }));
}

/** A line as Claude reads it: an item and a reply under it as a list in Markdown. */
const asText = (line: SummaryLine) => (line.kind === 'item' ? `- ${line.text}` : line.kind === 'reply' ? `  - ${line.text}` : line.text);

/**
 * The Summary of a Resource as Claude reads it (FR-CL-25): its parts in the order of the Summary, each with its weight,
 * and what that weight asks of Claude (DEC-RC-17); a part with nothing in it is left out, as on the page.
 */
export function summaryText(given: SummaryFacts): string {
  const lines = [
    `# ${given.displayName}`,
    `Resource in Data Hub${given.collection ? ` · Collection ${given.collection.name} · Owner ${given.collection.owner}` : ''} · ${given.levelName} · ${given.published ? 'Published' : 'Not published'}`,
    `Key: ${given.key}`,
    `Page: ${given.page}`,
    '',
    'The Summary of this Resource: read its parts in this order. Each part says its weight:',
    ...WEIGHTS.map((weight: Weight) => `- ${WEIGHT_MEANS[weight].name}: ${WEIGHT_MEANS[weight].asks}`),
  ];
  for (const block of summaryParts(given)) {
    const heading = block.number === null ? block.title : `${block.number}. ${block.title}`;
    lines.push('', `## ${heading} (${WEIGHT_MEANS[block.weight].name.toLowerCase()})`, ...block.lines.map(asText));
  }
  return lines.join('\n');
}
