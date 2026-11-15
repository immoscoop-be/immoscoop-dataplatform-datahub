# Interview record · K5.14 The Business Description

The input of the card as the drafting gave it: nobody was interviewed, so each answer is what Claude brought, from which requirement, and where it went in the card. It is what the fact check reads the card against.

| | |
| --- | --- |
| Card | K5.14 The Business Description (Compass, section K5 Data Hub) |
| Author | Max |
| Interviewed | Not interviewed: drafted by Claude on 2026-11-15, with the learning-card skill |
| Fact check | Claude, a review against the requirements and the code on 2026-11-15; Max reviews it in prod |
| Test reader | To name, in prod (DEC-LR-38) |

## 1. The reader's question

**Asked:** Not asked: drafted by Claude.

**Answer:** Claude's suggestion, from the storyboard of the Owner Journey (`docs/design/screens/owner-journey.html`, step 2), where the description from dbt of Search Console impressions, whole site says only "Daily Search Console impressions and clicks for the whole site, from the bulk export": "Impressions: is that how many people saw our site?", from a colleague from marketing reading Search Console figures. The reader meets the card at the steps Business Description and Fields of the Owner Journey, which name it (`packages/contracts/src/journey.ts`); no Message or marker names it yet. Whether colleagues say it this way is for the test reader.

**In the card:** Why now, the quote and the situation.

## 2. What went wrong

**Asked:** Not asked: drafted by Claude.

**Answer:** Claude's suggestion, from DEC-RC-01 and DEC-RC-02 (two descriptions side by side, neither replaces the other; without a Business Description the one from dbt stands alone), FR-RC-16 (a Business Description of every field), DEC-RC-03 and FR-RC-17 (a change in dbt is told to the Owner, with the Business Description next to it, and changes nothing in it), FR-RC-18 (both shown together, each marked with where it comes from, on the Resource Card and its Columns, in search and for Claude), DEC-MR-10 (Business Descriptions from 2 · Described on) and DEC-MR-16 (required to publish: the Business Description of the Resource and of each Key Field; the other fields advised). Checked in the code: the Overview and the Columns show the Business Description first, marked From the Owner, with the one From dbt next to it; search reads the Display Name, the description from dbt and the Business Description of a Resource (`services/catalogue/src/collections.ts`), not those of its fields. The example takes the Business Description and the description of `data_date` from the storyboard, where Claude proposes them and the Owner corrects them; `lead_count` and its question in the third question follow the prototype of the Overview (`resource-overview.html`). Expected misconceptions, none heard yet: the description from dbt is enough; the new text from dbt replaces yours; describe every field before anything else; fields are the work of the Data Team; the business meaning belongs in dbt.

**In the card:** the situation of Why now; Core idea, "At Immoscoop"; the wrong answers of the three questions.

## 3. The aha

**Asked:** Not asked: drafted by Claude.

**Answer:** The rule the storyboard drafted, kept in meaning: the Business Description describes in the words of the business what a table or a field is for, next to the description from dbt that says how it is made, and a colleague reads yours first. Claude changed "what dbt says it is made of" into "the description from dbt that says how it is made", the words of DEC-RC-01, and "says" into "describes", which reads as the Owner asks ("describe my fields").

**In the card:** Core idea, the rule; the gain.

## 4. The everyday anchor

**Asked:** Not asked: drafted by Claude.

**Answer:** None. As for K5.7 to K5.11, the author asked for these cards without an anchor: the reader writes and reads the Business Description on a screen of Data Hub, the Description of the Overview and the Columns, which is its physical part (DEC-LR-36).

**In the card:** nothing: Core idea holds the rule and the example only.

## 5. Never again, ask first

**Asked:** Not asked: drafted by Claude.

**Answer:** Claude's suggestion: never leave what a table or a field means to the description from dbt; ask first "How would a colleague outside my team read this?". Tested out loud: if the answer is "as I mean it", nothing needs writing; if it is "wrongly", that is the sentence to write.

**In the card:** You can now, the first question; the wrong answers of the third question.

## 6. One card or a family

**Asked:** Not asked: drafted by Claude.

**Answer:** One card for the table and its fields, as the journey names it at two steps, Business Description and Fields. It is one of the family of the Owner Journey, K5.12 to K5.19, written together on 2026-11-15; which fields come first, the Key Fields, is K5.15.

**In the card:** Nothing; see To do.

## 7. Neighbours

**Asked:** Not asked: drafted by Claude.

**Answer:** Claude's suggestion: Next to it 4.7.1 Owning a Resource, which asks the Owner to describe and publish, and K5.15 Key Fields and Parameters, the step after it in the journey; Apply to Collections. 1.2.1 What a figure counts exactly is close, as a field description says what a figure counts, and stays on the to-do. Term in bold: Business Description, a Defined Term.

**In the card:** Where to next, and the term in bold.

## The ladder

1. **Story:** a product with two labels: the sheet of the factory that says what it is made of, and the label in the shop that says what it is for, which the buyer reads first.
2. **Structure:** a table and each of its fields with two descriptions side by side: from dbt, by the Data Team, how it is made; the Business Description, by the Owner, what it is for; the second read first, neither replacing the other.
3. **Data Hub:** the Description of the Overview of a Resource and its Columns, each Business Description marked From the Owner next to the one From dbt; in Claude, the steps Business Description and Fields of the Owner Journey.

The card has no See it: the third rung is a screen of Data Hub, not a chart. Apply leads there instead. The first two rungs are pictures (Figma work); the card has no place for them yet.

## Who brought what

Max, the author, asked for these cards in the brief for the Owner Journey of 2026-11-15, §6: each step refers to a card that explains the why, in the form and the voice of the existing cards, extending a card that exists rather than duplicating one; for this card, "why business words stand next to the dbt description, for the table and for each field". Claude wrote everything in the card from the requirements, the code of the web app and the storyboard of the Owner Journey, starting from the rule and the gain the storyboard drafted: the quote, the situation, the example, the three questions, the first question and the neighbours. Claude checked the existing set first: 4.7.1 asks the Owner to add their own words next to those of the Data Team; this card explains the Business Description itself, for the table and each field, and leaves to 4.7.1 the question whether the description of the Data Team is enough for the table. A "yes" to a suggestion weighs less than the author's own words, so the fact check, by someone of the Data Team, and the test reader carry more weight here than usual.

Published without a review first, at the author's request on 2026-11-15: "You may publish them all I'll review once in prod". The card is `reviewed` so that prod shows it in the Owner Journey; the author reads it there.

## To do

- [ ] Max reviews the card in prod, as he asked on 2026-11-15
- [ ] Fact check: someone of the Data Team reads the card against this record and the requirements
- [ ] Test reader: a colleague outside data reads the card in prod and says in their own words what they learned (DEC-LR-38)
- [ ] A marker on the Business Description of the Overview listing this card: to design first (DEC-LR-22)
- [ ] `node scripts/learning-card.ts links` does not count the steps of the Owner Journey (`packages/contracts/src/journey.ts`) as a place that meets a card; this card is met there, at Business Description and Fields
- [ ] Offer this card under Where to next of 4.7.1, in place of one of its two neighbours, once the family of the Owner Journey is reviewed
