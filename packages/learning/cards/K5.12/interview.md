# Interview record · K5.12 The Owner Journey

The input of the card as Claude drafted it, without an interview: what the brief asked, what Claude brought, and where each part went in the card. It is what the fact check reads the card against.

| | |
| --- | --- |
| Card | K5.12 The Owner Journey (Compass, section K5 Data Hub) |
| Author | Max |
| Interviewed | Not interviewed: drafted by Claude on 2026-11-15, with the learning-card skill, from the brief of the author |
| Fact check | To name |
| Test reader | To name, in prod (DEC-LR-38) |

## 1. The reader's question

**Asked:** Not asked: drafted by Claude.

**Answer:** Claude's suggestion, from DEC-CL-17 (a request to publish, describe or take on a Resource starts the journey, and the publication offers no declaration while a required step is open) and the storyboard `docs/design/screens/owner-journey.html`: "I asked Claude to publish our Search Console table, and it wants to go through steps first. Can't I just publish it now and describe it later?", from a colleague from SEO the first time they publish a Resource. Nobody has said it yet, as the journey is new; whether colleagues say it this way is for the test reader. The words an Owner would use, which the brief asks `explain` to find (publish, describe, steps), are in the quote because the reader would say them, not added for the search.

**In the card:** Why now, the quote and the situation.

## 2. What went wrong

**Asked:** Not asked: drafted by Claude.

**Answer:** Claude's suggestion, from the test case of the storyboard: Search Console impressions, whole site, in Attraction, owned by SEO, at 2 · Described and not published, with its intended use and one pitfall written before and the rest empty. The facts: the thirteen steps and their order in `packages/contracts/src/journey.ts` (OP-CL-12, FR-CL-30), the three marks of DEC-MR-16 (required to publish, needed for the EDA, advised), the catalogue refusing a Publication while a required step is open (DEC-MR-15, FR-MR-17), the journey kept with the Resource and resumed in any conversation, for any member of the Owner Unit (FR-CL-30, the definition of Owner Journey), and a text written only once the Owner agrees (DEC-MR-17, FR-CL-30). Expected misconceptions, none heard yet: the journey lives in one conversation; only whoever started it goes on; every step must be done before publishing; ticking the declaration covers what is still open; the order is a suggestion; the Data Team approves each text.

**In the card:** the situation of Why now; Core idea, "At Immoscoop"; the wrong answers of the three questions.

## 3. The aha

**Asked:** Not asked: drafted by Claude.

**Answer:** The core idea the storyboard drafted, sharpened by Claude with "one step at a time" (the word steps is how the reader names it): the Owner Journey takes a Resource from described to published in a fixed order, first what it is, then how to use it and where it trips people up, and last what you vouch for. The order is the point the brief asked for ("the steps in order and why the order is what it is"): what it is comes first because the rest builds on it, the Key Fields before the other fields as colleagues and the EDA start from them, and the read-back last because the declaration covers every text before it.

**In the card:** Core idea, the rule; the why of the order in "At Immoscoop" and in the third question.

## 4. The everyday anchor

**Asked:** Not asked: drafted by Claude.

**Answer:** None, as for K5.7 to K5.11: the reader meets the journey on a screen, the window of the journey in Claude and the Maturity on the Overview of the Resource, which is its physical part (DEC-LR-36). Rule and example are clear without one.

**In the card:** nothing: Core idea holds the rule and the example only.

## 5. Never again, ask first

**Asked:** Not asked: drafted by Claude.

**Answer:** Claude's suggestion: never plan a publication as one click and the descriptions as something for later; ask first "Which required steps are still open, and where did we stop?". Tested out loud: if none is open, the publication opens; if some are, Claude goes on at the first open one, in any conversation; if nobody started, the answer is the whole list, which is still the right start.

**In the card:** You can now, the first question; the wrong answers of the second question.

## 6. One card or a family

**Asked:** Not asked: drafted by Claude.

**Answer:** A family, set by the brief and by OP-CL-12: this card opens it, and each step has its own card (K5.13 Publishing a Resource, K5.14 The Business Description, K5.15 Key Fields and Parameters, K5.16 Pitfalls, K5.17 Reliable since, K5.18 What the Data Admin records, K5.19 After publication), next to the cards that exist: 4.7.1, K5.1, 2.3.5, 2.3.6, 3.3.3 (extended for the intended use), K5.3 and K5.2. This card names the steps in one sentence each and explains the order; why each step matters is for its own card, so as not to duplicate them.

**In the card:** Nothing; see To do.

## 7. Neighbours

**Asked:** Not asked: drafted by Claude.

**Answer:** Claude's suggestion: Deeper K5.13, the last step, written in the same batch; Next to it 4.7.1, the card the step Start names beside this one, on why an Owner describes and publishes at all; Apply to Collections, the Maturity on the Overview of a Resource, which shows the same list of steps as the journey (FR-MR-17). Term in bold: Owner Journey, a Defined Term (`docs/definitions.md`).

**In the card:** Where to next, and the term in bold.

## The ladder

1. **Story:** a comic of four panels with a colleague of SEO: asking Claude to publish, Claude answering with the steps, stopping halfway, and a colleague picking it up three days later in a new conversation.
2. **Structure:** the ladder of thirteen steps in three groups, what it is, how to use it and where it trips people up, what you vouch for, each step marked required, for the EDA or advised.
3. **Data Hub:** the window of the journey in Claude and the Maturity on the Overview of the Resource, with each step required to publish, done or open.

The card has no See it: the third rung is a screen of Data Hub, not a chart. Apply leads there instead. The first two rungs are pictures (Figma work); the card has no place for them yet.

## Who brought what

The author asked for this card in the brief for the Owner Journey of 2026-11-15, §6: "Each step refers to a card that explains the why. Write the missing ones yourself, in the form and the voice of the existing cards", with for this one "the steps in order and why the order is what it is", and that `explain` finds it on the words an Owner would use. The storyboard drafted its core idea and gain. Claude wrote everything in the card from the requirements (DEC-MR-15, DEC-MR-16, DEC-MR-17, DEC-CL-17, FR-CL-30, FR-CL-31, FR-MR-17), `packages/contracts/src/journey.ts` and the storyboard: the quote, the situation, the example, the three questions and their wrong answers, the first question and the neighbours. The gain of the storyboard gained "describing" so that it names both halves of the work. A "yes" to a suggestion weighs less than the author's own words, so the fact check and the test reader carry more weight here than usual.

## To do

- [ ] Fact check: someone of the Data Team other than the author reads the card against the requirements named here
- [ ] Once K5.14 to K5.18 are written, consider K5.14 under Where to next, the first step that writes a text
- [ ] The step Start of the journey names this card (`packages/contracts/src/journey.ts`); `links` does not count the steps of the journey as a place yet
- [ ] A marker on the Maturity of a Resource listing this card: to design first (DEC-LR-22)
- [ ] Test reader: a colleague outside data reads the card in prod and says in their own words what they learned (DEC-LR-38)
