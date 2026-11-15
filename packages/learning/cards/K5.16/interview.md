# Interview record · K5.16 Pitfalls

The input of the card as the interview gave it: what the author said, what Claude brought, and where each answer went in the card. It is what the fact check reads the card against.

| | |
| --- | --- |
| Card | K5.16 Pitfalls (Compass, section K5 Data Hub) |
| Author | Max |
| Interviewed | 2026-11-15, with the learning-card skill: not interviewed, drafted by Claude |
| Fact check | To name |
| Test reader | To name, in prod (DEC-LR-38) |

## 1. The reader's question

**Asked:** Not asked: drafted by Claude.

**Answer:** Claude's suggestion, from the storyboard of the Owner Journey (`docs/design/screens/owner-journey.html`, step 6), whose Resource has the pitfall "Do not average the position": "My average position for October is 14, but the SEO team reports 6. Is there a mistake in the data?", from a colleague from marketing preparing the month report. The figures 14 and 6 are Claude's example figures; that the plain average lands further down the ranking than the weighted one (the many rows with few impressions tend to rank lower) is Claude's assumption, to check with the author. Whether colleagues say it this way is for the test reader.

**In the card:** Why now, the quote and the situation.

## 2. What went wrong

**Asked:** Not asked: drafted by Claude.

**Answer:** Claude's suggestion, from the storyboard and the requirements: Search Console impressions, whole site, in Attraction, owned by SEO, holds one row per day, query, country, device and search type; averaging the position of the rows gives a row with ten impressions as much weight as one with ten thousand, where the position of the site weighs each row by its impressions (the storyboard cites Search Console Help, "Bulk data export: table reference"). Nothing is missing and every row is right: the reading goes wrong, and the result looks like a position. The facts of Data Hub behind the example: the Owner and the Data Team write the pitfalls, in Markdown (FR-RC-15, FR-RC-23, DEC-RC-19; `resources.describe` per attribute, DEC-PL-03); they stand under Known Behaviour on the Overview of the Resource (DEC-RC-12, `ResourceOverview.svelte`) and under Watch out in its Summary (DEC-RC-17); Claude reads them as written (FR-RC-23, FR-CL-25); the pitfalls are required to publish, and "none" is an answer, kept with who gave it and when and shown as "None, according to" whom, on which day (DEC-MR-16, FR-MR-17, FR-MR-18; `overview.nothing.said`); an empty part reads "Nothing written yet." (`resource.nothingYet`). Expected misconceptions, none heard yet: a pitfall is a bug the Data Team should fix; a pitfall is a Known Gap; if nothing is written there are no pitfalls; explaining a trap in a chat is enough; wait until a second colleague makes the mistake.

**In the card:** the situation of Why now; Core idea, "At Immoscoop"; the wrong answers of the three questions.

## 3. The aha

**Asked:** Not asked: drafted by Claude.

**Answer:** The storyboard's rule, kept as it was: "A pitfall is a way to read a table wrongly that looks right: written on its card, the next colleague steps around it." "Card" is the Resource Card, as the Owner Journey calls it throughout.

**In the card:** Core idea, the rule.

## 4. The everyday anchor

**Asked:** Not asked: drafted by Claude.

**Answer:** None. The author left the anchor out of K5.7 to K5.11 as not adding value to a card about Data Hub (DEC-LR-36), and the brief asked the same for the cards of the Owner Journey: the reader meets the pitfalls on a screen of Data Hub, under Known Behaviour on the Overview of a Resource, and in the window of the Owner Journey, which is their physical part. K5.3, its neighbour, already uses the pothole with a sign, which would fit a pitfall as well; a second road sign would blur the two cards.

**In the card:** nothing: Core idea holds the rule and the example only.

## 5. Never again, ask first

**Asked:** Not asked: drafted by Claude.

**Answer:** Claude's suggestion: never keep a trap you know in your head or in a chat; ask first "What trips people up with this table?", the question Claude asks the Owner at the step Pitfalls (`apps/mcp/src/journey.ts`). Tested out loud: the answer "nothing" leads to "Nothing to add", kept with who said so, not to an empty part; a reader who finds "Nothing written yet" asks its Owner.

**In the card:** You can now, the first question; the wrong answers "Nothing more: they know now" and "Wait until a second colleague makes the same mistake".

## 6. One card or a family

**Asked:** Not asked: drafted by Claude.

**Answer:** Claude's view: one card, a sibling of K5.3 (Known Gaps) and K5.17 (Reliable since) in the Known Behaviour of a Resource, and of 3.3.3, which the brief extends for the intended use. The difference with a Known Gap is said in one sentence of the example and one question, not explained twice.

**In the card:** Nothing; see To do.

## 7. Neighbours

**Asked:** Not asked: drafted by Claude.

**Answer:** Claude's suggestion: Next to it K5.3 (the Known Gaps, the other half of what a reader must know before trusting a result) and K5.4 (When a figure is final, which says the ripening time of a Resource is written among its pitfalls); Apply to Collections, where the pitfalls stand under Known Behaviour. Term in bold: pitfall, a label of Data Hub and a part of the Defined Term Known Behaviour, not a Defined Term of its own.

**In the card:** Where to next, and the term in bold.

## The ladder

1. **Story:** a colleague proudly reports a figure that looks right; the colleague who knew the trap had told it to someone else, in a chat, a month before.
2. **Structure:** one table, two readings of the same rows: the plain average and the weighted one; a note on the card points to the second.
3. **Data Hub:** the pitfalls under Known Behaviour on the Overview of a Resource, "None, according to" whom when there are none, and the step Pitfalls of the Owner Journey.

The card has no See it: the third rung is a screen of Data Hub, not a chart, and a pitfall is a way of reading, not a figure; a chart of the two averages would show two numbers without the trap that makes one of them look right. Apply leads to the screen instead. The first two rungs are pictures (Figma work); the card has no place for them yet.

## Who brought what

The author asked for this card in the brief for the Owner Journey of 2026-11-15, §6: each step refers to a card that explains the why, written in the form and the voice of the existing cards, without duplicating one; the pitfalls are "what goes wrong when someone uses it without knowing it", and `explain` must find the card on the words an Owner uses, such as pitfall. Claude wrote everything in the card from the requirements, the code of the web app and the storyboard of the Owner Journey: the quote and its figures, the example, the gain (sharpened from the storyboard's "Your colleagues avoid the mistakes you already made, or saw made" into a sentence to the reader that holds both sides), the three questions with their wrong answers, the first question and the neighbours. The rule is the storyboard's, unchanged.

## To do

- [ ] Fact check: someone of the Data Team other than the author reads the card against this record
- [ ] Ask the author whether "the SEO team reports 6" against "14" is the right order of magnitude for the position of the site, or replace the figures by real ones
- [ ] Offer K5.12 The Owner Journey under Where to next, once it is written
- [ ] A marker ⓘ on the pitfalls under Known Behaviour on the Overview of a Resource, listing this card: a new place, to design first (DEC-LR-22)
- [ ] Test reader: a colleague outside data reads the card in prod and says in their own words what they learned (DEC-LR-38)
