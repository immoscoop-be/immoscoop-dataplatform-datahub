---
number: 3.3.3
status: draft
minutes: 4
added: 2026-10-29
changed: 2026-10-29
gain: You judge whether data is good enough for your decision, without waiting for perfect data.
---

# Why now

> Our visitor figures miss everyone who refuses cookies. So we can't use them at all, can we?
> — A colleague from product

No data is perfect, so "is it good?" has no answer. "Good enough for what?" has one, and it decides whether you use the figures or look for others.

Promise: how to judge data against what you want to do with it.

# Core idea

Data is **reliable** when it meets the expectation its label sets, for the use you have in mind: the same figures can be good enough for a trend and not for an invoice.

## Like a kitchen scale

A kitchen scale is reliable for a recipe and useless for weighing gold. The scale did not change; what you want from it did.

## For example

The visitor figures miss whoever refuses cookies, about the same share every week. For the trend of the last quarter that is good enough; to bill an agency per visitor it is not.

# See it

```chart
{
  "semgraph": "categoryComparison",
  "metric": "visitors",
  "title": "Measured visitors per week (example figures)",
  "measureType": "additive",
  "statistic": "sum",
  "ordered": true,
  "window": 35,
  "locale": "en",
  "context": { "domain": "Website", "dataset": "Example", "reliability": "example figures" },
  "points": [
    { "category": "W38", "sum": 41200 },
    { "category": "W39", "sum": 41900 },
    { "category": "W40", "sum": 44800 },
    { "category": "W41", "sum": 45600 },
    { "category": "W42", "sum": 46100 }
  ]
}
```

Look at: the rise from week 40 on.

You see: each week is too low by about the same share, so the rise is real. These figures carry the trend; they would not carry a bill per visitor.

# Check your understanding

## The weekly lead counts are confirmed by their Owner, but the last week is still incomplete. What are they good enough for today?

- [x] Comparing the weeks before the last one
- [ ] Reporting last week's total to KBC
- [ ] Nothing, until every week is complete

Why: the Resource says what to expect: weeks that are final may be compared, the current week is still settling. The same table is reliable for one use and not yet for the other.

## A table misses about 1% of its rows, always of the same kind. When does that matter?

- [ ] Always: a table with gaps is not reliable
- [x] When your question is about exactly the rows that are missing
- [ ] Never: 1% is too little to matter

Why: a known, steady gap is harmless for most uses and decisive for the one that needs those rows. Reliability is judged against the question, not on its own.

# You can now

judge whether data is good enough for what you want to do with it, instead of asking whether it is good.

## Where to next

- Next to it: K5.2
- Next to it: 1.2.1
- Apply: [Open Collections](/collections) Read the Known behaviour of a Resource before you use it for a decision.
