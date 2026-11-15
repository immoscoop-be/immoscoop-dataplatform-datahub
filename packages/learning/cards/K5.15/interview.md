# Interview record · K5.15 Key Fields and Parameters

The input of the card as the drafting gave it: nobody was interviewed, so each answer is what Claude brought, from which requirement, and where it went in the card. It is what the fact check reads the card against.

| | |
| --- | --- |
| Card | K5.15 Key Fields and Parameters (Compass, section K5 Data Hub) |
| Author | Max |
| Interviewed | Not interviewed: drafted by Claude on 2026-11-15, with the learning-card skill |
| Fact check | Claude, a review against the requirements and the code on 2026-11-15; Max reviews it in prod |
| Test reader | To name, in prod (DEC-LR-38) |

## 1. The reader's question

**Asked:** Not asked: drafted by Claude.

**Answer:** Claude's suggestion, from the storyboard of the Owner Journey (`docs/design/screens/owner-journey.html`, steps 3 and 8), where the Owner adds `search_type` to the Key Fields because "mixing Discover with web search is the classic mistake" and keeps it as the only Parameter: "Ten fields, and I only want Discover. Which ones matter, and what do I filter on?", from a colleague from marketing opening Search Console impressions for the first time. The reader meets the card at the steps Key Fields and Parameters of the Owner Journey, which name it (`packages/contracts/src/journey.ts`); no Message or marker names it yet. Whether colleagues say it this way is for the test reader.

**In the card:** Why now, the quote and the situation.

## 2. What went wrong

**Asked:** Not asked: drafted by Claude.

**Answer:** Claude's suggestion, from DEC-SR-19 and FR-RC-15 (the Owner and the Data Team mark key fields and Parameter fields on the Resource Card), DEC-ED-07 (an EDA covers at least the Key Fields; a field added later is no Key Field until it is marked one), DEC-MR-16 (the Key Fields, each with a Business Description, are required to publish; the Parameters are advised, and "none" is an answer), FR-SR-38, DEC-SR-37 and TR-SR-19 (the Preview offers its partition column with its newest 1, 4 or 12 partitions, its first cluster column and the Parameters of its Card that are text, a number, a date or yes or no, at most six, each with at most 100 values to pick), and DEC-RC-07 (the grain is the set of fields that identify each row). Checked in the code: the Key fields and Parameters stand under Querying on the Overview, the Columns mark a Parameter, the Summary Claude reads lists both under "Before you query", and the catalogue takes at most 50 of each, with no other limit. The example takes the fields, the Key Fields and the Parameter of the storyboard, and the values of `search_type` it shows. Expected misconceptions, none heard yet: Key Fields are the fields that identify each row (the primary key); Parameters are the same as Key Fields; a Preview cannot be narrowed; more Key Fields are safer; Data Hub keeps only the ones used most.

**In the card:** the situation of Why now; Core idea, "At Immoscoop"; the wrong answers of the three questions.

## 3. The aha

**Asked:** Not asked: drafted by Claude.

**Answer:** The rule the storyboard drafted, kept in meaning and made to name the Resource: Key Fields are the few fields of a Resource a colleague should look at first and its EDA explores; its Parameters are the fields its Preview offers to filter on. Claude added to the example the sentence that holds the card apart from the grain: a Key Field is what matters, not what makes a row unique.

**In the card:** Core idea, the rule.

## 4. The everyday anchor

**Asked:** Not asked: drafted by Claude.

**Answer:** None. As for K5.7 to K5.11, the author asked for these cards without an anchor: the reader marks and reads the Key Fields and Parameters on a screen of Data Hub, under Querying on the Overview and in the choices of the Preview, which is its physical part (DEC-LR-36). The storyboard drafted "Like the legend of a map" in the whole card it shows; it went to the first rung of the ladder.

**In the card:** nothing: Core idea holds the rule and the example only.

## 5. Never again, ask first

**Asked:** Not asked: drafted by Claude.

**Answer:** Claude's suggestion: never mark a field a Key Field because it identifies a row, nor many fields to be safe; ask first "Which fields answer nearly every question asked of it?". Tested out loud: if the answer is "all of them", the question is too wide for the Resource and its Owner names the few they look at themselves; if it is "none", the Resource still needs at least one to be published.

**In the card:** You can now, the first question; the wrong answers of the first and third questions.

## 6. One card or a family

**Asked:** Not asked: drafted by Claude.

**Answer:** One card on two marks, as the plan has it and the journey names it at two steps, Key Fields and Parameters: both are fields the Owner picks from the same list, under Querying, for a colleague. It is one of the family of the Owner Journey, K5.12 to K5.19, written together on 2026-11-15.

**In the card:** Nothing; see To do.

## 7. Neighbours

**Asked:** Not asked: drafted by Claude.

**Answer:** Claude's suggestion: Next to it K5.14 The Business Description, which each Key Field needs, and K5.18 What the Data Admin records, the grain the Key Fields are not, and the other start of the EDA; Apply to Collections. 2.3.5, on the grain, is the card a reader who takes Key Fields for the key needs next; it stays on the to-do, as Where to next holds two cards. Term in bold: Key Fields, a Defined Term.

**In the card:** Where to next, and the term in bold.

## The ladder

1. **Story:** a map that holds a thousand things, with a legend that names the five you need to find your way, and a sieve that keeps only what you pick.
2. **Structure:** a table of ten fields: five marked as Key Fields, where a colleague starts and the EDA explores; one marked as a Parameter, whose values the Preview offers; the grain, the fields that identify each row, beside them and not the same.
3. **Data Hub:** the Key fields and Parameters under Querying on the Overview of a Resource, the choices of its Preview, and in Claude the steps Key Fields and Parameters of the Owner Journey.

The card has no See it: the third rung is a screen of Data Hub, not a chart. Apply leads there instead. The first two rungs are pictures (Figma work); the card has no place for them yet.

## Who brought what

Max, the author, asked for these cards in the brief for the Owner Journey of 2026-11-15, §6: each step refers to a card that explains the why, in the form and the voice of the existing cards, extending a card that exists rather than duplicating one; for this card, "what they do for a colleague and for a Preview". Claude wrote everything in the card from the requirements, the code of the web app and the query service, and the storyboard of the Owner Journey, starting from the rule and the gain the storyboard drafted: the quote, the situation, the example, the three questions, the first question and the neighbours. Claude checked the existing set first: no card explained Key Fields or Parameters; 2.3.5 explains the grain, which this card keeps apart from the Key Fields. A "yes" to a suggestion weighs less than the author's own words, so the fact check, by someone of the Data Team, and the test reader carry more weight here than usual.

Published without a review first, at the author's request on 2026-11-15: "You may publish them all I'll review once in prod". The card is `reviewed` so that prod shows it in the Owner Journey; the author reads it there.

## To do

- [ ] Max reviews the card in prod, as he asked on 2026-11-15
- [ ] Fact check: someone of the Data Team reads the card against this record and the requirements
- [ ] Test reader: a colleague outside data reads the card in prod and says in their own words what they learned (DEC-LR-38)
- [ ] The Parameters of a Resource, the fields its Preview offers to filter on (DEC-SR-19, FR-SR-38), are not the Defined Term Parameter, the input of a Lens (DEC-DH-11); the card writes both with a capital, as the web app does: record it as an open point, raised in the review of this card
- [ ] The Dutch web app calls the Key Fields "Sleutelvelden", while the Defined Term, the plan and this card keep Key Field (DEC-DH-65): one of them is to change
- [ ] A marker on Key fields and Parameters under Querying on the Overview listing this card: to design first (DEC-LR-22)
- [ ] `node scripts/learning-card.ts links` does not count the steps of the Owner Journey (`packages/contracts/src/journey.ts`) as a place that meets a card; this card is met there, at Key Fields and Parameters
- [ ] Consider 2.3.5 under Where to next, for the reader who takes Key Fields for the key
