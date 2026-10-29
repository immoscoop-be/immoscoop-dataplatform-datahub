import type { LearningCardFit, MessageButton, MessageItem, MessageParameter, MessageType, SubjectKind } from './messages.js';

/**
 * The Message Catalogue: every type of Message in Data Hub, who sends it and who receives it, its
 * texts, its Learning Card and what it asks (DEC-CV-07, FR-CV-10). It is the source of
 * docs/requirements/functional/message-catalogue.md, which `pnpm docs:build` generates from it.
 *
 * A Message ID is fixed: never renumbered or reused. `MSG-CNV` is a Message on any object, the other
 * prefixes name the kind of its object: `COL` a Collection, `RES` a Resource, `LEN` a Lens, `QRY` a
 * query, `RPT` a Report. Templates use `{name}` for a value and the ICU forms `{name, select, …}` and
 * `{name, plural, …}`; a choice stays on one line.
 */

const lines = (...parts: string[]): string => parts.join('\n');

/** Every kind of object takes a Question, a Remark and a reply (FR-CV-07, FR-LR-06). */
const ANY_OBJECT: readonly SubjectKind[] = ['collection', 'resource', 'lens', 'query', 'learningCard'];

const OPEN_IN_CONTEXT: MessageButton = {
  label: { nl: 'Openen in context', en: 'Open in context' },
  opens: 'The page of its object as it is, with the Message in a floating window over it (FR-CV-09)',
};

const ACCEPT: MessageButton = {
  label: { nl: 'Aanvaarden', en: 'Accept' },
  opens: 'Decides in the floating window: the Lens is published, or the query may run',
  for: ['dataTeam'],
};

const REFUSE: MessageButton = {
  label: { nl: 'Weigeren', en: 'Refuse' },
  opens: 'Decides in the floating window, after a reason, which is needed for a refusal',
  for: ['dataTeam'],
};

const OPEN_RESOURCE: MessageButton = {
  label: { nl: 'Resource openen', en: 'Open the resource' },
  opens: 'The page of the Resource',
};

/** What a query reads has no card of its own yet: the ranges of DEC-SR-29 are new. */
const SIZE_CARD: LearningCardFit = {
  fit: 'toWrite',
  topic: 'What a query reads: partitions, the Pre-flight and its three ranges',
  nearest: { number: 'K2.3', title: 'BigQuery' },
  why: 'The Message is about how much a query reads; no card of the master learning plan explains the three ranges of DEC-SR-29 and why a Lens waits for the Data Team.',
};

const SIZE: readonly MessageParameter[] = [
  { name: 'reads', type: 'size', about: 'What one run reads, in bytes' },
  { name: 'threshold', type: 'size', about: 'The threshold it is above, in bytes: 100 MB for large and 1 GB for very large, to start with (DEC-SR-29)' },
];

/** BigQuery tells the partitions a run reads only for some tables, so a line that holds them may be left out. */
const PARTITIONS: readonly MessageParameter[] = [
  { name: 'partitions', type: 'count', about: 'How many partitions one run reads, when BigQuery tells', optional: true },
  { name: 'partitionsTotal', type: 'count', about: 'How many partitions there are, when BigQuery tells', optional: true },
];

/** A field added, removed, renamed or retyped since the last Confirmation (FR-MR-12). */
const FIELD_CHANGES: MessageItem = {
  fields: [
    { name: 'field', type: 'name', about: 'The field, by its name now' },
    { name: 'change', type: 'choice', about: 'What happened to it', values: ['added', 'removed', 'renamed', 'retyped'] },
    { name: 'old', type: 'name', about: 'Its former name, or its former type', optional: true },
    { name: 'new', type: 'name', about: 'Its new type', optional: true },
  ],
  text: {
    nl: {
      plain: '{field} {change, select, added {toegevoegd} removed {verwijderd} renamed {hernoemd, was {old}} other {van type {old} naar {new}}}',
      rich: '- `{field}`: {change, select, added {toegevoegd} removed {verwijderd} renamed {hernoemd; het heette `{old}`} other {het type veranderde van `{old}` naar `{new}`}}',
    },
    en: {
      plain: '{field} {change, select, added {added} removed {removed} renamed {renamed, was {old}} other {retyped from {old} to {new}}}',
      rich: '- `{field}`: {change, select, added {added} removed {removed} renamed {renamed; it was `{old}`} other {its type changed from `{old}` to `{new}`}}',
    },
  },
};

/** What a Broken Lens or query reads that no longer exists: a Resource, or a column of one (DEC-DH-67). */
const MISSING: MessageItem = {
  fields: [
    { name: 'kind', type: 'choice', about: 'What no longer exists', values: ['resource', 'column'] },
    { name: 'resource', type: 'object', about: 'The Resource, or the Resource of the column' },
    { name: 'column', type: 'name', about: 'The column, when a column is missing', optional: true },
  ],
  text: {
    nl: {
      plain: '{kind, select, resource {de resource {resource}} other {de kolom {column} van {resource}}}',
      rich: '- {kind, select, resource {de resource {resource}} other {de kolom `{column}` van {resource}}}',
    },
    en: {
      plain: '{kind, select, resource {the resource {resource}} other {the column {column} of {resource}}}',
      rich: '- {kind, select, resource {the resource {resource}} other {the column `{column}` of {resource}}}',
    },
  },
};

const BROKEN: readonly MessageParameter[] = [
  { name: 'since', type: 'date', about: 'The day of the dbt run, the daily check or the failed run that found it' },
  { name: 'count', type: 'count', about: 'How many Resources and columns it reads are missing' },
  { name: 'missing', type: 'list', about: 'Every Resource and column it reads that no longer exists; what goes missing later joins it', item: MISSING },
];

/** No card explains yet what happens downstream when a Resource or a column disappears. */
const BROKEN_CARD: LearningCardFit = {
  fit: 'toWrite',
  topic: 'When what you read disappears: Broken, the red dot, and how it works again',
  nearest: { number: 'K5.1', title: 'What a resource is' },
  why: 'The Message is about a Resource or a column that no longer exists, and what that does to everything built on it (DEC-DH-67).',
};

const BROKEN_STATES = ['broken', 'works again'];

export const MESSAGE_CATALOGUE: readonly MessageType[] = [
  // Messages a person writes, on any object: the text is theirs; the catalogue holds the frame of
  // it wherever it shows outside its object, such as a notification.
  {
    id: 'MSG-CNV-01',
    title: 'Question',
    kind: 'question',
    subjects: ANY_OBJECT,
    from: 'user',
    to: ['owner', 'participants'],
    when: 'A User asks something about an object, from "Messages" on its page, or with "Ask a question" on a Resource.',
    status: 'Implemented',
    sources: ['FR-CV-03', 'FR-CV-07', 'FR-SR-29', 'FR-LR-06'],
    parameters: [],
    text: {
      nl: {
        plain: '{writer} stelde een vraag over de {subjectKind} {subject}: “{text}”',
        rich: lines('**{writer}** stelde een vraag over de {subjectKind} {subject}', '', '> {text}'),
      },
      en: {
        plain: '{writer} asked a question about the {subjectKind} {subject}: “{text}”',
        rich: lines('**{writer}** asked a question about the {subjectKind} {subject}', '', '> {text}'),
      },
    },
    learningCard: { fit: 'byWriter', why: 'Whoever answers can add the card that explains the answer (FR-LR-07).' },
    action: {
      asks: 'answer',
      of: ['owner'],
      what: 'Who answers for the object answers it in context, with the object in view. Any colleague who may see the object can answer too (FR-CV-05).',
      buttons: [OPEN_IN_CONTEXT],
      states: ['open', 'answered'],
      done: 'The first reply makes it answered and notifies its writer (MSG-CNV-04).',
    },
    example: {
      writer: 'Karel Leys',
      subjectKind: 'lens',
      subject: 'Leads per source name',
      text: 'Mailing brings only 3.8% of the leads this year; last year it was close to 10%. Did something change in how mailing leads are tagged?',
    },
  },
  {
    id: 'MSG-CNV-02',
    title: 'Remark',
    kind: 'remark',
    subjects: ANY_OBJECT,
    from: 'user',
    to: ['owner', 'participants'],
    when: 'A User leaves a remark or a tip on an object, from "Messages" on its page.',
    status: 'Implemented',
    sources: ['FR-CV-03', 'FR-CV-07', 'FR-SR-29', 'FR-LR-06', 'DEC-CV-09'],
    parameters: [],
    text: {
      nl: {
        plain: '{writer} schreef een opmerking bij de {subjectKind} {subject}: “{text}”',
        rich: lines('**{writer}** schreef een opmerking bij de {subjectKind} {subject}', '', '> {text}'),
      },
      en: {
        plain: '{writer} left a remark on the {subjectKind} {subject}: “{text}”',
        rich: lines('**{writer}** left a remark on the {subjectKind} {subject}', '', '> {text}'),
      },
    },
    learningCard: {
      fit: 'byWriter',
      why: 'The writer can add a card, as the Data Team does when it tells about a new card or a Quest, on that card (FR-LR-07).',
    },
    action: {
      asks: 'nothing',
      what: 'A Remark informs and asks for nothing; whoever wants to can reply.',
      buttons: [OPEN_IN_CONTEXT],
      done: 'When it is read.',
    },
    example: {
      writer: 'Ruth Aerts',
      subjectKind: 'resource',
      subject: 'Weekly lead volume',
      text: 'For the monthly report, filter on lead_week rather than on the submission date: it reads a tenth of the data.',
    },
  },
  {
    id: 'MSG-CNV-03',
    title: 'Signal',
    kind: 'signal',
    subjects: ['resource', 'lens'],
    from: 'user',
    to: ['owner', 'dataTeam'],
    when: 'A User reports that something seems odd about the data of a Resource or a Lens, from "Messages" on its page.',
    status: 'Implemented',
    sources: ['FR-SR-30', 'FR-CV-03', 'FR-CV-07'],
    openPoints: ['OP-SR-14'],
    parameters: [],
    text: {
      nl: {
        plain: '{writer} gaf een signaal: er lijkt iets vreemd aan de data van de {subjectKind} {subject}. “{text}”',
        rich: lines('**{writer}** gaf een signaal: er lijkt iets vreemd aan de data van de {subjectKind} {subject}', '', '> {text}'),
      },
      en: {
        plain: '{writer} gave a signal: something seems odd in the data of the {subjectKind} {subject}. “{text}”',
        rich: lines('**{writer}** gave a signal: something seems odd in the data of the {subjectKind} {subject}', '', '> {text}'),
      },
    },
    learningCard: {
      fit: 'byWriter',
      why: 'Whoever answers can add a card; for a Signal that turns out to be no error, K4.4 Reporting an error or a doubt explains the way.',
    },
    action: {
      asks: 'act',
      of: ['owner', 'dataTeam'],
      what: 'The Owner and the Data Team look into it. Either replies with what they found, or makes it an Anomaly on the Resource Card, which then holds it (FR-SR-30).',
      buttons: [
        OPEN_IN_CONTEXT,
        {
          label: { nl: 'Maak er een anomalie van', en: 'Make it an anomaly' },
          opens: 'The Known Behaviour of the Resource, with a new Anomaly filled in from the Signal (OP-SR-14)',
          for: ['owner', 'dataTeam'],
        },
      ],
      states: ['open', 'answered', 'anomaly'],
      done: 'A reply answers it; made an Anomaly, it links to the Anomaly. Either notifies its writer.',
    },
    example: {
      writer: 'Karel Leys',
      subjectKind: 'resource',
      subject: 'Weekly lead volume',
      text: 'The count for the source partner dropped to zero in the week of 13 Oct. We usually see about forty leads there.',
    },
  },
  {
    id: 'MSG-CNV-04',
    title: 'Reply',
    kind: 'reply',
    subjects: ANY_OBJECT,
    from: 'user',
    to: ['writer', 'participants'],
    when: 'Someone who may see the object replies to a Message on it.',
    status: 'Implemented',
    sources: ['FR-CV-01', 'FR-CV-03', 'FR-CV-04'],
    parameters: [],
    text: {
      nl: {
        plain: '{writer} antwoordde over de {subjectKind} {subject}: “{text}”',
        rich: lines('**{writer}** antwoordde over de {subjectKind} {subject}', '', '> {text}'),
      },
      en: {
        plain: '{writer} replied about the {subjectKind} {subject}: “{text}”',
        rich: lines('**{writer}** replied about the {subjectKind} {subject}', '', '> {text}'),
      },
    },
    learningCard: { fit: 'byWriter', why: 'A reply is where a card helps most: an answer with the card that explains it (FR-LR-07).' },
    action: {
      asks: 'nothing',
      what: 'A reply answers a Question and asks nothing itself; it can be replied to in turn.',
      buttons: [OPEN_IN_CONTEXT],
      done: 'When it is read.',
    },
    example: {
      writer: 'An Claes',
      subjectKind: 'lens',
      subject: 'Leads per source name',
      text: 'Yes: since March, leads from the newsletter count as mailing only when they come in through its link. The figures before March count more.',
    },
  },
  {
    id: 'MSG-CNV-05',
    title: 'Decision on a Request',
    kind: 'decision',
    subjects: ['lens', 'query'],
    from: 'dataTeam',
    to: ['writer', 'author'],
    when: 'A member of the Data Team accepts or refuses a Request (MSG-LEN-01, MSG-LEN-03, MSG-QRY-01). The decision is its reply.',
    status: 'Implemented',
    sources: ['FR-CV-08', 'FR-LE-09', 'DEC-SR-29', 'DEC-SR-36'],
    parameters: [
      { name: 'outcome', type: 'choice', about: 'The decision', values: ['accepted', 'refused'] },
      { name: 'text', type: 'text', about: 'The reason; needed for a refusal', optional: true },
    ],
    text: {
      nl: {
        plain: lines('{writer} heeft de aanvraag voor de {subjectKind} {subject} {outcome, select, accepted {aanvaard} other {geweigerd}}.', '“{text}”'),
        rich: lines(
          '**{writer} heeft de aanvraag voor de {subjectKind} {subject} {outcome, select, accepted {aanvaard} other {geweigerd}}**',
          '',
          '> {text}',
          '',
          '{outcome, select, accepted {{subjectKind, select, lens {De lens is gepubliceerd.} other {De query mag draaien.}}} other {{subjectKind, select, lens {De lens blijft ongepubliceerd: pas hem aan en stuur hem opnieuw.} other {De query draait niet: laat hem minder lezen en draai hem opnieuw.}}}}',
        ),
      },
      en: {
        plain: lines('{writer} {outcome, select, accepted {accepted} other {refused}} the request on the {subjectKind} {subject}.', '“{text}”'),
        rich: lines(
          '**{writer} {outcome, select, accepted {accepted} other {refused}} the request on the {subjectKind} {subject}**',
          '',
          '> {text}',
          '',
          '{outcome, select, accepted {{subjectKind, select, lens {The lens is published.} other {The query may run.}}} other {{subjectKind, select, lens {The lens stays unpublished: change it and send it again.} other {The query does not run: make it read less and run it again.}}}}',
        ),
      },
    },
    learningCard: { fit: 'byWriter', why: 'The Data Team can add a card to its reason, such as one on what a query reads.' },
    action: {
      asks: 'nothing',
      what: 'It tells the writer of the Request the decision; a refused Lens or query is theirs to change.',
      buttons: [OPEN_IN_CONTEXT],
      done: 'When it is read.',
    },
    example: {
      writer: 'Dirk Vos',
      subjectKind: 'lens',
      subject: 'Credit funnel by region',
      outcome: 'accepted',
      text: 'It reads 31 GB, but it runs once a quarter and nothing smaller answers the question.',
    },
  },
  {
    id: 'MSG-CNV-06',
    title: 'A Request lapsed',
    kind: 'dataHub',
    subjects: ['lens', 'query'],
    from: 'dataHub',
    to: ['writer', 'author'],
    when: 'The Data Team did not decide on a Request within its timeout (DEC-LE-05). A Request has no timeout (DEC-LE-15).',
    status: 'Withdrawn',
    sources: ['DEC-LE-05', 'DEC-LE-15'],
    parameters: [{ name: 'days', type: 'count', about: 'The working days the Data Team had to decide' }],
    text: {
      nl: {
        plain: 'De aanvraag voor de {subjectKind} {subject} is vervallen: het datateam besliste niet binnen {days, plural, one {# werkdag} other {# werkdagen}}.',
        rich: lines(
          '**De aanvraag voor de {subjectKind} {subject} is vervallen**',
          '',
          'Het datateam besliste niet binnen {days, plural, one {# werkdag} other {# werkdagen}}. {subjectKind, select, lens {De lens blijft ongepubliceerd; pas hem aan, of stuur hem opnieuw zoals hij is.} other {De query draaide niet; laat hem minder lezen, of stuur hem opnieuw.}}',
        ),
      },
      en: {
        plain: 'The request on the {subjectKind} {subject} lapsed: the data team did not decide within {days, plural, one {# working day} other {# working days}}.',
        rich: lines(
          '**The request on the {subjectKind} {subject} lapsed**',
          '',
          'The data team did not decide within {days, plural, one {# working day} other {# working days}}. {subjectKind, select, lens {The lens stays unpublished; change it, or send it again as it is.} other {The query did not run; make it read less, or send it again.}}',
        ),
      },
    },
    learningCard: SIZE_CARD,
    action: {
      asks: 'act',
      of: ['writer', 'author'],
      what: 'Its writer changes the Lens or the query, or sends the Request again.',
      buttons: [OPEN_IN_CONTEXT],
      states: ['lapsed', 'sentAgain'],
      done: 'A new Request starts over; the lapsed one stays in the conversation.',
    },
    example: { subjectKind: 'lens', subject: 'Leads per source, all weeks', days: 5 },
  },

  // Collections
  {
    id: 'MSG-COL-01',
    title: 'A Collection has no Owner any more',
    kind: 'dataHub',
    subjects: ['collection'],
    from: 'dataHub',
    to: ['dataTeam'],
    when: 'The Owner Unit of a Collection is dissolved in Workspace, or has no members left, at a Synchronisation.',
    status: 'Withdrawn',
    sources: ['EC-CO-01', 'EC-UM-01', 'EC-UM-04'],
    openPoints: ['OP-MR-04'],
    parameters: [
      { name: 'group', type: 'group', about: 'The Owner Unit it had' },
      { name: 'cause', type: 'choice', about: 'What happened to it', values: ['dissolved', 'empty'] },
    ],
    text: {
      nl: {
        plain: 'De collection {subject} heeft geen owner meer: de owner unit {group} {cause, select, dissolved {werd opgeheven in Workspace} other {heeft geen leden meer}}.',
        rich: lines(
          '**De collection {subject} heeft geen owner meer**',
          '',
          'De owner unit, {group}, {cause, select, dissolved {werd opgeheven in Workspace} other {heeft geen leden meer}}. De resources blijven zoals ze zijn, maar niemand staat er nog voor in tot de collection een nieuwe owner unit heeft. Kies er een met wie het domein overnam.',
        ),
      },
      en: {
        plain: 'The collection {subject} has no owner any more: its owner unit {group} {cause, select, dissolved {was dissolved in Workspace} other {has no members left}}.',
        rich: lines(
          '**The collection {subject} has no owner any more**',
          '',
          'Its owner unit, {group}, {cause, select, dissolved {was dissolved in Workspace} other {has no members left}}. Its resources stay as they are, but nobody vouches for them until the collection has a new owner unit. Choose one with whoever took over the domain.',
        ),
      },
    },
    learningCard: {
      fit: 'proposed',
      card: { number: 'K3.2', title: 'Ownership at Immoscoop' },
      why: 'Who owns what at Immoscoop, and why a Collection needs an Owner that vouches for it.',
    },
    action: {
      asks: 'act',
      of: ['dataTeam'],
      what: 'The Data Team gives the Collection a new Owner Unit, with whoever took over the domain.',
      buttons: [{ label: { nl: 'Collection openen', en: 'Open the collection' }, opens: 'The page of the Collection, at its Owner Unit' }],
      states: ['open', 'resolved'],
      done: 'With a new Owner Unit, it shows the new Owner.',
    },
    example: { subject: 'Agencies', group: 'agency-team', cause: 'dissolved' },
  },

  // Resources
  {
    id: 'MSG-RES-01',
    title: 'A new Resource waits for a Collection',
    kind: 'dataHub',
    subjects: ['resource'],
    from: 'dataHub',
    to: ['dataTeam'],
    when: 'A Registration: a run of a Source Job brings a table that an exposure with the tag `datahub` depends on.',
    per: 'One per Resource, never one per run (DEC-CV-10).',
    status: 'Specified',
    sources: ['FR-SR-10', 'DEC-SR-12', 'DEC-SR-27', 'DEC-CV-10'],
    parameters: [
      { name: 'exposure', type: 'name', about: 'The exposure it came in through' },
      { name: 'project', type: 'name', about: 'The dbt project of the exposure' },
      { name: 'run', type: 'date', about: 'The day of the run of the Source Job' },
    ],
    text: {
      nl: {
        plain: '{subject} kwam binnen via de exposure {exposure} en wacht op een collection.',
        rich: lines(
          '**{subject} kwam binnen via een exposure en wacht op een collection**',
          '',
          'De dbt-run van {run} registreerde hem via de exposure `{exposure}` in `{project}`. Tot het datateam hem aan een collection toevoegt, ziet alleen het datateam hem; daarna neemt de owner van die collection het over.',
        ),
      },
      en: {
        plain: '{subject} came in through the exposure {exposure} and waits for a collection.',
        rich: lines(
          '**{subject} came in through an exposure and waits for a collection**',
          '',
          'The dbt run of {run} registered it through the exposure `{exposure}` in `{project}`. Until the data team adds it to a collection, only the data team sees it; then the owner of that collection takes it from there.',
        ),
      },
    },
    learningCard: {
      fit: 'named',
      card: { number: 'K5.1', title: 'What a resource is' },
      why: 'Named in the design of Messages (DEC-UX-79): how an exposure makes a table a Resource.',
    },
    action: {
      asks: 'act',
      of: ['dataTeam'],
      what: 'The Data Team adds the Resource to a Collection, in Data Hub, never in the dbt project (FR-CO-14, DEC-SR-27).',
      buttons: [{ label: { nl: 'Aan een collection toevoegen', en: 'Add to a collection' }, opens: 'The page of the Resource, waiting, with the choice of a Collection' }],
      states: ['waiting', 'inCollection'],
      done: 'In a Collection, it shows that Collection, and its Owner is told (MSG-RES-08).',
    },
    example: { subject: 'Saved searches', exposure: 'datahub_saved_searches', project: 'immoscoop_dbt', run: '2026-10-26' },
  },
  {
    id: 'MSG-RES-02',
    title: 'Descriptions changed in dbt',
    kind: 'dataHub',
    subjects: ['resource'],
    from: 'dataHub',
    to: ['owner'],
    when: 'An Artifact Set changes the description from dbt of a Resource, or of one of its fields. A Change further upstream stays an entry in the Log (FR-AR-12).',
    per: 'One per Resource and Artifact Set, with every description that changed.',
    status: 'Specified',
    sources: ['FR-RC-17', 'DEC-RC-03', 'FR-LR-38'],
    parameters: [
      { name: 'run', type: 'date', about: 'The day of the run of the Source Job' },
      { name: 'count', type: 'count', about: 'How many descriptions changed' },
      {
        name: 'changes',
        type: 'list',
        about: 'Every description that changed',
        item: {
          fields: [
            { name: 'on', type: 'choice', about: 'Whether it describes the table or a field', values: ['table', 'field'] },
            { name: 'field', type: 'name', about: 'The field, when it describes one', optional: true },
            { name: 'before', type: 'text', about: 'The description from dbt before' },
            { name: 'after', type: 'text', about: 'The description from dbt now' },
            { name: 'hasBusiness', type: 'choice', about: 'Whether a Business Description stands next to it', values: ['yes', 'no'] },
            { name: 'business', type: 'text', about: 'The Business Description next to it', optional: true },
          ],
          text: {
            nl: {
              plain: '{on, select, table {De tabel} other {{field}}}: “{before}” werd “{after}”',
              rich: lines(
                '**{on, select, table {De tabel} other {`{field}`}}**',
                '- Vroeger, in dbt: ~~{before}~~',
                '- Nu, in dbt: {after}',
                '- {hasBusiness, select, yes {Je businessbeschrijving: {business}} other {Je hebt hier geen businessbeschrijving.}}',
              ),
            },
            en: {
              plain: '{on, select, table {The table} other {{field}}}: “{before}” became “{after}”',
              rich: lines(
                '**{on, select, table {The table} other {`{field}`}}**',
                '- Before, in dbt: ~~{before}~~',
                '- Now, in dbt: {after}',
                '- {hasBusiness, select, yes {Your business description: {business}} other {You have no business description here.}}',
              ),
            },
          },
        },
      },
    ],
    text: {
      nl: {
        plain: lines(
          '{count, plural, one {Eén beschrijving} other {# beschrijvingen}} van {subject} {count, plural, one {is} other {zijn}} gewijzigd in dbt. Je businessbeschrijvingen blijven zoals ze zijn, en er wordt niets van je gevraagd.',
          '{changes}',
        ),
        rich: lines(
          '**{count, plural, one {Eén beschrijving} other {# beschrijvingen}} van {subject} {count, plural, one {is} other {zijn}} gewijzigd in dbt**',
          '',
          'Dat gebeurde in de dbt-run van {run}. Je businessbeschrijvingen blijven zoals ze zijn, ernaast: lees ze opnieuw, en pas ze aan waar ze niet meer passen. Er wordt niets van je gevraagd, en het level en de publicatie veranderen niet.',
          '',
          '{changes}',
        ),
      },
      en: {
        plain: lines(
          '{count, plural, one {One description} other {# descriptions}} of {subject} changed in dbt. Your business descriptions stay as they are, and nothing is asked of you.',
          '{changes}',
        ),
        rich: lines(
          '**{count, plural, one {One description} other {# descriptions}} of {subject} changed in dbt**',
          '',
          'It happened in the dbt run of {run}. Your business descriptions stay as they are, next to them: read them again, and change yours where it no longer fits. Nothing is asked of you, and the level and the publication do not change.',
          '',
          '{changes}',
        ),
      },
    },
    learningCard: {
      fit: 'named',
      card: { number: 'K3.4', title: 'Where definitions live' },
      why: 'Named by FR-RC-17: why dbt and the Owner each describe a field, and why to read yours again when the one from dbt changes.',
    },
    action: {
      asks: 'nothing',
      what: 'It asks for no review (DEC-RC-03); the Owner may change their Business Descriptions.',
      buttons: [
        {
          label: { nl: 'Businessbeschrijvingen aanpassen', en: 'Edit business descriptions' },
          opens: 'The Columns tab of the Resource, in editing, with the changed fields marked',
          for: ['owner'],
        },
      ],
      done: 'When it is read.',
    },
    example: {
      subject: 'Weekly lead volume',
      run: '2026-10-25',
      count: 2,
      changes: [
        {
          on: 'table',
          before: 'One row per week and lead source with the number of credit leads sent to KBC. A lead counts in the week it was first submitted.',
          after: 'One row per week and lead source with the number of credit leads sent to KBC. A lead counts in the week it was first submitted, not when it was followed up. Test and duplicate requests are excluded.',
          hasBusiness: 'yes',
          business: 'The number of credit leads we send to KBC each week, per lead source. Use it to follow the trend and to compare sources; it counts leads, not people.',
        },
        {
          on: 'field',
          field: 'lead_count',
          before: 'Number of credit leads sent to KBC',
          after: 'Number of credit leads sent to KBC, without test and duplicate requests',
          hasBusiness: 'no',
        },
      ],
    },
  },
  {
    id: 'MSG-RES-03',
    title: 'The schema changed since the last Confirmation',
    kind: 'dataHub',
    subjects: ['resource'],
    from: 'dataHub',
    to: ['owner'],
    when: 'An Artifact Set adds, removes, renames or retypes a field of a Resource after its last Confirmation.',
    per: 'One per Resource and Artifact Set; all point to its one warning.',
    status: 'Specified',
    sources: ['FR-MR-12', 'DEC-MR-08', 'DEC-DH-66', 'FR-LR-38'],
    parameters: [
      { name: 'confirmed', type: 'date', about: 'The day of its last Confirmation' },
      { name: 'level', type: 'level', about: 'Its Level, which stays' },
      { name: 'count', type: 'count', about: 'How many fields changed' },
      { name: 'changes', type: 'list', about: 'Every field that changed', item: FIELD_CHANGES },
    ],
    text: {
      nl: {
        plain: '{count, plural, one {Een veld} other {# velden}} van {subject} {count, plural, one {is} other {zijn}} gewijzigd sinds je de resource bekrachtigde: {changes}. Het level blijft {level}; markeer de wijziging als gezien op de pagina.',
        rich: lines(
          '**{count, plural, one {Een veld} other {# velden}} van {subject} {count, plural, one {is} other {zijn}} gewijzigd sinds je de resource bekrachtigde op {confirmed}**',
          '',
          '{changes}',
          '',
          'Iedereen die de resource ziet, ziet een waarschuwing met wat er veranderde, tot jij of het datateam die als gezien markeert. Het level blijft {level}, en ook de publicatie: een nieuwe bekrachtiging is niet nodig. Een lens of query die een verwijderd veld nodig heeft, werkt niet meer; je kan de consumenten van de resource verwittigen.',
        ),
      },
      en: {
        plain: '{count, plural, one {A field} other {# fields}} of {subject} changed since you confirmed it: {changes}. Its level stays {level}; mark the change as seen on its page.',
        rich: lines(
          '**{count, plural, one {A field} other {# fields}} of {subject} changed since you confirmed it on {confirmed}**',
          '',
          '{changes}',
          '',
          'Everyone who sees the resource sees a warning with what changed, until you or the data team mark it as seen. Its level stays {level}, and so does its publication: no new confirmation is needed. A lens or a query that needs a removed field stops working; you can tell the consumers of the resource.',
        ),
      },
    },
    learningCard: {
      fit: 'named',
      card: { number: '4.3.2', title: 'Versions and agreements with users' },
      why: 'Named in the design of Messages (DEC-UX-79): what a change means for those who rely on the Resource, and how to agree on it.',
    },
    action: {
      asks: 'act',
      of: ['owner'],
      what: 'The Owner marks the warning seen; the Data Team can too, on the page of the Resource (FR-MR-12). The Owner may tell the Consumers (MSG-RES-07).',
      buttons: [
        { label: { nl: 'Waarschuwing openen', en: 'Open the warning' }, opens: 'The page of the Resource, at its warning' },
        { label: { nl: 'Markeren als gezien', en: 'Mark as seen' }, opens: 'Marks the warning seen, in place' },
        {
          label: { nl: 'Consumenten verwittigen', en: 'Notify the consumers' },
          opens: 'A new notice to the Consumers, with the changes filled in (MSG-RES-07)',
          for: ['owner'],
        },
      ],
      states: ['open', 'seen'],
      done: 'Seen, the warning goes and the Message shows who saw it; changes before that join the same warning (FR-MR-12).',
    },
    example: {
      subject: 'Weekly lead volume',
      confirmed: '2026-09-12',
      level: '4 · Explored',
      count: 2,
      changes: [
        { field: 'lead_channel', change: 'added' },
        { field: 'lead_count', change: 'retyped', old: 'INT64', new: 'NUMERIC' },
      ],
    },
  },
  {
    id: 'MSG-RES-04',
    title: 'The logic changed',
    kind: 'dataHub',
    subjects: ['resource'],
    from: 'dataHub',
    to: ['owner'],
    when: 'An Artifact Set changes the code of the Node of a Resource, or of a Node it depends on: a filter or a join, with the same schema.',
    per: 'One per Resource and Artifact Set.',
    status: 'Specified',
    sources: ['DEC-DH-27', 'DEC-LN-04', 'FR-AR-12'],
    parameters: [
      { name: 'run', type: 'date', about: 'The day of the run of the Source Job' },
      { name: 'node', type: 'name', about: 'The Node whose code changed' },
      { name: 'distance', type: 'count', about: 'How many steps upstream of the Resource that Node is; 0 for its own' },
    ],
    text: {
      nl: {
        plain: 'De logica achter {subject} is gewijzigd in dbt, in {node}. De velden blijven dezelfde; kijk of hun beschrijvingen nog kloppen.',
        rich: lines(
          '**De logica achter {subject} is gewijzigd in dbt**',
          '',
          'De dbt-run van {run} wijzigde de code van `{node}`, {distance, plural, =0 {de tabel van de resource zelf} one {één stap stroomopwaarts} other {# stappen stroomopwaarts}}. De velden blijven dezelfde, maar wat ze bevatten kan verschillen: een filter of een join veranderde. Lees de beschrijvingen opnieuw, de jouwe en die uit dbt. Het level en de publicatie blijven zoals ze zijn.',
        ),
      },
      en: {
        plain: 'The logic behind {subject} changed in dbt, in {node}. Its fields stay the same; check that their descriptions still hold.',
        rich: lines(
          '**The logic behind {subject} changed in dbt**',
          '',
          'The dbt run of {run} changed the code of `{node}`, {distance, plural, =0 {the table of the resource itself} one {one step upstream} other {# steps upstream}}. Its fields stay the same, but what they hold may differ: a filter or a join changed. Read the descriptions again, yours and those from dbt. The level and the publication stay as they are.',
        ),
      },
    },
    learningCard: {
      fit: 'proposed',
      card: { number: '4.3.1', title: 'Changing a definition, keeping trust' },
      why: 'A change in logic changes what a field counts without changing its name.',
    },
    action: {
      asks: 'nothing',
      what: 'The Owner reads the descriptions again, and changes theirs where they no longer fit; nothing more is needed.',
      buttons: [{ label: { nl: 'Geschiedenis openen', en: 'Open the history' }, opens: 'The History tab of the Resource, filtered on Changes' }],
      done: 'When it is read.',
    },
    example: { subject: 'Weekly lead volume', run: '2026-10-25', node: 'int_credit_leads', distance: 1 },
  },
  {
    id: 'MSG-RES-05',
    title: 'The Level dropped',
    kind: 'dataHub',
    subjects: ['resource'],
    from: 'dataHub',
    to: ['owner'],
    when: 'The Level of a Resource drops: a description goes missing, its EDA document is no longer linked, or its last active check is switched off.',
    status: 'Specified',
    sources: ['FR-MR-09', 'DEC-SR-08', 'DEC-MR-08'],
    openPoints: ['OP-MR-04'],
    parameters: [
      { name: 'from', type: 'level', about: 'The Level it had' },
      { name: 'to', type: 'level', about: 'The Level it has now' },
      { name: 'cause', type: 'choice', about: 'Why it dropped', values: ['description', 'eda', 'check'] },
      { name: 'field', type: 'name', about: 'The field without a description, when that is the cause', optional: true },
      { name: 'published', type: 'choice', about: 'Whether it is published', values: ['yes', 'no'] },
    ],
    text: {
      nl: {
        plain: '{subject} is gezakt van {from} naar {to}: {cause, select, description {er ontbreekt een beschrijving} eda {het EDA-document is niet meer gekoppeld} other {de laatste actieve check werd uitgeschakeld}}.',
        rich: lines(
          '**{subject} is gezakt van {from} naar {to}**',
          '',
          '{cause, select, description {Er ontbreekt een beschrijving in dbt, en geen businessbeschrijving vult dat aan.} eda {Het EDA-document is niet meer gekoppeld.} other {De laatste actieve check werd uitgeschakeld.}}',
          '- Veld zonder beschrijving: `{field}`',
          '',
          '{published, select, yes {Hij blijft gepubliceerd, en iedereen die hem ziet, ziet het lagere level: op de resource en op elke lens en elk report die erop steunen. } other {}}Zodra de oorzaak weg is, stijgt hij opnieuw, en je bekrachtiging blijft gelden.',
        ),
      },
      en: {
        plain: '{subject} dropped from {from} to {to}: {cause, select, description {a description is missing} eda {its EDA document is no longer linked} other {its last active check was switched off}}.',
        rich: lines(
          '**{subject} dropped from {from} to {to}**',
          '',
          '{cause, select, description {A description is missing in dbt, and no business description covers it.} eda {Its EDA document is no longer linked.} other {Its last active check was switched off.}}',
          '- Field without a description: `{field}`',
          '',
          '{published, select, yes {It stays published, and everyone who sees it sees the lower level, on the resource and on every lens and report built on it. } other {}}When the cause is gone, it rises again, and your confirmation still holds.',
        ),
      },
    },
    learningCard: {
      fit: 'named',
      card: { number: '4.4.1', title: 'The maturity ladder' },
      why: 'What each Level stands for, and what makes a Resource rise and drop; confirmed on 2026-10-29 (DEC-LR-29).',
    },
    action: {
      asks: 'act',
      of: ['owner'],
      what: 'The Owner takes the cause away: a description, the EDA document or a check. The Publication stays (DEC-SR-08).',
      buttons: [{ label: { nl: 'Naar de oorzaak', en: 'Go to the cause' }, opens: 'The page of the Resource at the cause: the Columns tab, the EDA tab or its checks' }],
      states: ['open', 'restored'],
      done: 'When the Level rises again, it shows that it is restored.',
    },
    example: { subject: 'Weekly lead volume', from: '4 · Explored', to: '1 · Available', cause: 'description', field: 'lead_channel', published: 'yes' },
  },
  {
    id: 'MSG-RES-06',
    title: 'A Resource was withdrawn',
    kind: 'dataHub',
    subjects: ['resource'],
    from: 'dataHub',
    to: ['owner'],
    when: 'An Artifact Set no longer has an exposure with the tag `datahub` that depends on a Resource in a Collection.',
    status: 'Implemented',
    sources: ['DEC-SR-26', 'DEC-CV-12'],
    parameters: [{ name: 'run', type: 'date', about: 'The day of the run of the Source Job' }],
    text: {
      nl: {
        plain: '{subject} werd ingetrokken: geen enkele exposure met de tag datahub steunt er nog op. Alleen het datateam en de owner zien hem nog.',
        rich: lines(
          '**{subject} werd ingetrokken**',
          '',
          'Sinds de dbt-run van {run} steunt geen enkele exposure met de tag `datahub` er nog op. Alleen het datateam en de owner zien hem nog, gemarkeerd als ingetrokken. Hij houdt zijn collection, zijn bekrachtigingen en zijn log, en komt terug zoals hij was zodra een exposure er weer op steunt.',
          '',
          'Was dat niet de bedoeling? Vraag het aan het datateam.',
        ),
      },
      en: {
        plain: '{subject} was withdrawn: no exposure with the tag datahub depends on it any more. Only the data team and its owner still see it.',
        rich: lines(
          '**{subject} was withdrawn**',
          '',
          'Since the dbt run of {run}, no exposure with the tag `datahub` depends on it any more. Only the data team and its owner still see it, marked as withdrawn. It keeps its collection, its confirmations and its log, and comes back as it was when an exposure depends on it again.',
          '',
          'If that was not intended, ask the data team.',
        ),
      },
    },
    learningCard: {
      fit: 'named',
      card: { number: 'K5.1', title: 'What a resource is' },
      why: 'An exposure makes a table a Resource, and so its absence withdraws it; confirmed on 2026-10-29 (DEC-LR-29).',
    },
    action: {
      asks: 'nothing',
      what: 'If it was not intended, the Owner asks the Data Team, which restores the exposure in the dbt project.',
      buttons: [OPEN_RESOURCE],
      done: 'When it is read; the Resource comes back by itself with an exposure (DEC-SR-26).',
    },
    example: { subject: 'Agency reviews', run: '2026-10-27' },
  },
  {
    id: 'MSG-RES-07',
    title: 'The Owner tells the Consumers about a change',
    kind: 'notice',
    subjects: ['resource'],
    from: 'owner',
    to: ['consumers'],
    when: 'The Owner tells the Consumers of a Resource about a change to its fields, from its warning (MSG-RES-03).',
    status: 'Proposed',
    sources: ['FR-LN-02', 'FR-LN-03', 'FR-MR-12'],
    parameters: [
      { name: 'group', type: 'group', about: 'The Owner Unit the writer is in' },
      { name: 'changes', type: 'list', about: 'The fields that changed, filled in from the warning', item: FIELD_CHANGES },
    ],
    text: {
      nl: {
        plain: lines('{writer} van {group} laat je weten dat {subject} gewijzigd is: {changes}.', '“{text}”'),
        rich: lines(
          '**{subject} is gewijzigd**',
          '',
          '{writer} van {group}, de owner, laat het je weten, omdat je de resource gebruikt in een lens of een report.',
          '',
          '> {text}',
          '',
          '{changes}',
        ),
      },
      en: {
        plain: lines('{writer} of {group} tells you that {subject} changed: {changes}.', '“{text}”'),
        rich: lines(
          '**{subject} changed**',
          '',
          '{writer} of {group}, its owner, tells you, as you use the resource in a lens or a report.',
          '',
          '> {text}',
          '',
          '{changes}',
        ),
      },
    },
    learningCard: {
      fit: 'byWriter',
      why: 'The Owner may add a card; 4.3.3 Announcing and phasing out explains how to tell users about a change.',
    },
    action: {
      asks: 'nothing',
      what: 'The Consumers check the Lenses and Reports they built on it, and can reply on the Resource.',
      buttons: [{ label: { nl: 'Resource openen', en: 'Open the resource' }, opens: 'The page of the Resource, at its warning' }],
      done: 'When it is read.',
    },
    example: {
      writer: 'An Claes',
      group: 'credit-team',
      subjectKind: 'resource',
      subject: 'Weekly lead volume',
      text: 'lead_count is now NUMERIC, so that a lead shared by two sources counts half for each. A lens that sums it needs no change.',
      changes: [{ field: 'lead_count', change: 'retyped', old: 'INT64', new: 'NUMERIC' }],
    },
  },
  {
    id: 'MSG-RES-08',
    title: 'A Resource arrived in your Collection',
    kind: 'dataHub',
    subjects: ['resource'],
    from: 'dataHub',
    to: ['owner'],
    when: 'The Data Team adds a Resource to a Collection (FR-CO-14).',
    status: 'Specified',
    sources: ['DEC-SR-27', 'FR-CO-14', 'DEC-SR-07', 'DEC-CV-11'],
    parameters: [
      { name: 'collection', type: 'object', about: 'The Collection it is in now' },
      { name: 'actor', type: 'person', about: 'The member of the Data Team who added it' },
      { name: 'level', type: 'level', about: 'Its Level' },
    ],
    text: {
      nl: {
        plain: '{subject} zit nu in je collection {collection}. Hij staat op {level} en is niet gepubliceerd: alleen je team en het datateam zien hem.',
        rich: lines(
          '**{subject} zit nu in je collection {collection}**',
          '',
          '{actor} van het datateam voegde hem toe. Hij staat op {level} en is nog niet gepubliceerd, dus alleen je team en het datateam zien hem. Lees zijn beschrijvingen, voeg de jouwe toe waar ze helpen, en publiceer hem wanneer hij klopt: publiceren is je eerste bekrachtiging.',
        ),
      },
      en: {
        plain: '{subject} is now in your collection {collection}. It is at {level} and not published: only your team and the data team see it.',
        rich: lines(
          '**{subject} is now in your collection {collection}**',
          '',
          '{actor} of the data team added it. It is at {level} and not yet published, so only your team and the data team see it. Read its descriptions, add your own where they help, and publish it when it is right: publishing it is your first confirmation.',
        ),
      },
    },
    learningCard: {
      fit: 'named',
      card: { number: '4.7.1', title: 'Owner and steward' },
      why: 'What the Owner takes on with a Resource: vouching for it, describing it and publishing it; confirmed on 2026-10-29 (DEC-LR-29).',
    },
    action: {
      asks: 'act',
      of: ['owner'],
      what: 'The Owner reads the Resource, adds Business Descriptions where they help, and publishes it from Described (DEC-SR-07).',
      buttons: [OPEN_RESOURCE, { label: { nl: 'Publiceren', en: 'Publish' }, opens: 'Publish on the page of the Resource, from Described', for: ['owner'] }],
      states: ['open', 'published'],
      done: 'Published, it shows so.',
    },
    example: { subject: 'Saved searches', collection: 'Web visits', actor: 'Dirk Vos', level: '2 · Described' },
  },

  // Lenses
  {
    id: 'MSG-LEN-01',
    title: 'Request to accept a very large Lens',
    kind: 'request',
    subjects: ['lens'],
    from: 'user',
    to: ['dataTeam'],
    when: 'The author of a Lens that reads more than 1 GB in one run sends it to the Data Team with "Send to the data team" (FR-LE-09).',
    status: 'Implemented',
    sources: ['FR-LE-08', 'FR-LE-09', 'FR-CV-08', 'DEC-LE-05'],
    parameters: [...SIZE, ...PARTITIONS, { name: 'smaller', type: 'size', about: 'What one run reads at most with a default for From, when Data Hub can tell', optional: true }],
    text: {
      nl: {
        plain: lines('{writer} vraagt het datateam de lens {subject} te aanvaarden: één run leest {reads}, boven {threshold}.', '“{text}”'),
        rich: lines(
          '**{writer} vraagt het datateam de lens {subject} te aanvaarden**',
          '',
          '> {text}',
          '',
          '- Eén run leest **{reads}**: zeer groot, boven {threshold}',
          '- Hij leest {partitions} van de {partitionsTotal} partities',
          '- Met een standaardwaarde voor From hoogstens {smaller}',
          '',
          'Tot het datateam beslist, ziet alleen {writer} de lens, en past niemand hem aan.',
        ),
      },
      en: {
        plain: lines('{writer} asks the data team to accept the lens {subject}: one run reads {reads}, above {threshold}.', '“{text}”'),
        rich: lines(
          '**{writer} asks the data team to accept the lens {subject}**',
          '',
          '> {text}',
          '',
          '- One run reads **{reads}**: very large, above {threshold}',
          '- It reads {partitions} of {partitionsTotal} partitions',
          '- With a default for From, at most {smaller}',
          '',
          'Until the data team decides, only {writer} sees the lens, and nobody changes it.',
        ),
      },
    },
    learningCard: { fit: 'byWriter', why: 'Its author writes why the Lens needs to read this much; the facts beneath come from Data Hub.' },
    action: {
      asks: 'decide',
      of: ['dataTeam'],
      what: 'A member of the Data Team decides in context, with the size check of the Lens in view: Accept publishes it, Refuse needs a reason. Until then the Lens is frozen (DEC-LE-05).',
      buttons: [OPEN_IN_CONTEXT, ACCEPT, REFUSE],
      states: ['waiting', 'accepted', 'refused'],
      done: 'The decision is its reply (MSG-CNV-05), which notifies its writer. It waits until the Data Team decides (DEC-LE-15).',
    },
    example: {
      writer: 'Mia Peeters',
      subjectKind: 'lens',
      subject: 'Leads per source, all weeks',
      text: 'Please accept this lens. For the yearly review with KBC; it runs once a month.',
      reads: 6_200_000_000,
      threshold: 1_000_000_000,
      partitions: 312,
      partitionsTotal: 312,
      smaller: 840_000_000,
    },
  },
  {
    id: 'MSG-LEN-02',
    title: 'A Lens grew into large',
    kind: 'dataHub',
    subjects: ['lens'],
    from: 'dataHub',
    to: ['author'],
    when: 'A run of a Lens reads more than 100 MB, while it was made in the range below.',
    status: 'Implemented',
    sources: ['FR-LE-10', 'FR-LE-08', 'FR-SR-40'],
    parameters: [...SIZE, { name: 'column', type: 'name', about: 'The partition column, when a filter on it would make the Lens read less (FR-SR-40)', optional: true }],
    text: {
      nl: {
        plain: 'De lens {subject} is groot geworden: één run leest nu {reads}, boven {threshold}. Hij blijft draaien.',
        rich: lines(
          '**De lens {subject} is groot geworden**',
          '',
          'Eén run leest nu **{reads}**, boven {threshold}, meer dan toen hij gemaakt werd. Hij blijft draaien zoals hij is, en er wordt niets van je gevraagd.',
          '',
          'Een filter op `{column}`, de partitiekolom, laat hem minder lezen.',
        ),
      },
      en: {
        plain: 'The lens {subject} grew into large: one run now reads {reads}, above {threshold}. It keeps running.',
        rich: lines(
          '**The lens {subject} grew into large**',
          '',
          'One run now reads **{reads}**, above {threshold}, more than when it was made. It keeps running as it is, and nothing is asked of you.',
          '',
          'A filter on `{column}`, the partition column, would make it read less.',
        ),
      },
    },
    learningCard: SIZE_CARD,
    action: {
      asks: 'nothing',
      what: 'Its author can make it read less, but need not.',
      buttons: [{ label: { nl: 'Lens openen', en: 'Open the lens' }, opens: 'The page of the Lens, where its Owner Unit edits it' }],
      done: 'When it is read.',
    },
    example: { subject: 'Leads per source name', reads: 240_000_000, threshold: 100_000_000, column: 'lead_week' },
  },
  {
    id: 'MSG-LEN-03',
    title: 'A Lens grew into very large',
    kind: 'request',
    subjects: ['lens'],
    from: 'dataHub',
    to: ['dataTeam', 'owner'],
    when: 'A run of a Lens reads more than 1 GB, while it was made or last accepted in a range below. Data Hub sends the Request itself (FR-CV-08), and the Lens stops until it is accepted again (DEC-LE-11).',
    status: 'Implemented',
    sources: ['FR-LE-10', 'FR-CV-08', 'DEC-LE-11'],
    parameters: [...SIZE, ...PARTITIONS],
    text: {
      nl: {
        plain: 'De lens {subject} is zeer groot geworden: één run leest nu {reads}, boven {threshold}. Hij draait niet meer tot het datateam hem opnieuw aanvaardt.',
        rich: lines(
          '**De lens {subject} is zeer groot geworden**',
          '',
          'Eén run leest nu **{reads}**, boven {threshold}: meer dan in het bereik waarin hij gemaakt of laatst aanvaard werd. Hij draait niet meer tot het datateam hem opnieuw aanvaardt.',
          '',
          '- Hij leest {partitions} van de {partitionsTotal} partities',
        ),
      },
      en: {
        plain: 'The lens {subject} grew into very large: one run now reads {reads}, above {threshold}. It does not run until the data team accepts it again.',
        rich: lines(
          '**The lens {subject} grew into very large**',
          '',
          'One run now reads **{reads}**, above {threshold}: more than in the range it was made or last accepted in. It does not run until the data team accepts it again.',
          '',
          '- It reads {partitions} of {partitionsTotal} partitions',
        ),
      },
    },
    learningCard: SIZE_CARD,
    action: {
      asks: 'decide',
      of: ['dataTeam'],
      what: 'As for a Request by its author (MSG-LEN-01): the Data Team accepts or refuses it in context. Meanwhile the Lens does not run (DEC-LE-11).',
      buttons: [OPEN_IN_CONTEXT, ACCEPT, REFUSE],
      states: ['waiting', 'accepted', 'refused'],
      done: 'The decision is its reply (MSG-CNV-05), which notifies the author of the Lens.',
    },
    example: { subject: 'Leads per source name', reads: 1_400_000_000, threshold: 1_000_000_000, partitions: 104, partitionsTotal: 104 },
  },
  {
    id: 'MSG-LEN-04',
    title: 'A Lens on your Resource became public',
    kind: 'dataHub',
    subjects: ['lens'],
    from: 'dataHub',
    to: ['resourceOwners'],
    when: 'A Lens is made public (FR-LN-04). Before that, there is no Message.',
    per: 'One per Resource beneath the Lens, to its Owner.',
    status: 'Proposed',
    sources: ['FR-LN-04', 'DEC-LE-09'],
    parameters: [{ name: 'resource', type: 'object', about: 'The Resource of the receiver that the Lens builds on' }],
    text: {
      nl: {
        plain: 'De lens {subject} is nu publiek. Hij steunt op je resource {resource}.',
        rich: lines(
          '**De lens {subject} is nu publiek**',
          '',
          'Hij steunt op {resource}, waarvan jouw team owner is: iedereen die de lens mag zien, leest die data nu via hem. Er wordt niets van je gevraagd; een vraag of opmerking over de lens hoort in zijn berichten.',
        ),
      },
      en: {
        plain: 'The lens {subject} is now public. It builds on your resource {resource}.',
        rich: lines(
          '**The lens {subject} is now public**',
          '',
          'It builds on {resource}, which your team owns: everyone who may see the lens now reads that data through it. Nothing is asked of you; a question or a remark about the lens goes in its messages.',
        ),
      },
    },
    learningCard: {
      fit: 'proposed',
      card: { number: '4.5.1', title: 'Who consumes outside your domain' },
      why: 'A public Lens brings the data of the Resource to people outside the domain of its Owner.',
    },
    action: {
      asks: 'nothing',
      what: 'The Owner of the Resource now knows who reads its data, and can ask or remark on the Lens.',
      buttons: [{ label: { nl: 'Lens openen', en: 'Open the lens' }, opens: 'The page of the Lens' }],
      done: 'When it is read.',
    },
    example: { subject: 'Credit funnel by region', resource: 'Weekly lead volume' },
  },

  {
    id: 'MSG-LEN-05',
    title: 'A Lens is Broken',
    kind: 'dataHub',
    subjects: ['lens'],
    from: 'dataHub',
    to: ['owner'],
    when: 'A Lens reads a Resource or a column that no longer exists: Data Hub finds it after a new Current Version, in its daily check, or when a run fails (FR-SR-52).',
    per: 'One per Lens, however much of what it reads is missing; what goes missing later joins it.',
    status: 'Proposed',
    sources: ['DEC-DH-67', 'FR-LE-17', 'FR-SR-52'],
    parameters: [...BROKEN],
    text: {
      nl: {
        plain: 'De lens {subject} werkt niet meer. Bestaat niet meer: {missing}. Hij werkt weer vanzelf zodra dat terug is.',
        rich: lines(
          '**De lens {subject} werkt niet meer**',
          '',
          'Sinds {since} {count, plural, one {bestaat dit} other {bestaan deze}} niet meer:',
          '',
          '{missing}',
          '',
          'Niemand kan de lens nog laten draaien, en overal waar hij staat, draagt hij een rode stip. Rapporten met deze lens werken ook niet meer. Komt wat ontbreekt terug, dan werkt hij weer vanzelf en hoor je het hier. Komt het niet terug, pas dan de query van de lens aan.',
        ),
      },
      en: {
        plain: 'The lens {subject} is broken. No longer there: {missing}. It works again by itself when that comes back.',
        rich: lines(
          '**The lens {subject} is broken**',
          '',
          'Since {since}, {count, plural, one {this no longer exists} other {these no longer exist}}:',
          '',
          '{missing}',
          '',
          'Nobody can run the lens now, and wherever it is listed, it carries a red dot. Reports with this lens are broken too. If what is missing comes back, it works again by itself and you hear it here. If it does not, change the query of the lens.',
        ),
      },
    },
    learningCard: BROKEN_CARD,
    action: {
      asks: 'act',
      of: ['owner'],
      what: 'The Owner Unit repairs the Lens from its query (DEC-LE-04), or asks the Data Team whether what is missing comes back. Nothing is needed when it does.',
      buttons: [
        { label: { nl: 'Lens openen', en: 'Open the lens' }, opens: 'The page of the Lens, with what is missing on top' },
        { label: { nl: 'Query openen', en: 'Open its query' }, opens: 'Query, with the query the Lens is made from', for: ['owner'] },
      ],
      states: BROKEN_STATES,
      done: 'When the Lens runs again, because what was missing exists again or its query changed it, Data Hub closes the Message itself: it shows since when the Lens works, and that notifies its Owner Unit.',
    },
    example: { subject: 'Leads per source name', since: '2026-10-28', count: 1, missing: [{ kind: 'column', resource: 'Weekly lead volume', column: 'lead_channel' }] },
  },

  // Queries
  {
    id: 'MSG-QRY-01',
    title: 'Request to run a very large query',
    kind: 'request',
    subjects: ['query'],
    from: 'user',
    to: ['dataTeam'],
    when: 'The Pre-flight of a query, or a preview, reads more than 1 GB, and the User sends it to the Data Team (DEC-SR-29).',
    status: 'Implemented',
    sources: ['DEC-SR-29', 'DEC-SR-36', 'FR-SR-37', 'FR-CV-08'],
    parameters: [...SIZE],
    text: {
      nl: {
        plain: lines('{writer} vraagt het datateam de query {subject} te laten draaien: hij leest {reads}, boven {threshold}.', '“{text}”'),
        rich: lines(
          '**{writer} vraagt het datateam de query {subject} te laten draaien**',
          '',
          '> {text}',
          '',
          '- Hij leest **{reads}**: zeer groot, boven {threshold}',
        ),
      },
      en: {
        plain: lines('{writer} asks the data team to run the query {subject}: it reads {reads}, above {threshold}.', '“{text}”'),
        rich: lines(
          '**{writer} asks the data team to run the query {subject}**',
          '',
          '> {text}',
          '',
          '- It reads **{reads}**: very large, above {threshold}',
        ),
      },
    },
    learningCard: { fit: 'byWriter', why: 'The User writes why the query needs to read this much; the facts beneath come from Data Hub.' },
    action: {
      asks: 'decide',
      of: ['dataTeam'],
      what: 'A member of the Data Team decides in context, with the SQL and its Pre-flight in view; Refuse needs a reason. Accepting lets its writer run that query above the limit, also after its SQL changes (DEC-SR-36). The User sends it from the bar of the Pre-flight, with an optional word (DEC-UX-116).',
      buttons: [
        { label: OPEN_IN_CONTEXT.label, opens: 'Query, with the query and its Pre-flight, and the Request in a floating window over it (FR-CV-09)' },
        ACCEPT,
        REFUSE,
      ],
      states: ['waiting', 'accepted', 'refused'],
      done: 'The decision is its reply (MSG-CNV-05), which notifies its writer.',
    },
    example: {
      writer: 'Karel Leys',
      subjectKind: 'query',
      subject: 'Partner leads since 2019',
      text: 'For the five-year review of the partner deal; it runs once.',
      reads: 4_800_000_000,
      threshold: 1_000_000_000,
    },
  },
  {
    id: 'MSG-QRY-02',
    title: 'A query is Broken',
    kind: 'dataHub',
    subjects: ['query'],
    from: 'dataHub',
    to: ['owner'],
    when: 'A query reads a Resource or a column that no longer exists: Data Hub finds it after a new Current Version, in its daily check, or when a run fails (FR-SR-52).',
    per: 'One per query, however much of what it reads is missing; what goes missing later joins it.',
    status: 'Proposed',
    sources: ['DEC-DH-67', 'FR-SR-53', 'FR-SR-52'],
    parameters: [...BROKEN],
    text: {
      nl: {
        plain: 'Je query {subject} werkt niet meer. Bestaat niet meer: {missing}. Hij werkt weer vanzelf zodra dat terug is.',
        rich: lines(
          '**Je query {subject} werkt niet meer**',
          '',
          'Sinds {since} {count, plural, one {bestaat dit} other {bestaan deze}} niet meer:',
          '',
          '{missing}',
          '',
          'Hij kan niet meer draaien en draagt een rode stip. Je SQL blijft staan: pas hem aan, of wacht tot wat ontbreekt terug is; dan werkt hij weer vanzelf en hoor je het hier.',
        ),
      },
      en: {
        plain: 'Your query {subject} is broken. No longer there: {missing}. It works again by itself when that comes back.',
        rich: lines(
          '**Your query {subject} is broken**',
          '',
          'Since {since}, {count, plural, one {this no longer exists} other {these no longer exist}}:',
          '',
          '{missing}',
          '',
          'It cannot run now, and it carries a red dot. Your SQL stays: change it, or wait until what is missing comes back; then it works again by itself and you hear it here.',
        ),
      },
    },
    learningCard: BROKEN_CARD,
    action: {
      asks: 'act',
      of: ['owner'],
      what: 'Who made the query changes its SQL, or waits for what is missing to come back. Using other Resources is a new query (DEC-UX-73).',
      buttons: [{ label: { nl: 'Query openen', en: 'Open the query' }, opens: 'Query, with the query and what is missing on top' }],
      states: BROKEN_STATES,
      done: 'When the query runs again, because what was missing exists again or its SQL changed, Data Hub closes the Message itself: it shows since when the query works, and that notifies who made it.',
    },
    example: {
      subject: 'Partner leads in September',
      since: '2026-10-28',
      count: 2,
      missing: [
        { kind: 'column', resource: 'Weekly lead volume', column: 'lead_channel' },
        { kind: 'resource', resource: 'Partner contracts' },
      ],
    },
  },

  // Reports
  {
    id: 'MSG-RPT-01',
    title: 'A Report is Broken',
    kind: 'dataHub',
    subjects: ['report'],
    from: 'dataHub',
    to: ['owner'],
    when: 'A Lens of a Report becomes Broken (DEC-DH-67).',
    per: 'One per Report, however many of its Lenses are Broken; a Lens that breaks later joins it.',
    status: 'Proposed',
    sources: ['DEC-DH-67', 'FR-SR-52'],
    parameters: [
      { name: 'since', type: 'date', about: 'The day its first Lens broke' },
      { name: 'count', type: 'count', about: 'How many of its Lenses are Broken' },
      {
        name: 'lenses',
        type: 'list',
        about: 'Its Broken Lenses',
        item: {
          fields: [{ name: 'lens', type: 'object', about: 'A Broken Lens of the Report' }],
          text: { nl: { plain: '{lens}', rich: '- {lens}' }, en: { plain: '{lens}', rich: '- {lens}' } },
        },
      },
    ],
    text: {
      nl: {
        plain: 'Het rapport {subject} werkt niet meer. Lenzen die niet meer werken: {lenses}. Het werkt weer vanzelf zodra al zijn lenzen weer werken.',
        rich: lines(
          '**Het rapport {subject} werkt niet meer**',
          '',
          'Sinds {since} {count, plural, one {werkt deze lens} other {werken deze lenzen}} erin niet meer, omdat wat {count, plural, one {hij leest} other {ze lezen}} niet meer bestaat:',
          '',
          '{lenses}',
          '',
          'Overal waar het rapport staat, draagt het een rode stip. Het werkt weer vanzelf zodra al zijn lenzen weer werken, en dan hoor je het hier.',
        ),
      },
      en: {
        plain: 'The report {subject} is broken. Broken lenses in it: {lenses}. It works again by itself when all its lenses work again.',
        rich: lines(
          '**The report {subject} is broken**',
          '',
          'Since {since}, {count, plural, one {this lens} other {these lenses}} in it {count, plural, one {is} other {are}} broken, because what {count, plural, one {it reads} other {they read}} no longer exists:',
          '',
          '{lenses}',
          '',
          'Wherever the report is listed, it carries a red dot. It works again by itself when all its lenses work again, and you hear it here.',
        ),
      },
    },
    learningCard: BROKEN_CARD,
    action: {
      asks: 'act',
      of: ['owner'],
      what: 'The Owner Unit of the Report waits for its Lenses to work again, or takes a Broken Lens out of the Report. Each Lens has its own Message to its own Owner Unit (MSG-LEN-05).',
      buttons: [{ label: { nl: 'Rapport openen', en: 'Open the report' }, opens: 'The page of the Report, with its Broken Lenses marked' }],
      states: BROKEN_STATES,
      done: 'When all its Lenses work again, Data Hub closes the Message itself: it shows since when the Report works, and that notifies its Owner Unit.',
    },
    example: { subject: 'Credit leads, monthly', since: '2026-10-28', count: 1, lenses: [{ lens: 'Leads per source name' }] },
  },
];
