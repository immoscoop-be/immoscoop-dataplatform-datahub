# Interview record · K5.4 When a figure is final

The input of the card as the interview gave it: what the author said, what Claude brought, and where each answer went in the card. It is what the fact check reads the card against.

| | |
| --- | --- |
| Card | K5.4 When a figure is final (Compass, section K5 Data Hub); a new topic, added to `plan.json` with this card |
| Author | Max Passenier |
| Interviewed | 2026-11-12, by voice in Claude chat, along the learning-card recipe; written into the card in a Claude Code session the same day |
| Fact check | To name |
| Test reader | To name |

## 1. The reader's question

**Asked:** Who asked you this recently, and how did they put it?

**Answer:** Somebody said the numbers were odd, while they were looking at a period in which it is normal that they are odd, because data was still coming in. No role was given.

**In the card:** Why now: the quote "These numbers are odd.", said by "a colleague, looking at the most recent days of a dashboard" (the moment is the author's period that was still coming in; no role, as none was given); the situation in two sentences.

## 2. What went wrong

**Asked:** What went wrong, concretely? One metric from our dashboards, or one sentence a colleague said.

**Answer:** After a push for which numbers and how late: "semantics upon semantics". Sessions are classified with data of Google Ads, and that data came in over a period of seven days. So the sessions were there, but their classification still moved for a week. No figures were given.

**In the card:** Core idea, "At Immoscoop", in the author's words; See it, with example figures (paid sessions per day, the last seven days still low); the wrong answers. That the paid sessions of the last seven days "look low" is Claude's reading of "their classification still moved", as the hand-over asked for it: the fact check confirms the direction (see To do).

## 3. The aha

**Asked:** What is the one thing that, once someone sees it, makes the rest obvious?

**Answer:** Sometimes you need to wait to get a proper view. Claude's wording on top of it: a number has a ripening time; before that date it is not wrong, only not finished.

**In the card:** Core idea, the rule: "A recent figure is final only after its ripening time, the **Stability** of its Resource: before that it is not wrong, only not finished." The "sometimes" of the author is left out, as a rule is written without it (FR-LR-27); the ripening time and "not wrong, only not finished" are Claude's wording; tying the ripening time to Stability is Claude's, from `docs/definitions.md` (see To do).

## 4. The everyday anchor

**Asked:** Which everyday thing behaves exactly like this?

**Answer:** Elections. The author added: at a given point you are satisfied, and you know it will not be able to change any more.

**In the card:** Core idea, "Like an election night": the first municipalities counted early, the picture that swings as the big cities come in (Claude's details from the interview), nobody calling the first count wrong, and the author's moment at which you know the result will not change any more.

## 5. Never again, ask first

**Asked:** What may a colleague never do again after this card, and what do they ask first from now on?

**Answer:** Never question a recent number without looking at the stable-since date. The first question, "is this number final yet?", is Claude's wording.

**In the card:** You can now, with the first question; the ban is the wrong answer "Raise a Signal: the leads dropped yesterday" of the first question (a Signal reports that something seems odd about the data). The author's "stable-since date" is the Stability of the card, not Reliable since (see To do).

## 6. One card or a family

**Asked:** Is this one card, or a small family?

**Answer:** The author had no idea. Claude proposed one card on data that arrives late, and a possible second on data that can change by its nature (an account name); the author agreed.

**In the card:** Nothing; see To do. The card speaks only of data that is still coming in.

## 7. Neighbours

**Asked:** Next to which existing cards, and which term of the glossary, does this one belong?

**Answer:** Claude proposed K5.2 The Level of a Resource and 4.3.2 Versions and agreements with users; the author agreed. The glossary term was open.

**In the card:** Where to next: Next to it K5.2 and 4.3.2, both written, and Apply to Collections, to read Watch out on the Summary of a Resource. The term in bold is **Stability**, chosen by Claude when writing the card: it is the Defined Term of `docs/definitions.md` for "whether the data of a Resource is still settling or can change by nature, and from when it is final, for example stable = D-3" (see To do).

## The ladder

1. **Story:** an election night: the first counts, the picture that swings, and the moment the result is called.
2. **Structure:** one week counted on day 1 and counted again on day 8, side by side.
3. **Data Hub:** a chart of paid sessions per day in which the last seven days are still low: See it, the annotation on those days.

See it draws the third rung as a `movingWindowAverage` with a window of 1 (the daily values), started from its example `daily.json`, with 28 days of example figures as counted on the morning of 26 October: about 950 to 1,200 paid sessions a day, and the last seven days falling to 330. The Chart Server cannot mark those days, and it refuses a day after `asOf`, so the chart draws them as any other day, as a dashboard does; `Look at` points to them in words (OP-LR-31). The first two rungs are pictures (Figma work); the card has no place for them yet.

## Who brought what

The author brought the reader's remark, the case of Google Ads, the aha, the elections and the ban. Claude brought "ripening time", the details of the election night (municipalities, big cities) and the first question. When writing the card Claude brought: the gain, which takes the reader's "odd" and the author's "data was still coming in" of question 1; the term **Stability** and where to look for it today (Watch out, the pitfalls its Owner writes, or its Owner); the reading that the paid sessions of the last seven days look low; the example figures of See it; and the three questions of Check your understanding, with their wrong answers. Those wrong answers are Claude's: "Raise a Signal" stands for the author's ban; "the real trend, one day behind" and "late data is counted twice" in the spreadsheet question, and the two readings of Reliable since in the third question, are misconceptions Claude expects, not heard. The third question comes from the interview itself, where Claude first called the delay "stability, or reliable since". The author still checks them at the quality gate.

## To do

- [ ] The term. Checked while writing the card: `reliableSince`, shown as Reliable since and set through the attribute "available since" (FR-RC-13, Implemented), is a start date, since when the data of a Resource is reliable, not a delay; the card says so in its third question. The delay is **Stability** in `docs/definitions.md` (FR-RC-06, Proposed): "whether the data of a Resource is still settling or can change by nature, and from when it is final, for example stable = D-3". Data Hub has no field for it yet: the catalogue refuses one, and Stability comes in with monitoring (DEC-CM-15, FR-CM-11). Its term is still open (OP-RC-04). The card bolds Stability and sends the reader to Watch out on the Summary, where the Owner and the Data Team write the pitfalls (DEC-RC-17, FR-RC-23; the designs show "The current week is incomplete" there), or to the Owner. When OP-RC-04 chooses another term, or the field comes to the Resource Card, update the rule, "At Immoscoop", the questions, You can now and Apply, in both languages
- [ ] Ask the author for the figures (paid sessions on day 1 against day 8), for See it; until then they are example figures
- [ ] Fact check: confirm that the late data of Google Ads moves sessions into paid, so that the paid sessions of the last seven days look low first, and not the other way round
- [ ] Possible second card: data that can change by its nature (an account name), the other half of Stability
- [x] Add K5.4 to `plan.json`, with a note: done in this branch
- [ ] Data Team: keep K5.4 in K5, or place it in 1.4 Reading charts: time or 1.8 Reading charts: what is missing
- [ ] Where it is met, as `links` gave it on 2026-11-12: Claude finds the card through `explain` on its title, on Stability, on "data still coming in" and on "final", but misses it on "the numbers are odd": the card says figure, as the plan does, and the search also counts "the" and "are". No word was added for the search. No Message or marker names this card yet. Proposals: a marker on Watch out and on Reliable since in the Summary of a Resource, and on writing a Signal, whose placeholder asks "What seems odd about the data of this Resource?" (to design first, DEC-LR-22); and offer K5.4 under Where to next of K5.2, which has three choices today (the Data Team chooses what it replaces)
