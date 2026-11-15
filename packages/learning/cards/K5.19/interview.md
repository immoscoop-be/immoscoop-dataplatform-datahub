# Interview record · K5.19 After publication

The input of the card as Claude drafted it, without an interview: what the brief asked, what Claude brought, and where each part went in the card. It is what the fact check reads the card against.

| | |
| --- | --- |
| Card | K5.19 After publication (Compass, section K5 Data Hub) |
| Author | Max |
| Interviewed | Not interviewed: drafted by Claude on 2026-11-15, with the learning-card skill, from the brief of the author |
| Fact check | Claude, a review against the requirements and the code on 2026-11-15; Max reviews it in prod |
| Test reader | To name, in prod (DEC-LR-38) |

## 1. The reader's question

**Asked:** Not asked: drafted by Claude.

**Answer:** Claude's suggestion, from the warning everyone sees on a Resource whose schema changed after its last Confirmation, which also reaches the Owner as a Message (FR-MR-12, MSG-RES-03): "Our table shows a warning that it changed since we published it. Do we have to publish it again, or is it still fine?", from a colleague from SEO a month after publishing. Whether colleagues say it this way is for the test reader. A first draft opened with "A Message says …"; with the word Message in both its quote and its rule, `explain` put this card before 4.7.1 for the question "What do I need to do with this message?", which is 4.7.1's (`packages/learning/src/explain.test.ts`), so the quote names the warning instead.

**In the card:** Why now, the quote and the situation.

## 2. What went wrong

**Asked:** Not asked: drafted by Claude.

**Answer:** Claude's suggestion, from step 12 of the storyboard ("Staying its Owner") and the requirements: a change to the schema since the last Confirmation shows as a warning to everyone who sees the Resource, with what changed and when, and the Owner gets a Message, until the Owner Unit or the Data Team marks it seen; the Level and the Publication stay (FR-MR-12, DEC-MR-08). Questions and Signals come to the Owner Unit, a Signal also to the Data Team, and a Message is never private (the definitions of Message and Signal). The Level drops to 1 · Available when the description of the table, or the last one of a field, goes missing in dbt, the Owner is told (MSG-RES-05), the Publication stays (DEC-SR-08), and once the descriptions are back the earlier Confirmation still holds, as a Confirmation does not expire (FR-MR-15, DEC-MR-05, FR-MR-08 and the note on reconfirmation in Maturity and release). Only the descriptions from dbt count towards Described, so a Business Description does not bring the Level back (FR-MR-15). The next Level, 4 · Explored, takes an EDA, which covers at least the Key Fields (DEC-ED-07). Expected misconceptions, none heard yet: a change asks for publishing again; a change is the Data Team's to follow up; a Signal is for the Data Team alone; a Signal needs no answer; a Confirmation expires and is renewed.

**In the card:** the situation of Why now; Core idea, "At Immoscoop"; the wrong answers of the three questions.

## 3. The aha

**Asked:** Not asked: drafted by Claude.

**Answer:** The core idea the storyboard drafted: publishing starts the work of an Owner rather than ending it: you mark changes seen, answer Messages, and keep the Level where it is. Sharpened by Claude on review to "act when its Level drops": an Owner cannot hold the Level up alone, as only the descriptions in dbt count towards it (FR-MR-15); the example shows acting as asking the Data Team, which is the only way it comes back.

**In the card:** Core idea, the rule.

## 4. The everyday anchor

**Asked:** Not asked: drafted by Claude.

**Answer:** None, as for K5.7 to K5.11: the reader meets what comes after publication on screens of Data Hub, the warning on the Resource, the Messages and the Level, which are its physical part (DEC-LR-36).

**In the card:** nothing: Core idea holds the rule and the example only.

## 5. Never again, ask first

**Asked:** Not asked: drafted by Claude.

**Answer:** Claude's suggestion: never leave a warning or a Message on a published Resource for someone else to handle; ask first "What changed since we confirmed it?". Tested out loud: if nothing that matters to colleagues, mark it seen; if something does, the card says it first; either answer ends in the change marked seen.

**In the card:** You can now, the first question; the wrong answers of the first question.

## 6. One card or a family

**Asked:** Not asked: drafted by Claude.

**Answer:** One card, the last of the family the Owner Journey opens (K5.12 to K5.19, OP-CL-12). Deprecating a published Resource is K5.11; what a Level means for whoever reads it is K5.2; a breaking change is 4.3.2, and telling the Consumers about a change (MSG-RES-07) is 4.3.3, not written yet. The gain of the storyboard ("Your Resource stays worth relying on after the day you published it.") became "You keep your Resource worth relying on …", as a gain starts with what the reader does.

**In the card:** Nothing; see To do.

## 7. Neighbours

**Asked:** Not asked: drafted by Claude.

**Answer:** Claude's suggestion: Next to it K5.2, the Level the Owner keeps, which the journey step After names beside this card; Next to it K5.11, what to do when a published Resource should no longer be built on, as it cannot be unpublished; Apply to the Messages, where the changes, Questions and Signals wait and a change is marked seen. Term in bold: Owner, a Defined Term, as in 4.7.1, which this card extends past the day of publishing.

**In the card:** Where to next, and the term in bold.

## The ladder

1. **Story:** a comic of four panels with a colleague of SEO a month after publishing: a warning on the Resource, a Question from marketing, the Level dropping one night, and the Level back the next week.
2. **Structure:** three loops after the Publication: a change, looked at and marked seen; a Message, answered on the Resource and, when it keeps coming, put on the card; a drop of the Level, brought back with the Data Team.
3. **Data Hub:** the warning on the Resource, the Messages of the Owner Unit, and the Level on its Overview.

The card has no See it: the third rung is a screen of Data Hub, not a chart. Apply leads there instead. The first two rungs are pictures (Figma work); the card has no place for them yet.

## Who brought what

The author asked for this card in the brief for the Owner Journey of 2026-11-15, §6: "Each step refers to a card that explains the why. Write the missing ones yourself, in the form and the voice of the existing cards", with for this one "what staying Owner asks: changes, Messages, the Level", and that `explain` finds it on the words an Owner would use. The storyboard drafted its core idea and gain. Claude wrote everything else in the card from the requirements (FR-MR-12, DEC-MR-05, DEC-MR-08, FR-MR-15, DEC-SR-08, DEC-ED-07), the Message Catalogue and the storyboard: the quote, the situation, the example, the three questions and their wrong answers, the first question and the neighbours. Checked in the code: once its descriptions in dbt are back, a published Resource is at 3 · Confirmed again (`services/catalogue/src/resources.ts`). A "yes" to a suggestion weighs less than the author's own words, so the fact check and the test reader carry more weight here than usual.

Published without a review first, at the author's request on 2026-11-15: "You may publish them all I'll review once in prod". The card is `reviewed` so that prod shows it in the Owner Journey; the author reads it there.

## To do

- [ ] Max reviews the card in prod, as he asked on 2026-11-15
- [ ] Fact check: someone of the Data Team other than the author reads the card against the requirements named here
- [ ] The step After of the journey names this card (`packages/contracts/src/journey.ts`); `links` does not count the steps of the journey as a place yet
- [ ] Name this card under the Message "The schema changed since the last Confirmation" (MSG-RES-03), which names 4.3.2 now: a change of the Message Catalogue, for the author to decide
- [ ] Test reader: a colleague outside data reads the card in prod and says in their own words what they learned (DEC-LR-38)
