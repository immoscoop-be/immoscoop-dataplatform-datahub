# Interview record · K5.17 Reliable since

The input of the card as the interview gave it: what the author said, what Claude brought, and where each answer went in the card. It is what the fact check reads the card against.

| | |
| --- | --- |
| Card | K5.17 Reliable since (Compass, section K5 Data Hub) |
| Author | Max |
| Interviewed | 2026-11-15, with the learning-card skill: not interviewed, drafted by Claude |
| Fact check | Claude, a review against the requirements and the code on 2026-11-15; Max reviews it in prod |
| Test reader | To name, in prod (DEC-LR-38) |

## 1. The reader's question

**Asked:** Not asked: drafted by Claude.

**Answer:** Claude's suggestion, from the storyboard of the Owner Journey (`docs/design/screens/owner-journey.html`, step 7), where the export behind Search Console impressions, whole site, starts on 14 February 2025 and its Owner sets it reliable since 1 March 2025, as "February was a test": "Impressions are up 150% on last February. Which of our changes did that?", from a colleague from marketing in the month report. Whether colleagues say it this way is for the test reader.

**In the card:** Why now, the quote and the situation.

## 2. What went wrong

**Asked:** Not asked: drafted by Claude.

**Answer:** Claude's suggestion, from the storyboard and the requirements: a table has rows from the day its export started, and its first weeks were a test, so a comparison with them runs without a warning and shows a rise that never happened. The facts of Data Hub behind the example: the Owner and the Data Team set since when the data is reliable (FR-RC-13, FR-RC-15; `resources.describe` "available since", DEC-PL-03); it is required to publish, with the Known Gaps, also when there are none (DEC-MR-16, FR-MR-17); in the web app it stands under Known Behaviour on the Overview, as "Reliable since" with its date, next to the intended use and the pitfalls (`ResourceOverview.svelte`, `resource.reliableSince`), while the Known Gaps have their own part right after it (DEC-RC-12); the Summary writes it under Watch out as "Reliable since {date}: do not read earlier data as reliable." (DEC-RC-17, `summary.reliable`), and Claude reads the same (`apps/mcp/src/summary.ts`); a Known Gap is a structural gap, narrowed down by a period, fields and rows (FR-RC-04, FR-RC-24). K5.4 already says that Reliable since is a start date, not how long the last days keep moving; this card does not repeat that. Expected misconceptions, none heard yet: reliable since is the first day in the table; a hole in March makes it reliable since April; a hole in part of the rows calls for a later day; a short hole needs no warning; leaving out the days that look odd is enough.

**In the card:** the situation of Why now; Core idea, "At Immoscoop"; See it; the wrong answers of the three questions.

## 3. The aha

**Asked:** Not asked: drafted by Claude.

**Answer:** The storyboard's rule, "Reliable since is the day from which the whole table can be relied on; a Known Gap is a hole after that day, or in part of the rows", sharpened by Claude without changing its meaning: "the day the whole table starts to be reliable", which says what is without "can" (FR-LR-27) and sets it apart from the day its rows start.

**In the card:** Core idea, the rule.

## 4. The everyday anchor

**Asked:** Not asked: drafted by Claude.

**Answer:** None. The author left the anchor out of K5.7 to K5.11 as not adding value to a card about Data Hub (DEC-LR-36), and the brief asked the same for the cards of the Owner Journey: the reader meets the day on a screen of Data Hub, under Known Behaviour on the Overview of a Resource and in its Summary, which is its physical part.

**In the card:** nothing: Core idea holds the rule and the example only.

## 5. Never again, ask first

**Asked:** Not asked: drafted by Claude.

**Answer:** Claude's suggestion: never compare with the months before the day a Resource is reliable since, and never move that day for a hole after it; ask first "Since when is this Resource reliable?". Tested out loud: when the answer is a day, the comparison starts there; when the Resource says nothing yet ("Nothing written yet."), the reader asks its Owner, and an Owner cannot publish it without one.

**In the card:** You can now, the first question; the wrong answers of the three questions.

## 6. One card or a family

**Asked:** Not asked: drafted by Claude.

**Answer:** Claude's view: one card, built on K5.3 (The Known Gaps of a Resource) as the plan says. K5.3 explains why a hole must be written down; this card says only where the start of a table ends and a Known Gap begins: one day for the whole table, against a hole after it or in part of the rows. Next to K5.4, which tells the start date from the ripening of the last days.

**In the card:** Nothing; see To do.

## 7. Neighbours

**Asked:** Not asked: drafted by Claude.

**Answer:** Claude's suggestion: Next to it K5.3 and K5.4; Apply to Collections, where Reliable since stands under Known Behaviour on the Overview of a Resource. Term in bold: Reliable since, a label of Data Hub, not a Defined Term.

**In the card:** Where to next, and the term in bold.

## The ladder

1. **Story:** a shop that opened halfway through last February, with half its shelves still empty: this February it sells two and a half times as much, and nobody calls that growth.
2. **Structure:** a timeline of a Resource: its first row, the day it is reliable since, and after it a short hole in one period and a band of rows that never hold one field.
3. **Data Hub:** Reliable since under Known Behaviour on the Overview, and "do not read earlier data as reliable" in its Summary.

See it shows the third rung as the Chart Server draws it, from example figures: a `calendarAverage` of the impressions per day in each month, from February 2025 to February 2026, with the 15 days of the test in February 2025 at about 20,000 a day against 40,000 to 52,000 in every month after, so that February 2026 looks two and a half times as high against the test (the 150% of the quote) and ordinary against the months after it. The average per day keeps the half month from looking low by its days alone: it is low because the test was not complete; `n` gives the days behind each month. The Chart Server cannot mark the day it is reliable since on the chart (OP-LR-31): Look at does that in words. The first two rungs are pictures (Figma work); the card has no place for them yet.

## Who brought what

The author asked for this card in the brief for the Owner Journey of 2026-11-15, §6: each step refers to a card that explains the why, written in the form and the voice of the existing cards, without duplicating one; reliable since is "the date from which the data can be relied on, and how it differs from a Known Gap", and `explain` must find the card on the words an Owner uses, such as reliable since. Claude wrote everything in the card from the requirements, the code of the web app and the storyboard of the Owner Journey: the quote, the example, the figures and the kind of chart of See it, the gain (the storyboard's, turned to the reader), the three questions with their wrong answers, the first question and the neighbours. The rule is the storyboard's, sharpened as said under question 3. The Known Gap of the questions on credit leads from MySQL without a `visitorId` is the example of FR-RC-04.

Published without a review first, at the author's request on 2026-11-15: "You may publish them all I'll review once in prod". The card is `reviewed` so that prod shows it in the Owner Journey; the author reads it there.

## To do

- [ ] Max reviews the card in prod, as he asked on 2026-11-15
- [ ] Fact check: someone of the Data Team other than the author reads the card against this record
- [ ] Replace the example figures of See it by the real impressions of Search Console, rounded, once the Resource is published; keep "example figures" until then
- [ ] Offer K5.12 The Owner Journey under Where to next, once it is written
- [ ] A marker ⓘ on Reliable since under Known Behaviour on the Overview of a Resource, listing this card: a new place, to design first (DEC-LR-22)
- [ ] Test reader: a colleague outside data reads the card in prod and says in their own words what they learned (DEC-LR-38)
