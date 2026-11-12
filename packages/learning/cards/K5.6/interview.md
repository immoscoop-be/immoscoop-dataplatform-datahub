# Interview record · K5.6 What a query costs

The input of the card as the interview gave it: what the author said, what Claude brought, and where each answer went in the card. It is what the fact check reads the card against.

| | |
| --- | --- |
| Card | K5.6 What a query costs (Compass, section K5 Data Hub); a new topic, added to `plan.json` with a note in the same change |
| Author | Max Passenier |
| Interviewed | 2026-11-12, by voice in Claude chat, along the learning-card recipe; written with the learning-card skill the same day |
| Fact check | To name |
| Test reader | To name |

## 1. The reader's question

**Asked:** Who asked you this recently, and how did they put it?

**Answer:** A lot of colleagues worry that they are consuming too much data and so throwing money out of the door.

**In the card:** Why now, the quote, in the reader's voice: "Am I consuming too much data with this? I don't want to throw money out of the door." The wording as one colleague's sentence is Claude's; the words are the author's. Who says it is "a colleague outside data, before running a query": the author spoke of many colleagues, not of one role. The situation of Why now: reading costs money, and without seeing how much a query reads, every query feels like a risk. The gain answers the worry in the reader's words: you see how much data a query reads before it runs, and no longer fear you are throwing money out of the door. Claude first wrote the gain as the aha again; `links` showed that Claude's `explain` missed the card on the reader's own words, and the reworded gain reads better for the reader too.

## 2. What went wrong

**Asked:** What went wrong, concretely? One metric from our dashboards, or one sentence a colleague said.

**Answer:** After two pushes: a very expensive one. A colleague was working on the raw event data. No volume and no cost were named; "terabytes against cents" was Claude's colouring, not the author's.

**In the card:** Core idea, "At Immoscoop": the case, without a volume or a cost, followed by what Data Hub does before a query runs. No See it: no figures were named, and the third rung is a screen (see The ladder). The wrong answers rest on the worry of question 1, not on a misconception the author named: the cost only shows afterwards, ask the Data Team to be safe, the bill comes later, every check costs a query.

## 3. The aha

**Asked:** What is the one thing that, once someone sees it, makes the rest obvious?

**Answer:** I see what I am doing. And if I do not get a warning, I am doing nothing wrong.

**In the card:** Core idea, the rule, with **Pre-flight** in bold: "The Pre-flight shows what a query will read before it runs, so you see what you are doing: as long as it gives no warning, you are doing nothing wrong." The two halves are the author's; tying them to the Pre-flight is Claude's. The right answer of the first question puts it to a new query.

## 4. The everyday anchor

**Asked:** Which everyday thing behaves exactly like this?

**Answer:** The author's first anchor: an agreement with a vendor, not on a fixed price but on a rate of spending. Claude pushed back: not something everyone has held. Claude's fuel pump with a preset amount was turned down by the author ("that doesn't exist"). Claude then suggested a prepaid phone card: you see the balance before you call, and a warning comes when it runs low. The author took it.

**In the card:** Core idea, "Like a prepaid phone card". The first sentence is the anchor as the author took it; the second, "Until then, you just call.", is Claude's, and carries the second half of the aha onto the anchor: to confirm with the author. While writing, Claude noticed that the anchor does not carry everything: a phone card's balance runs down over many calls, while the Pre-flight weighs each run on its own (`runs.ranges` is how much one run may read; Data Hub keeps no balance per User), and the card has no counterpart for the third zone, where the Data Team accepts first. Put to the author; see To do.

## 5. Never again, ask first

**Asked:** What may a colleague never do again after this card, and what do they ask first from now on?

**Answer:** The author: understand what the cost is when the interface shows a cost. Claude turned it into a ban and a question (never click past a warning unread; ask first "how heavy is this?"), which the author did not confirm.

**In the card:** You can now, with the first question "how heavy is this?"; the ban is the wrong answer "Approve it: the button lets you, so it must be fine" of the second question, and its Why ("clicking past it unread is the one thing to avoid"). Both are Claude's and stay on the to-do until the author confirms them.

## 6. One card or a family

**Asked:** Is this one card, or a small family?

**Answer:** One card.

**In the card:** Nothing.

## 7. Neighbours

**Asked:** Next to which existing cards, and which term of the glossary, does this one belong?

**Answer:** Claude proposed the weight of a Lens (light or heavy) and the card on the query behind a figure, neither written yet. Glossary term: Pre-flight. The author did not confirm; he had arrived home.

**In the card:** the term in bold is **Pre-flight**, as in `docs/definitions.md`. Where to next offers K5.1 What a resource is (Next to it), the only written neighbour, and an Apply to Query (`/query/new`), the place where the reader meets the Pre-flight. K2.3 BigQuery is not written, nor is K5.5 The query behind a figure; both go on the to-do. The weight of a Lens is no topic of the plan, and Data Hub withdrew it: a Lens shows no weight, light or heavy, and what it reads shows in its Pre-flight (DEC-UX-24, FR-LE-02 withdrawn).

## The ladder

1. **Story:** a prepaid phone: the balance on the screen before you dial, and the beep when it runs low.
2. **Structure:** three zones on one bar: it just runs, you are asked first, it is stopped.
3. **Data Hub:** the Pre-flight of a query: the bar at the foot of a query in Query, with a gauge that marks the two thresholds, what the query reads at most in the Run button, red with "Approve and run" above the first threshold, and "Send to the Data Team" above the second; on the page of a Lens it is in the Run button. No See it: the third rung is a screen, not a chart, and the Chart Server draws only charts; Apply leads to `/query/new` instead.

The first two rungs are pictures (Figma work); the card has no place for them yet.

## Who brought what

The author brought the worry, the case of the raw event data and the aha. Claude brought the prepaid phone card, the ban and the first question, and the neighbours. Writing the card, Claude also brought: the quote in one colleague's voice and its role; the second sentence of the anchor; the rule that ties the aha to the Pre-flight; the facts of Data Hub behind "At Immoscoop", checked in the docs (the Pre-flight shows what a query reads, in MB or GB, not a price, FR-SR-36; up to 100 MB it runs, from 100 MB to 1 GB its User approves it, above 1 GB the Data Team accepts a Request first, DEC-SR-29 and FR-SR-37, as the default of every Permission group in `runs.ranges`, `packages/contracts/src/permissions.ts`, where a group can set other thresholds, or refuse above the second instead of a Request; the Pre-flight is a dry run that reads nothing and costs nothing; a pop-out on Run says what reads less; an accepted Request lets that User run that query, DEC-SR-36; the answer comes back in the Message Centre, DEC-UX-116); and the four questions of Check your understanding, with their wrong answers. Claude wrote "by default" wherever the card names a threshold, because the thresholds come from the Permission group of the reader.

## To do

- [ ] Confirm the ban and the first question of question 5 with the author
- [ ] Ask the author for the volume of the expensive query on the raw event data; the card names none. The thresholds of the Pre-flight are checked against the docs (100 MB, 1 GB, a Request, the default of every Permission group); confirm with the author that "by default" is how the card should say it
- [x] Add K5.6 to `plan.json`, with a note: in the same change
- [ ] Offer K5.5 The query behind a figure under Where to next, once it is written
- [ ] Offer K2.3 BigQuery under Where to next, once it is written
- [ ] The weight of a Lens (light or heavy), proposed by Claude as a neighbour, is no topic and no longer a concept of Data Hub (DEC-UX-24): drop it, or ask the author what he meant
- [ ] Put to the author: the second sentence of the anchor, "Until then, you just call.", is Claude's; and the phone card's balance runs down over many calls, while the Pre-flight weighs each run on its own and has a third zone the card does not carry. Does the anchor still hold, or does it need another sentence from the author?
- [ ] Questions: the four questions and their wrong answers are Claude's. The author confirms that the wrong answers are misconceptions heard from colleagues (the cost only shows afterwards; ask the Data Team to be safe; a red button means you did something wrong; the bill comes later; every check costs a query)
- [ ] Fact check: "reading costs money" in Why now, that what a query reads is what it costs at Immoscoop; the card gives no price, as the docs give none
- [ ] Where it is met: no place in the web app links to the card yet (`links`, 2026-11-12). The Messages MSG-LEN-02 A Lens grew into large and MSG-LEN-03 A Lens grew into very large propose a card still to write, "What a query reads: partitions, the Pre-flight and its three ranges" (`SIZE_CARD` in `packages/contracts/src/messageCatalogue.ts`, nearest K2.3 BigQuery); once this card is reviewed, propose that they name K5.6, a change of the Message Catalogue. This card does not explain partitions or why a Lens waits for the Data Team: say so in that change, or leave those to K2.3
- [ ] A marker ⓘ on the Pre-flight bar of Query and on the Run button of a Lens, listing this card: to design first (DEC-LR-22)
- [ ] Offer this card under Where to next of K5.1, which has three choices today (Deeper 4.3.2, Next to it K3.4, Apply): the Data Team chooses what it replaces
- [ ] `explain` misses the card on "throwing money out of the door" and ranks it fifth on "am I consuming too much data" (`links`, 2026-11-12): it counts every "the" and "out", so cards with long rules win. Not fixed in the card, as words are never added for the search; a note for whoever looks after `packages/learning/src/explain.ts`
- [ ] Lens user, the default Permission group for new Users, does not make queries, so the Apply to Query does not open for them; they meet the Pre-flight in the Run button of a Lens. Decide whether the card or its Apply should say so
