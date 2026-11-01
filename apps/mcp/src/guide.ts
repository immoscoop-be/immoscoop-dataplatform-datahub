import type { AccessTokenClaims } from '@datahub/contracts';

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

/** What Claude can do in Data Hub for this User, by what they may (FR-CL-16, DEC-CL-09). */
export function howToUse(user: Pick<AccessTokenClaims, 'roles'>): string {
  const dataTeam = user.roles.includes('datateam');
  return [
    'With Data Hub connected, Claude works with the data as you, with your rights. Some things to ask:',
    '',
    'Find and read',
    '- "What can I see in Data Hub?" or "What is there on leads?"',
    '- "What is in Weekly lead volume, and how do I read it?"',
    '- "Where does it come from, and what can I join it with?"',
    '',
    'Look at the data and query it',
    '- "Show me some rows of last week." Claude opens the Preview in the conversation.',
    '- "What share of the credit leads came from partners, per week?" Claude first looks for a Lens, else writes a query of yours, checks it and runs it.',
    '- Up to 100 MB a query runs at once. Above that, you approve it yourself in the window; above 1 GB you can send a Request to the Data Team.',
    '',
    'Discuss',
    '- "Did anyone ask about this?" or "Ask the Owner why March is missing." Claude shows the Message first, and posts it only once you agree.',
    '',
    'If you are in the Owner Unit of a Collection',
    '- "Write a Business Description for it", "Describe its fields", "Deprecate it, use v2 instead": Claude shows what it will write, and writes it once you agree.',
    '- "Publish it": Claude checks it and opens the publication; only you tick the declaration and publish.',
    '',
    'Explain',
    '- "What is a Lens?" or "What does the Level mean?" Claude answers with the Learning Cards of Data Hub.',
    '',
    dataTeam
      ? 'For the Data Team: "Which queries ran on this Resource?" and "What did everyone query this week?" Adding Resources to a Collection, their grain and mappings stay in the web app.'
      : 'What stays in the web app: adding Resources to a Collection, and their grain and mappings, by the Data Team.',
  ].join('\n');
}
