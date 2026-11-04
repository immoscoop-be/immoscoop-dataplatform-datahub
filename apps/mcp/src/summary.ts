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

/** A thread in a line, with what the Owner and the Data Team answered under it. */
function threadLines(thread: Thread): string[] {
  const role = (said: Said) => (said.writer?.as && ROLE[said.writer.as] ? `, ${ROLE[said.writer.as]}` : '');
  const state = thread.state ? `, ${thread.state}` : '';
  const lines = [`- ${KIND[thread.kind] ?? thread.kind}${state}, ${thread.writer?.name ?? ''}${role(thread)}, ${day(thread.createdAt)}: ${thread.params.text ?? ''}`];
  for (const reply of thread.replies) {
    if (reply.writer?.as && ROLE[reply.writer.as]) lines.push(`  - ${reply.writer.name}${role(reply)}, ${day(reply.createdAt)}: ${reply.params.text ?? ''}`);
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
 * The Summary of a Resource as Claude reads it (FR-CL-25): its parts in the order of the Summary, each with its weight,
 * and what that weight asks of Claude (DEC-RC-17); a part with nothing in it is left out, as on the page.
 */
export function summaryText(given: SummaryFacts): string {
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
  const body: Record<SummaryPart, string[]> = {
    deprecated: facts.deprecation ? [`${facts.deprecation.reason}${facts.deprecation.insteadOf ? ` Use ${facts.deprecation.insteadOf.displayName} instead.` : ''} It still works.`] : [],
    whatItIs: [
      ...(card.businessDescription ? ['Business Description, from the Owner, in Markdown:', card.businessDescription, ''] : []),
      ...(facts.description ? ['Description, from dbt:', facts.description] : []),
    ],
    oneRow:
      details.grain.length || details.modelType
        ? [
            [
              details.grain.length ? `${upper(details.grainSentence || details.grain.join(' × '))} (${details.grain.join(', ')})` : '',
              details.modelType ? `Model type: ${details.modelType}` : '',
            ]
              .filter(Boolean)
              .join('. ') + '.',
          ]
        : [],
    useFor: card.intendedUse ? ['Intended use, from the Owner, in Markdown:', card.intendedUse] : [],
    queryCheaply: [
      ...(details.partition ? [`Partitioned by ${details.partition.field}${details.partition.unit ? `, a partition per ${details.partition.unit}` : ''}${storage?.partitions ? `, ${storage.partitions} partitions` : ''}: always filter on it.`] : []),
      ...(details.clusterBy.length ? [`Clustered by ${details.clusterBy.join(', then ')}.`] : []),
      ...(storage?.size ? [`Size: ${storage.size}.`] : []),
      ...(card.keyFields.length ? [`Key fields: ${card.keyFields.join(', ')}.`] : []),
      ...(card.parameters.length ? [`Parameters: ${card.parameters.join(', ')}.`] : []),
    ],
    joins: facts.related
      .filter((entry) => entry.resources.length > 0)
      .map((entry) => `- ${entry.identity} on ${entry.field}: ${entry.resources.map((resource) => resource.displayName).join(', ')}`),
    fields: facts.fields.length ? [`${facts.fields.length} fields, each in \`fields\` with its type, its Business Description and its description from dbt.`] : [],
    watchOut: [
      ...(card.pitfalls ? ['Pitfalls, from the Owner, in Markdown:', card.pitfalls, ''] : []),
      ...(card.reliableSince ? [`Reliable since ${card.reliableSince}: do not read earlier data as reliable.`] : []),
    ],
    knownGaps: card.knownGaps.map((gap) => `- ${gap.text}${hasScope(gap.scope) ? ` ${scopeText(gap.scope)}` : ''}`),
    qa: qa.flatMap(threadLines),
    standing: [
      [
        facts.levelName,
        facts.publication ? `published ${day(facts.publication.publishedAt)} by ${facts.publication.publishedBy}, confirmed ${day(facts.publication.confirmedAt)} by ${facts.publication.confirmedBy}` : 'not published',
      ].join(', ') + '.',
      ...(facts.changes.length ? [`Changed since its last Confirmation: ${facts.changes.map((change) => `${change.field} ${change.change}`).join(', ')}.`] : []),
    ],
    colleagues: colleagues.flatMap(threadLines),
    changes: facts.log.slice(0, 5).map((entry) => `- ${day(entry.at)}: ${entry.text}`),
  };

  const lines = [
    `# ${facts.displayName}`,
    `Resource in Data Hub${facts.collection ? ` · Collection ${facts.collection.name} · Owner ${facts.collection.owner}` : ''} · ${facts.levelName} · ${facts.published ? 'Published' : 'Not published'}`,
    `Key: ${facts.key}`,
    `Page: ${facts.page}`,
    '',
    'The Summary of this Resource: read its parts in this order. Each part says its weight:',
    ...WEIGHTS.map((weight: Weight) => `- ${WEIGHT_MEANS[weight].name}: ${WEIGHT_MEANS[weight].asks}`),
  ];
  let number = 0;
  for (const { part, weight } of SUMMARY) {
    const text = body[part];
    if (text.length === 0) continue;
    const heading = part === 'deprecated' ? TITLE[part] : `${++number}. ${TITLE[part]}`;
    lines.push('', `## ${heading} (${WEIGHT_MEANS[weight].name.toLowerCase()})`, ...text);
  }
  return lines.join('\n');
}
