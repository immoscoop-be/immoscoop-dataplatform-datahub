# Interview record · K5.10 What your Permission group allows

The input of the card as the interview gave it: what the author said, what Claude brought, and where each answer went in the card. It is what the fact check reads the card against.

| | |
| --- | --- |
| Card | K5.10 What your Permission group allows (Compass, section K5 Data Hub) |
| Author | Max |
| Interviewed | 2026-11-14, with the learning-card skill |
| Fact check | To name |
| Test reader | To name |

## 1. The reader's question

**Asked:** Not asked: the author asked Claude to write out all the cards on the states of Data Hub, to review them together.

**Answer:** Claude's suggestion, from the places that meet the reader (MSG-USR-01 "A User was moved to another Permission group", MSG-USR-02 "A member of the Data Team got Admin back" and MSG-USR-03 "A new User signed in for the first time"): "My colleague can write queries in Data Hub and I can't. Is something broken on my side?", from a colleague from sales after a demo. Whether colleagues say it this way is for the test reader.

**In the card:** Why now, the quote and the situation.

## 2. What went wrong

**Asked:** Not asked: drafted by Claude.

**Answer:** Claude's suggestion, from DEC-PL-01 (what a User may do comes from their Permission group; which data is theirs from their Owner Units), DEC-PL-04 (Messages by kind), DEC-PL-05 (results in Claude, in a card only or not in Claude), DEC-UX-191 (a User sees their own group on My page) and the three Messages, with their example: from Lens user, the default, to Business analyst, within 15 minutes, in the web app, Claude and Excel: a new colleague lands in Lens user, the default Permission group, reads it on My page, and is moved to Business analyst by the Data Team; within 15 minutes they make queries. Expected misconceptions, none heard yet: something is broken; refreshing helps; my Permission group follows my team; Claude made a mistake when it does not read my figures.

**In the card:** the situation of Why now; Core idea, "At Immoscoop"; the wrong answers of the three questions.

## 3. The aha

**Asked:** Not asked: drafted by Claude.

**Answer:** Claude's suggestion: what you may do comes from your Permission group, given by the Data Team, and which data is yours from your Owner Units: a missing button is a Permission you do not have, never a fault.

**In the card:** Core idea, the rule.

## 4. The everyday anchor

**Asked:** Not asked: drafted by Claude.

**Answer:** None. The author left the anchor out of K5.7 and K5.8 as not adding value to a card about a state of Data Hub, and asked for these cards in the same way: the reader meets the state on a screen, which is its physical part (DEC-LR-36).

**In the card:** nothing: Core idea holds the rule and the example only.

## 5. Never again, ask first

**Asked:** Not asked: drafted by Claude.

**Answer:** Claude's suggestion: never report a missing button as a fault before you checked your Permission group; ask first "Is this a Permission I do not have?". Tested out loud: either answer leads to a next step, not to a wrong one.

**In the card:** You can now, the first question; a wrong answer.

## 6. One card or a family

**Asked:** Not asked: drafted by Claude.

**Answer:** Claude's view: one card, next to K5.1 What a resource is and K5.9 A Lens in Excel.

**In the card:** Nothing; see To do.

## 7. Neighbours

**Asked:** Not asked: drafted by Claude.

**Answer:** Claude's suggestion: Next to it K5.1 and K5.9; Apply to My page (`/me`). Glossary term: Permission group.

**In the card:** Where to next, and the term in bold.

## The ladder

1. **Story:** a badge that opens some doors of a building and not others: the doors are not broken.
2. **Structure:** the User → their Permission group (what they may do) and their Owner Units (which data is theirs) → the buttons they see.
3. **Data Hub:** My page, with the Permission group and what it allows.

The card has no See it: the third rung is a screen of Data Hub, not a chart. Apply leads there instead. The first two rungs are pictures (Figma work); the card has no place for them yet.

## Who brought what

The author asked Claude to write out all the cards on the states of Data Hub, without an anchor, and reviews them together. Claude brought everything in the card, from the rules of Data Hub and its Messages. A "yes" to a suggestion weighs less than the author's own words, so the fact check and the test reader carry more weight here than usual.

The author reviewed the cards together: "All good", and asked Claude to check the open facts itself. Checked by Claude in the code on 2026-11-14, at the author's request (packages/contracts/src/permissions.ts): Lens user and Business analyst are the starting groups; Lens user, the default, makes no queries and writes Questions and Signals but no Remarks, so the first question asks about "Add a Remark" instead of "Add a Signal"; Lens user shows results of Claude in a card only, Business analyst in Claude. MSG-USR-03 goes to the Data Team, so the User reads the card from MSG-USR-01. Excel runs no queries, so the example says the new group holds in Excel, not that queries run there.

## To do

- [ ] Fact check: the example against MSG-USR-01 and DEC-PL-01
