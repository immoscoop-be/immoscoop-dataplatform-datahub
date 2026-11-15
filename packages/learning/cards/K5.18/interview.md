# Interview record · K5.18 What the Data Admin records

The input of the card as the drafting gave it: nobody was interviewed, so each answer is what Claude brought, from which requirement, and where it went in the card. It is what the fact check reads the card against.

| | |
| --- | --- |
| Card | K5.18 What the Data Admin records (Compass, section K5 Data Hub) |
| Author | Max |
| Interviewed | Not interviewed: drafted by Claude on 2026-11-15, with the learning-card skill |
| Fact check | To name |
| Test reader | To name, in prod (DEC-LR-38) |

## 1. The reader's question

**Asked:** Not asked: drafted by Claude.

**Answer:** Claude's suggestion, from the step "Table type, grain and mappings" of the Owner Journey, as the publication in the web app and Claude name it (`apps/web/client/src/texts/en.ts`, `apps/mcp/src/journey.ts`): "Publishing asks about a table type, a grain and mappings. Do I have to fill those in myself?", from a colleague from SEO before publishing a Resource. In Dutch the step says "Modeltype, grain en mappings", so the Dutch quote says "modeltype". The reader meets the card at that step, which names it after 2.3.6 (`packages/contracts/src/journey.ts`); no Message or marker names it yet. Whether colleagues say it this way is for the test reader.

**In the card:** Why now, the quote and the situation.

## 2. What went wrong

**Asked:** Not asked: drafted by Claude.

**Answer:** Claude's suggestion, from DEC-RC-09 and DEC-RC-10 (the grain and the model type are defined only in Data Hub, by the Data Admin; what Data Hub derives is a suggestion the Data Admin confirms), DEC-RC-13 and FR-CO-33 (the grain and the mappings of the fields are kept in Data Hub; no mapping is required; a mapping is a reference, not a join, and links every Resource that carries the same identity), FR-RC-08 and FR-RC-09 (the Resources it can be joined to), DEC-RC-15 (Data Hub does not check a grain against the data; the data stands for its own grain, for instance with a test in dbt), DEC-MR-16 (the table type and the grain are needed for the EDA, not to publish; the mappings are advised) and rule 8 of the instructions of the MCP server (recording the grain and the mappings is the work of the Data Admin, in the web app; Claude says so). Checked in the code: the Overview shows "model type: …" and "grain: …", marked From the Data Team, and under Entities the Resources it joins, or "No field is mapped yet."; "Edit relations" is for a Data Admin, whose Permission group has `resources.assign`; in the journey Claude can only ask the Data Team with `write_message`. The example follows the prototype of the Overview (`resource-overview.html`): Weekly lead volume, an aggregate of one row per week and lead source, with `lead_source` mapped to `leadSource.leadSourceId` and joining Lead sources. Expected misconceptions, none heard yet: Claude can fix the grain; the Owner corrects it on the Overview; a missing model type blocks the publication; the grain does not matter to the Owner; Data Hub links fields by their names; a mapping is required to publish.

**In the card:** the situation of Why now; Core idea, "At Immoscoop"; the wrong answers of the three questions.

## 3. The aha

**Asked:** Not asked: drafted by Claude.

**Answer:** The rule the storyboard drafted, kept in meaning: the Data Admin records the model type, the grain and the mappings of a Resource; its Owner checks them, because the EDA and every join start from them. Two changes by Claude. "Table type" became "model type", the word the Resource shows on its Overview, in the editor of the Data Admin and in 2.3.6, and the only word of the Dutch web app ("modeltype"); the English journey says "table type", so the quote keeps it and the situation names both once. The term in bold moved from the table type to the Data Admin, the Defined Term the title names, as 2.3.6 already holds the model type in bold.

**In the card:** Core idea, the rule.

## 4. The everyday anchor

**Asked:** Not asked: drafted by Claude.

**Answer:** None. As for K5.7 to K5.11, the author asked for these cards without an anchor: the reader checks the records on a screen of Data Hub, the model type, the grain and the Entities on the Overview, which is its physical part (DEC-LR-36).

**In the card:** nothing: Core idea holds the rule and the example only.

## 5. Never again, ask first

**Asked:** Not asked: drafted by Claude.

**Answer:** Claude's suggestion: never take what the Data Admin recorded as settled, nor ask Claude to change it; ask first "Is one row really what it says here?". Tested out loud: if the answer is yes, nothing needs doing; if it is no, the Owner asks the Data Team in a Message, and a Data Admin corrects it.

**In the card:** You can now, the first question; the wrong answers of the first and second questions.

## 6. One card or a family

**Asked:** Not asked: drafted by Claude.

**Answer:** One card on three records, as the journey asks for them in one step: who records them, and why the Owner checks them. What the model types and the grain mean for counting is 2.3.6 and 2.3.5, which this card points to rather than repeats. It is one of the family of the Owner Journey, K5.12 to K5.19, written together on 2026-11-15.

**In the card:** Nothing; see To do.

## 7. Neighbours

**Asked:** Not asked: drafted by Claude.

**Answer:** Claude's suggestion: Deeper 2.3.6 Five model types, and what each means for counting; Next to it 2.3.5 The grain question; Apply to Collections. Term in bold: Data Admin, a Defined Term.

**In the card:** Where to next, and the term in bold.

## The ladder

1. **Story:** a librarian who catalogues a new book, its kind, what one copy is and the shelves it links to, and the author who reads the catalogue card back before the book goes out.
2. **Structure:** a Resource with three records of the Data Admin: its model type, its grain (the fields that identify each row) and its mappings (field → Entity → the other Resources that carry it); its Owner reads them back, and asks the Data Team in a Message when one is off.
3. **Data Hub:** the model type and the grain on the Overview, marked From the Data Team, its Entities and the Resources it joins, "Edit relations" for a Data Admin, and in Claude the step "Table type, grain and mappings" of the Owner Journey.

The card has no See it: the third rung is a screen of Data Hub, not a chart. Apply leads there instead. The first two rungs are pictures (Figma work); the card has no place for them yet.

## Who brought what

Max, the author, asked for these cards in the brief for the Owner Journey of 2026-11-15, §6: each step refers to a card that explains the why, in the form and the voice of the existing cards, extending a card that exists rather than duplicating one; for this card, "grain and mappings: what the Data Admin records and why the Owner should check it". Claude wrote everything in the card from the requirements, the code of the web app and the MCP server, the prototype of the Overview and the storyboard of the Owner Journey, starting from the rule the storyboard drafted: the quote, the situation, the example, the gain, the three questions, the first question and the neighbours. Claude checked the existing set first: 2.3.5 explains the grain and 2.3.6 the model types; neither says who records them, explains mappings, or why the Owner reads them back. A "yes" to a suggestion weighs less than the author's own words, so the fact check, by someone of the Data Team, and the test reader carry more weight here than usual.

## To do

- [ ] Fact check: someone of the Data Team reads the card against this record and the requirements
- [ ] Test reader: a colleague outside data reads the card in prod and says in their own words what they learned (DEC-LR-38)
- [ ] The English web app says "table type" in the Owner Journey ("Table type, grain and mappings", "no table type recorded") and "model type" on the Resource and for the Data Admin; DEC-MR-16 and OP-ED-03 say table type, DEC-RC-10 model type; the Dutch says "modeltype" throughout. Once one word is chosen, drop the bridge in the situation and the "table type" of the quote
- [ ] A marker on the Entities of the Overview listing this card, and this card next to 2.3.6 on the marker of the model type: to design first (DEC-LR-22)
- [ ] `node scripts/learning-card.ts links` does not count the steps of the Owner Journey (`packages/contracts/src/journey.ts`) as a place that meets a card; this card is met there, at Table type, grain and mappings
