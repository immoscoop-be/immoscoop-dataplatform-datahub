---
number: K5.2
status: draft
minutes: 4
added: 2026-10-29
changed: 2026-10-29
gain: You know how far you may build on a Resource from its Level, and who to ask when it drops.
---

# Why now

> The table says 2 · Described. Can I put it in my report for the management team?
> — A colleague from marketing

Every Resource in Data Hub carries a Level, from 0 to 5. It does not grade the data: it says how far the Resource has come, and who stands for it.

Promise: what each Level promises, who lifts a Resource to it, and why it drops.

# Core idea

The **Level** says how much you may build on a Resource: at 2 · Described the Data Team has described it, from 3 · Confirmed its Owner vouches for it, and it drops as soon as what it stood on goes away.

## Like the editions in a library

A library marks which edition is checked and annotated. You may read every edition, but you quote the checked one, and you look again when the note disappears.

## For example

Weekly lead volume is 4 · Explored: the Data Team described it, the Credit team confirmed it and linked an EDA document. When its description goes missing in dbt, it drops to 1 · Available, and its Owner is told.

# See it

```chart
{
  "semgraph": "categoryComparison",
  "metric": "resources",
  "title": "The Resources of one Collection by Level (example figures)",
  "measureType": "additive",
  "statistic": "sum",
  "ordered": true,
  "period": "2026-09",
  "locale": "en",
  "context": { "domain": "Data Hub", "dataset": "Example", "reliability": "example figures" },
  "points": [
    { "category": "1 · Available", "sum": 12 },
    { "category": "2 · Described", "sum": 8 },
    { "category": "3 · Confirmed", "sum": 5 },
    { "category": "4 · Explored", "sum": 2 },
    { "category": "5 · Monitored", "sum": 0 }
  ]
}
```

Look at: the bars from 3 · Confirmed on.

You see: an Owner vouches for 7 of the 27 Resources. You may read all of them, but before you build a report for others on the 20 below, you check what they stand on, or ask their Owner.

# Check your understanding

## A Resource is 2 · Described. What does that tell you?

- [ ] Its Owner checked that its figures are right
- [x] The Data Team described it, and no Owner has confirmed it yet
- [ ] It may not be used

Why: at 2 · Described the choices are those of the Data Team; you may use it, knowing that nobody in the business confirmed them yet. From 3 · Confirmed an Owner vouches for it.

## The Level of a Resource you use dropped from 3 to 1. What happened, most likely?

- [x] A description went missing in dbt
- [ ] Someone found an error in its figures
- [ ] It moved to another Collection

Why: a Resource drops when what its Level stood on goes away: a description, its EDA document or its last active check. The Level says nothing about whether a figure is wrong.

## Open a Collection and look at the Levels of its Resources. Which Level tells you that someone in the business vouches for a Resource?

Try it: [Open Collections](/collections)

- [ ] 2 · Described
- [x] 3 · Confirmed
- [ ] 1 · Available

Why: confirming is what the Owner does when they publish a Resource: they declare that it is what its descriptions say.

# You can now

tell from the Level of a Resource how far you may build on it, and who to ask when it drops.

## Where to next

- Deeper: 3.3.3
- Next to it: K5.1
- Apply: [Open Collections](/collections) Find the Level of a Resource you use, and what it stands on.
