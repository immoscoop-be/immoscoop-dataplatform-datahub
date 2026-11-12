# The card format of Data Hub

A Learning Card in Data Hub is a Markdown file in a fixed shape, one per language: `packages/learning/cards/<number>/en.md` and `nl.md`, with the interview record `interview.md` beside them. Data Hub reads the five steps from the file (Why now, Core idea, See it, Check your understanding, You can now). The parser is `packages/learning/src/card.ts`; the rules are in `docs/requirements/functional/16-learning.md` (FR-LR-27, FR-LR-30, FR-LR-31, DEC-LR-19, DEC-LR-23, DEC-LR-24, DEC-LR-26, DEC-LR-31) and `docs/requirements/technical/16-learning.md` (TR-LR-01). Whatever does not fit this shape, Data Hub does not read: it goes into the interview record, not into the card.

Contents: 1. The skeleton · 2. Rules per part · 3. From interview to card · 4. The Dutch version · 5. The interview record · 6. Kinds of chart · 7. Where a card is met

## 1. The skeleton

The headings and the small labels are English keys, the same in both languages: `# Why now`, `Promise:`, `# Core idea`, `# See it`, `Look at:`, `You see:`, `# Check your understanding`, `Try it:`, `Why:`, `# You can now`, `## Where to next`, `Deeper:`, `Next to it:`, `Apply:`. Everything else is the text of the card.

````markdown
---
number: 2.1.3
status: draft
minutes: 5
added: 2026-11-10
changed: 2026-11-10
gain: What knowing it brings, in one sentence.
---

# Why now

> What a colleague says.
> — Who says it

The situation, in three sentences at most.

Promise: what this card is about.

# Core idea

The decision rule, in one sentence, with one **term** in bold.

## Like a <the anchor>

The anchor.

## At Immoscoop

The example.

# See it

```chart
{ "semgraph": "categoryComparison", … }
```

Look at: the part that matters.

You see: what it shows.

# Check your understanding

## <a question>

- [ ] a misconception
- [x] the answer
- [ ] another misconception

Why: why, without a verdict.

# You can now

what the reader can do now, starting with a verb.

## Where to next

- Deeper: 2.3.6
- Next to it: 1.2.2
- Apply: [Open Collections](/collections) Where to look.
````

Text may only hold `**bold**` and `` `a name` ``: no links in running text, no tables, no pictures, no lists outside the answers and the choices. Lines without a blank line between them become one paragraph.

## 2. Rules per part

**The facts on top.** Only these seven names; any other name the parser refuses.

| Fact | Rule |
| --- | --- |
| `number` | The number of the topic in `packages/learning/cards/plan.json`: `K4.4`, `1.2.7`, `R3`. The title of the card is in the plan, not in the file. |
| `status` | `draft` until the Data Team has reviewed the card (DEC-LR-25), then `reviewed`. The same in both languages. |
| `minutes` | Reading time in minutes, 1 to 99; usually 4 or 5. |
| `added`, `changed` | `YYYY-MM-DD`. |
| `gain` | What knowing it brings, in one sentence, to the reader ("You …"). The same sentence stands in every pop-out where the card appears (FR-LR-36), so it is never written for one place. |
| `translatedFrom` | Only in `nl.md`: the version of the English it follows. Never by hand: `node scripts/learning-card.ts stamp <number>`. |

**Why now.** Opens with a quote: what a colleague says, not a definition, and it does not name the concept yet. The last line of the quote is `> — who says it`: a role and, if useful, a moment ("A colleague from sales, on a Monday"), never a name. Then the situation: one situation, one pain, three sentences at most. It ends with `Promise: …`, what the card is about; the screen shows it as "In this card:".

**Core idea.** First the rule: one sentence, a decision rule, without "can", "sometimes" or "usually", with the term of the glossary in bold. Then exactly two parts under `## `: the anchor first, then the example. Their titles are free; the written cards use "Like a …" for the anchor and "For example" or "At Immoscoop" for the example.

**See it.** Optional, but a full card has it. A request of the Chart Server in a block ` ```chart ` … ` ``` `, as JSON, drawn as it is (DEC-LR-21, DEC-LR-26): from fixed figures in the card, never from live data. Always say in `context.reliability` what the figures are: "example figures" when they are made up or adjusted, "rounded figures" when they are real but rounded. Set `locale` to `en` or `nl-BE`, and give a title that says what is shown, not a conclusion. Then `Look at: …` (where to look) and `You see: …` (what it shows). The Chart Server cannot mark a part of a chart (OP-LR-31): `Look at` does that in words. If the Data Hub rung of the ladder is a screen and not a chart, leave See it out and say why in the interview record.

**Check your understanding.** Optional for a minimal card (DEC-LR-23), otherwise at least one question, usually three or four (DEC-LR-16). Each question stands under `## `, with at least two answers `- [ ] …` and exactly one `- [x] …`, and ends with `Why: …`.
- Each question puts the rule to a new situation, never the example of the card.
- The wrong answers are real misconceptions, heard from colleagues (FR-LR-30): from questions 2 and 5 of the interview.
- `Why:` says why, without a verdict: never "Right." or "Not quite." (DEC-LR-19).
- A try-it question can carry `Try it: [Open Collections](/collections)` before its answers; only a link inside Data Hub, never a resource key.

**You can now.** The text reads on from "You can now": start with a verb in lowercase ("recognise …", "ask …"). Then `## Where to next` with two or three choices (FR-LR-31), in any mix: twice `Next to it` is fine.
- `- Deeper: <number>` and `- Next to it: <number>`: only cards that are written. A neighbour that is not written yet goes on the to-do of the interview record.
- `- Apply: [label](/path) text`: where the topic meets the reader in Data Hub, with what to look at there. The paths that exist:

  | Path | Label | What the reader finds there |
  | --- | --- | --- |
  | `/collections` | Open Collections | The Collections with their Resources and Lenses: per Resource the descriptions, the grain, the model type, the Level, the Owner, the Known Gaps and the Messages; per Lens its page, where it runs with its Parameters |
  | `/query/new` | Open Query | A new query over the Resources the reader may see |
  | `/messages` | Open your Messages | The reader's Messages: Questions, Remarks, Signals and what Data Hub wrote itself |
  | `/charts` | Open Charts | The charts of the Chart Server, each with what it answers and examples |
  | `/learning` | Open the Learning Centre | The Learning Centre, with every card |

  There is no `/lenses`: Lenses have no section of their own and live in their Collections (DEC-UX-66), so a card on a Lens applies with `/collections` and says to open the Lens there.

## 3. From interview to card

| From the interview | In the card |
| --- | --- |
| Step 0: the topic in the plan | `number`; the title is in the plan |
| Question 1: who asked, and how | Why now: the quote and `> — who` (a role) |
| Question 2: what went wrong, with the figure | Why now: the situation · Core idea: the example · See it: the figures · the wrong answers |
| Question 3: the aha | Core idea: the rule |
| Question 4: the everyday anchor | Core idea: the anchor |
| Question 5: never again / ask first | You can now (the first question) · the wrong answers (the ban) |
| Question 6: one card or a family | Nothing in the card; follow-up cards on the to-do |
| Question 7: neighbours and glossary | Where to next (written cards only) · the term in bold |
| Gain | `gain` |
| The ladder | Rung 3 in See it or Apply; rungs 1 and 2 in the interview record |
| Who brought what | The interview record |

## 4. The Dutch version

Write `en.md` first, then translate it into `nl.md` (DEC-LR-24). The same in both languages: the facts (except `gain` and `translatedFrom`), the English headings and labels, the order of the questions and answers with the same right answer, the choices and their paths, the figures of the chart. Translated: every sentence, the titles of anchor and example, the questions, the labels of the links (except a name such as "Open Query"), and the title, categories and context of the chart, with `locale: nl-BE`. Names stay English (`creditLead`, `visitorId`, Lens, Resource), as everywhere in Data Hub (NFR-LOC-03). Figures in Dutch take a dot for thousands and a comma for decimals: 52.000, 4,0%. "You can now" reads on in Dutch with an infinitive: "een unieke telling herkennen …". Then stamp it; when the English changes later, the check says the Dutch is to update.

## 5. The interview record

`interview.md` stands beside `en.md` and `nl.md`, in English like everything in the repository (DEC-LR-31). Data Hub does not show it; it is the input of the card, as the topic of the master learning plan used to be (FR-LR-27), and the fact check reads the card against it. `packages/learning/src/interview.ts` names its sections, and the check holds a record to them:

```markdown
# Interview record · <number> <title from the plan>

<one sentence: what this is>

| | |
| --- | --- |
| Card | <number> <title> (<Learning Level>, <section>) |
| Author | <the data colleague> |
| Interviewed | <date>, with the learning-card skill |
| Fact check | <who, or To name> |
| Test reader | <a colleague outside data, or To name> |

## 1. The reader's question
**Asked:** … **Answer:** … **In the card:** …
## 2. What went wrong
## 3. The aha
## 4. The everyday anchor
## 5. Never again, ask first
## 6. One card or a family
## 7. Neighbours
## The ladder
1. **Story:** … 2. **Structure:** … 3. **Data Hub:** …
## Who brought what
## To do
- [ ] …
```

Write the answers in the author's words (translated when the interview ran in Dutch), including what you had to push back; a colleague's quote without a name. "In the card" says where the answer went, so that the fact check knows where to look.

## 6. Kinds of chart

The Chart Server draws these kinds. Each has its schema in `services/semgraph/semgraphs/<kind>/schema.json` and requests that it draws in `examples/`; in Data Hub they are under Charts.

| Kind | Answers |
| --- | --- |
| `categoryComparison` | Which category has the most, or the highest typical value? |
| `periodComparison` | Are we doing better or worse than in the period before? |
| `calendarAverage` | How much per day, on average, in each week, month, quarter or year? |
| `calendarMedian` | How much on a typical day, per calendar period? |
| `calendarRatio` | Which share in each calendar period, and on how large a base? |
| `movingWindowAverage` | How does this evolve, without the daily noise? |
| `movingWindowMedian` | How does the typical day evolve, without being pulled along by outliers? |
| `movingWindowRatio` | How does a share evolve, and how large is the base it rests on? |
| `distribution` | How are the values spread, where does the middle lie and how long is the tail? |
| `kpiTile` | How much is it now, and is that more or less than before? |
| `kpiStatus` | Are we on track for the target? |

Start from one of its examples, leave out `theme` and `size`, and put in the figures of the card. `scripts/learning-card.ts` holds the fields and their values to the schema of the kind; `services/semgraph/test/learning-cards.test.ts` draws every card and fails on a request the Chart Server refuses or deviates from. The examples of this skill use `calendarRatio` (2.1.3) and `calendarAverage` with `"measureType": "unique", "uniqueAggregation": "daily"` for a state (1.2.7); the written cards mostly use `categoryComparison`.

## 7. Where a card is met

A reader meets a card in the Learning Centre, and where its topic comes up. `node scripts/learning-card.ts links <number> ["words a reader uses" …]` lists those places for a card, worked out afresh each time; for a topic not written yet, it lists the places that want it.

| Where | How it links | Kept in |
| --- | --- | --- |
| Under a Message Data Hub writes | "Understand what is happening here", the card inline in the Message (FR-LR-38). Only a card the Message *names* shows; one it *proposes*, or names as the nearest to a card still to write, does not. Each says what it expects of the card. | `packages/contracts/src/messageCatalogue.ts`, the field `learningCard` |
| On a marker ⓘ of system text | A pop-out with the cards that explain the text, each with its gain; a click opens the card over the page (FR-LR-35, FR-LR-36). Markers are placed at a release (DEC-LR-22); a new place is designed first. | `packages/learning/src/markers.ts`, with the place on the screen in `MARKER_PLACES` |
| Under Where to next of another card | `Deeper:` or `Next to it:`, written cards only, two or three choices per card (FR-LR-31) | The `en.md` and `nl.md` of that card |
| The Learning Centre | Every topic of the plan, a card to be written without a page | `plan.json` |
| In Claude | Only when Claude calls `explain` of the MCP server: a search on the words of the title (counted three times), the rule of Core idea, the gain and the anchor; it returns the five best written cards (FR-CL-15) | `packages/learning/src/explain.ts` |

Three rules follow. The `gain` is the sentence of the card in every one of these places, so it is never written for one of them. A pop-out, a Message and `explain` offer only written cards, so a card nobody links to is found only by whoever browses the Learning Centre: propose a place on the to-do of the record. And whatever helps `explain` find the card must read well for the reader too: never add words for the search.
