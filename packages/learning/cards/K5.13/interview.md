# Interview record · K5.13 Publishing a Resource

The input of the card as Claude drafted it, without an interview: what the brief asked, what Claude brought, and where each part went in the card. It is what the fact check reads the card against.

| | |
| --- | --- |
| Card | K5.13 Publishing a Resource (Compass, section K5 Data Hub) |
| Author | Max |
| Interviewed | Not interviewed: drafted by Claude on 2026-11-15, with the learning-card skill, from the brief of the author |
| Fact check | To name |
| Test reader | To name, in prod (DEC-LR-38) |

## 1. The reader's question

**Asked:** Not asked: drafted by Claude.

**Answer:** Claude's suggestion, for the moment the publication is open with the declaration in front of the reader (FR-SR-49, FR-MR-19): "If I tick this, am I confirming every figure in the table? And if one turns out wrong, can I take it back?", from a colleague from SEO. It carries the two worries the card answers, the figures and the way back; whether colleagues say it this way is for the test reader.

**In the card:** Why now, the quote and the situation.

## 2. What went wrong

**Asked:** Not asked: drafted by Claude.

**Answer:** Claude's suggestion, from step 11 of the storyboard: the publication of Search Console impressions, whole site, in the public Collection Attraction, owned by SEO. The facts: the publication says who will see the Resource, everyone who sees its Collection (FR-SR-31, FR-CO-17; for a private Collection still only the Owner Unit and the Data Team, as the web app says); it reads the whole card back and its declaration accepts every text on it, also those written before by a colleague or an earlier conversation, kept in the words ticked with the Confirmation (DEC-MR-17, FR-MR-19); the first Publication is the first Confirmation and raises the Level from 2 · Described to 3 · Confirmed (FR-SR-49, Rising and dropping); a Confirmation is about what the Resource is, not its figures, which the EDA explores (DEC-MR-07); a Publication is not undone, and the Owner marks the Resource deprecated instead (DEC-SR-28); only the User ticks the declaration and publishes, in Data Hub or in the window Claude shows, never Claude (DEC-CL-07, FR-CL-32). Expected misconceptions, none heard yet: publishing shows a Resource to the whole company; a Publication can be undone, by the Owner or the Data Team; the declaration covers only the texts you wrote yourself or agreed to with Claude. "Publishing means the figures are checked" is in the quote and the rule, but not asked again: 4.7.1 already asks it.

**In the card:** the situation of Why now; Core idea, "At Immoscoop"; the wrong answers of the three questions.

## 3. The aha

**Asked:** Not asked: drafted by Claude.

**Answer:** Claude's suggestion, as the storyboard drafted none for this card, from the four points of the brief ("what you declare, who will see it, that it is the first Confirmation and cannot be undone"): publishing a Resource is its first Confirmation, a declaration for the Owner Unit that every text on its card is right about what the Resource is, not its figures, after which everyone who sees its Collection sees it, as a Publication is not undone. Term in bold: Confirmation rather than Publication, as the rule turns on what you declare, and Confirmation is the name the reader meets on the Level and in the declaration.

**In the card:** Core idea, the rule.

## 4. The everyday anchor

**Asked:** Not asked: drafted by Claude.

**Answer:** None, as for K5.7 to K5.11: the reader meets the publication on a screen, its window in Data Hub or in Claude, with the card read back and the declaration to tick (DEC-LR-36).

**In the card:** nothing: Core idea holds the rule and the example only.

## 5. Never again, ask first

**Asked:** Not asked: drafted by Claude.

**Answer:** Claude's suggestion: never tick the declaration over a text you have not read, also one a colleague wrote; ask first "Do I stand for every text on it, also those I did not write?". Tested out loud: if the answer is no, the text goes back to its step before you tick (as Claude says in step 11 of the storyboard); if yes, you publish.

**In the card:** You can now, the first question; the wrong answers of the third question.

## 6. One card or a family

**Asked:** Not asked: drafted by Claude.

**Answer:** One card, the last step of the family the Owner Journey opens (K5.12 to K5.19, OP-CL-12). Who may publish (FR-SR-16, DEC-PL-06) and the hand-over of a Business Analyst to an Owner (the storyboard) are left out, to keep one idea.

**In the card:** Nothing; see To do.

## 7. Neighbours

**Asked:** Not asked: drafted by Claude.

**Answer:** Claude's suggestion: Next to it K5.12, the journey this step ends; Deeper K5.19, what comes after the Publication; Apply to Collections, where the Owner opens the publication of a Resource from its page. The journey step names K5.2 beside this card; it is not repeated under Where to next. Term in bold: Confirmation, a Defined Term.

**In the card:** Where to next, and the term in bold.

## The ladder

1. **Story:** a comic of three panels: a colleague of SEO reading the card back, ticking the declaration with the pen of their team, and the Resource lit up for the whole company, with no way back but a sign deprecated.
2. **Structure:** the publication as one window: who will see it, what Data Hub checked, the card read back, the declaration and the button, and after it the Level at 3 · Confirmed with the declaration kept.
3. **Data Hub:** the publication of a Resource, in Data Hub and in the window Claude shows.

The card has no See it: the third rung is a screen of Data Hub, not a chart. Apply leads there instead. The first two rungs are pictures (Figma work); the card has no place for them yet.

## Who brought what

The author asked for this card in the brief for the Owner Journey of 2026-11-15, §6: "Each step refers to a card that explains the why. Write the missing ones yourself, in the form and the voice of the existing cards", with for this one "what you declare, who will see it, that it is the first Confirmation and cannot be undone", and that `explain` finds it on the words an Owner would use (publish, publication, declaration, confirm). The storyboard drafted no core idea for it. Claude wrote everything in the card from the requirements (FR-SR-49, FR-SR-31, DEC-SR-28, DEC-MR-07, DEC-MR-17, FR-MR-19, DEC-CL-07, FR-CL-32), the texts of the publication in the web app and the storyboard: the quote, the situation, the rule, the example, the three questions and their wrong answers, the first question and the neighbours. A "yes" to a suggestion weighs less than the author's own words, so the fact check and the test reader carry more weight here than usual.

## To do

- [ ] Fact check: someone of the Data Team other than the author reads the card against the requirements named here
- [ ] The step Read it back and publish of the journey names this card (`packages/contracts/src/journey.ts`); `links` does not count the steps of the journey as a place yet
- [ ] A marker on the declaration of the publication listing this card: to design first (DEC-LR-22)
- [ ] Test reader: a colleague outside data reads the card in prod and says in their own words what they learned (DEC-LR-38)
