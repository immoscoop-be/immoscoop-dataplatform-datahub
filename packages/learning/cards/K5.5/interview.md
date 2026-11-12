# Interview record · K5.5 The query behind a figure

The input of the card as the interview gave it: what the author said, what Claude brought, and where each answer went in the card. It is what the fact check reads the card against.

| | |
| --- | --- |
| Card | K5.5 The query behind a figure (Compass, section K5 Data Hub); proposed in the interview, added to the plan in the same pull request |
| Author | Max Passenier |
| Interviewed | 2026-11-12, by voice in Claude chat, along the learning-card recipe; card written on 2026-11-12 with the learning-card skill |
| Fact check | To name |
| Test reader | To name |

## 1. The reader's question

**Asked:** Who asked you this recently, and how did they put it?

**Answer:** "It's awful." Somebody says: I am looking at this data, with a print screen of some bar charts, we do not know from where; and I compare it to this data, a number from an email, we do not know from where. And then asks us: what is the difference?

**In the card:** Why now: the quote, as the colleague says it ("I have these bar charts on a print screen, and this number from an email. What is the difference?"), by "A colleague, asking the Data Team", a role, as no department was named; the situation, in two sentences, without naming the query.

## 2. What went wrong

**Asked:** What went wrong, concretely? One metric from our dashboards, or one sentence a colleague said.

**Answer:** The same case served as the answer: two figures without an origin, and the Data Team asked to explain the difference. No metric and no figures were named.

**In the card:** Core idea, "At Immoscoop", its first two sentences; the situation of Why now. The misconception behind it (two figures that differ are for the Data Team to explain) is the wrong answer "Send both figures to the Data Team" of the first question. No figures were needed: the card has no See it (see The ladder).

## 3. The aha

**Asked:** What is the one thing that, once someone sees it, makes the rest obvious?

**Answer:** We need to know at which time and with which data the conclusion was made. Otherwise you see the word "the" and have to guess which sentence it stood in.

**In the card:** Core idea, the rule: "Before you ask anyone to explain a figure, know when and from which data it was made; in Data Hub the **Query ID** under its result leads to both." The decision rule and its second half are Claude's wording of the author's aha. The word "the" stands in "At Immoscoop", in the author's words.

## 4. The everyday anchor

**Asked:** Which everyday thing behaves exactly like this?

**Answer:** Taking a picture of a street and asking which city it is. Claude added the place and date written on the back of the photo, as the thing that answers it; the author did not react to that part.

**In the card:** Core idea, "Like a photo of a street": the author's anchor only, the photo and the guess. The back of the photo is left out, as the author did not take it up. Tested while writing: the street carries "with which data" (which city), not "at which time"; the back of the photo, with place and date, would carry both. That is a question for the author at the quality gate (see To do), not a sentence added to the anchor.

## 5. Never again, ask first

**Asked:** What may a colleague never do again after this card, and what do they ask first from now on?

**Answer:** Never send us a question without knowing its origin. And the first question becomes: whom do I ask about this query? You go into the interface, look up the query, see who owns the data, and start from there.

**In the card:** You can now, the first question in the author's words; the ban is the wrong answer "Send both figures to the Data Team" of the first question and "The Data Team, which makes every Lens" of the fourth. "Look up the query, see who owns the data" is written to what Data Hub does today, in "At Immoscoop" and the fourth question: a query belongs to whoever ran it, so you ask them; a Lens is found in its Collection with the Resources it is built on; each Resource names its Owner. No screen looks up a query by its Query ID (see To do).

## 6. One card or a family

**Asked:** Is this one card, or a small family?

**Answer:** One card, on Claude's proposal; the author moved on without objecting.

**In the card:** Nothing.

## 7. Neighbours

**Asked:** Next to which existing cards, and which term of the glossary, does this one belong?

**Answer:** Left to Claude: K5.1 What a resource is and 4.7.1 Owning a Resource. No card on Lens is written yet. Glossary term: Query ID.

**In the card:** Where to next: Next to it K5.1 and Next to it 4.7.1, both written; Apply to Collections, where a Lens is found (DEC-UX-66). The rule bolds **Query ID**, a Defined Term of `docs/definitions.md`, defined together with the Query Log (FR-LN-05, FR-LN-06).

## The ladder

1. **Story:** a photo of a street passed round a table, everyone guessing the city, until someone turns it over.
2. **Structure:** a figure with a tag, and the tag leading to the query, the moment, the Resources and their Owner.
3. **Data Hub:** the Query ID under the result of a query, a Preview or a Lens, with its copy button; the page of a Lens with the Resources it is built on; the page of a Resource with its Owner. The record first named "the screen where you look up a query"; no such screen exists for a colleague (see To do).

The card has no See it: the third rung is a screen of Data Hub, not a chart, and the Chart Server draws only charts. Apply leads to Collections, where a Lens and its Resources are found. The first two rungs are pictures (Figma work); the card has no place for them yet. The story of rung 1 turns the photo over, which is Claude's back of the photo: draw it only once the author agrees.

## Who brought what

The author brought the case, the aha with the word "the", the photo of the street, the ban and the first question. Claude brought the back of the photo (left out of the card), the neighbours, the wording of the quote from the author's report, the decision rule as one sentence, the gain (first written around "a figure", then around "the difference between two figures", the reader's own words, after `links` showed Claude missed the card on them), the four questions of Check your understanding with all their wrong answers (none of them heard from a colleague yet), and the facts of Data Hub behind "At Immoscoop": every result in Data Hub carries its Query ID under it (FR-LN-06), which leads to when its query ran, its SQL and its Resources (FR-LN-05); a query belongs to whoever ran it, and only they and the Data Team read its run in the Query Log (DEC-LN-01); Data Hub keeps every run for as long as it exists (TR-SR-17); a Lens has a page of its own in its Collection that names the Resources it is built on (FR-LE-11, DEC-UX-66); the Owner of a Resource is the Owner Unit of its Collection.

## To do

- [ ] Check with the author whether the back of the photo may stay in the anchor: left out for now; without it the street carries "which data" but not "at which time"
- [x] Check what Data Hub calls the identifier on a chart or an export, and where a colleague looks a query up. Found on 2026-11-12: the identifier is the Query ID, a Defined Term; it shows under the result of a query, a Preview and a Lens, with a copy button, and in the result of a query through Claude; a chart, a Report and an export carry theirs when they come (FR-LN-06, note of 2026-10-31), and v1 has no download; Excel gets it only in the header `X-Datahub-Query-Id` (TR-LE-08), not in the sheet. No screen looks up a query by its Query ID: the panel of Query lists the User's own queries and searches their names, makers and Resources, not the Query ID (TR-SR-17); everyone's, under All, is for the Data Team only (DEC-UX-20); the Owner Unit of a Resource sees the queries on it in its tab History, without a Query ID (DEC-SR-41, `queries.seeOthers`); the Data Team reads the Query Log in Cloud SQL Studio (DEC-PF-29); the link from a Query ID to the Query Log is drawn for a Preview but not built. A Lens user, the default for new Users, has no section Query at all. The card therefore sends the reader to whoever ran the query, or to the Lens and the Owner of its Resources, and promises no lookup
- [ ] The author's wish goes further than Data Hub: "you go into the interface, look up the query". A lookup by Query ID for whoever holds one, within what they may see, is not specified: raise it with the Data Team as an open point, and rewrite "At Immoscoop" if it is built
- [x] Add K5.5 to `plan.json`, with a note: in the same pull request, building on K5.1
- [ ] Offer a card on Lens under Where to next, once it is written
- [ ] Nobody meets this card where its topic comes up (`links` of 2026-11-12: no Message, no marker, no written card points to it). Propose a marker ⓘ on the Query ID under a result, of a query, a Preview and a Lens, listing this card: a new place, to design first (DEC-LR-22). And offer K5.5 under Where to next of K5.1, which has three choices today: the Data Team chooses which one it replaces
- [ ] Claude finds the card for 5 of 6 phrases of the reader; it misses "print screen", which stands only in the quote. Left as it is: no words are added for the search
- [ ] Quality gate: the wrong answers are Claude's; ask the author which are misconceptions really heard, especially "Keep your own figure", "That it is the figure of today" and "Nobody: a Lens has no owner"
- [ ] `references/card-format.md` of the skill lists `/lenses` (Open Lenses) as a path for Apply, but the web app has no such page: a Lens is reached through its Collection (DEC-UX-66), and `/lenses` shows the page for what does not exist. This card uses `/collections`; the table of the skill is to correct
