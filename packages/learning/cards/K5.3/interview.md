# Interview record · K5.3 The Known Gaps of a Resource

The input of the card as the interview gave it: what the author said, what Claude brought, and where each answer went in the card. It is what the fact check reads the card against.

| | |
| --- | --- |
| Card | K5.3 The Known Gaps of a Resource (Compass, section K5 Data Hub) |
| Author | Max Passenier |
| Interviewed | 2026-11-12, by voice in Claude chat, along the learning-card recipe; written into the card the same day with the learning-card skill |
| Fact check | To name |
| Test reader | To name |

## 1. The reader's question

**Asked:** Who asked you this recently, and how did they put it?

**Answer:** Not one question but the same one over and over: there was a mistake in the data, and we got asked about it again and again, because it never got documented. No literal quote was given.

**In the card:** Why now. The quote, "Why is the lead source empty for all those leads? What happened there?", and who says it, "A colleague who works with leads, not the first to ask", are Claude's wording of this answer, to word with the author (see To do). The situation: the same answer every time, nobody wrote it down, so the question keeps coming back.

## 2. What went wrong

**Asked:** What went wrong, concretely? One metric from our dashboards, or one sentence a colleague said.

**Answer:** First an observation: the issue is two-sided. One colleague sees the gap and asks about it, though they are not the first. Another does not see the gap, draws a conclusion, and the conclusion is wrong because there is a gap. Then the case: for a period we did not register the lead source when we registered leads, so the lead source cannot be told for that period. It was a registration mistake, and you cannot rewind what happened. No figures and no dates were given.

**In the card:** Why now, the situation: the lead source not registered for a period, and the two sides (the question that keeps coming back, the colleague who asks nothing and draws a wrong conclusion). Core idea, "At Immoscoop": the leads of that period are all there, their lead source cannot be told, and it cannot be rewound. See it: example figures, as no figures were given (see the ladder). The wrong answers: the side that asks again is "Ask the Data Team about it in a chat, and leave it at their answer" (first question); the side that draws a conclusion is "Nothing: the figures come from Data Hub, so the drop happened" and "Which release of the app caused the drop" (second question) and "count as if it were not there" (third question).

## 3. The aha

**Asked:** What is the one thing that, once someone sees it, makes the rest obvious?

**Answer:** The author did not understand the question at first. Claude then suggested: a hole in the data is not the problem, an undocumented hole is. The author agreed and added his own: by writing it down you help your colleagues; otherwise everybody makes the same mistake over and over on your data and draws wrong conclusions.

**In the card:** Core idea, the rule: "A hole in the data is not the problem, a hole nobody wrote down is" (Claude's first wording, agreed by the author), "write it down as a **Known Gap** of its Resource" (the place, from the glossary term of question 7), "so that the colleagues after you don't make the same mistake on it" (the author's addition).

## 4. The everyday anchor

**Asked:** Which everyday thing behaves exactly like this?

**Answer:** The author's first anchor: a sentence that is not finished; if you do not know the sentence was cut off, the message is wrong. Claude pushed back: it carries the wrong message, not the warning that is given once. Claude suggested a pothole in the road with a sign next to it; the author took it: "good enough, just warn people".

**In the card:** Core idea, "Like a pothole with a sign": the pothole, the sign next to it, the cyclists who steer around it (from the story of the ladder), and "Just warn people". Nothing was added to it: the anchor shows the pothole with its sign, and leaves to the reader that without the sign every cyclist rides into it.

## 5. Never again, ask first

**Asked:** What may a colleague never do again after this card, and what do they ask first from now on?

**Answer:** Never notice something about the data, or come to a conclusion about it, without warning your colleagues against making the same mistake. The first question, "which Known Gaps does this Resource have?", is Claude's suggestion; the author did not confirm it.

**In the card:** You can now: the first question (Claude's, still to confirm), and "warn your colleagues of every hole you find, as a Known Gap of its Resource" (the ban, turned into what to do). The ban is also the wrong answer "Nothing more: now that you know, you keep it in mind" of the first question.

## 6. One card or a family

**Asked:** Is this one card, or a small family?

**Answer:** One card: "it's just the chat about gaps".

**In the card:** Nothing.

## 7. Neighbours

**Asked:** Next to which existing cards, and which term of the glossary, does this one belong?

**Answer:** Left to Claude, from `explain`: K5.1 What a resource is, K5.2 The Level of a Resource, 4.7.1 Owning a Resource. Glossary term: Known Gap.

**In the card:** Where to next: Deeper 4.7.1 (Owning a Resource, which names Known Gaps as what an Owner describes later), Next to it K5.1 (the topic builds on it in the plan), and Apply to Collections, where a Resource shows its Known Gaps on its Overview. K5.2 is not offered: Where to next holds three choices, and the Level of a Resource does not rest on its Known Gaps. The rule bolds **Known Gap**.

## The ladder

1. **Story:** a road with a pothole and a sign in front of it; cyclists steer around it.
2. **Structure:** a timeline of a Resource with one stretch marked, and a note on it.
3. **Data Hub:** the Known Gaps on the Resource Card. A See it is possible (leads per lead source per month, with the period without a source), once the figures are known.

See it shows the third rung as the Chart Server draws it, from example figures until the real ones are known: a `calendarRatio` of the leads with a lead source per month, twelve months, with a gap from mid-March to mid-April 2026 that halves the share in those two months while the base of about 5,300 leads a month stays. Two choices of the chart follow from the Chart Server, not from the case. The share is of the leads *with* a lead source: a share close to zero squashes the base of leads under it (REQ-079), and the base staying is what the chart shows. And no month is at exactly 0% or 100%: the Chart Server reads a share with fewer than 10 on either side as resting on few observations, and writes a warning on the chart (REQ-080). So the example gap takes half of two months, not whole months, and the other months keep a handful of leads without a lead source. The Known Gaps themselves are on the Overview of a Resource, where Apply leads. The first two rungs are pictures (Figma work); the card has no place for them yet.

## Who brought what

The author brought the repeated question, the case of the lead source, the two sides of the trap and the ban. Claude brought the first wording of the aha, the pothole and the first question.

Writing the card, Claude also brought: the wording of the quote of Why now and of who says it; the example figures and the kind of chart of See it, and the period of the example gap; the gain; the four questions of Check your understanding, all Claude's, with their wrong answers taken from the two sides of question 2 and the ban of question 5, except "The Resource is unreliable, so you look for another one" (third question) and "When the Data Team will fix it" and "How many colleagues ran into it" (fourth question), which are Claude's own traps; the choice of the neighbours under Where to next; and the facts of Data Hub behind the example and the questions, checked in `docs/requirements/functional/05-resource-card.md`: a Known Gap is an item of its own on the Overview of a Resource, in plain text, with who added it and when (FR-RC-21); the Owner and the Data Team add, change and remove one (FR-RC-21; per attribute through `resources.describe`, DEC-PL-03); it may be narrowed down by a period, fields and rows (FR-RC-24); Claude reads that scope (FR-RC-25). The card does not mention the warning on a query that reads a Known Gap (FR-RC-27), which is proposed and not in v1.

## To do

- [ ] Ask the author for the figures and the period of the missing lead source, for See it, and replace the example figures and the example gap (mid-March to mid-April 2026) by them; keep "example figures" until then, or "rounded figures" once real
- [ ] Word the quote of Why now with the author, and who says it
- [ ] Confirm the first question of question 5 with the author
- [ ] Ask the author whether the wrong answers of the four questions are misconceptions he really heard
- [ ] Ask the author whether the pothole needs its other half (without the sign, every cyclist rides into it), which the card now leaves to the reader
- [x] Add K5.3 to `plan.json`, with a note (in the plan, in the same change as the card)
- [ ] Offer K4.4 Reporting an error or a doubt under Where to next, once it is written
- [ ] Nobody meets this card where its topic comes up (`links`, 2026-11-12): offer it under Where to next of 4.7.1, which names Known Gaps as an Owner's next step and has three choices today (the Data Team chooses what it replaces); and a marker ⓘ on the Known Gaps of a Resource on its Overview, and on the mark "Known Gap" of a field on Columns, listing this card: a new place, to design first (DEC-LR-22)
