---
number: 4.3.1
status: draft
minutes: 5
added: 2026-10-29
changed: 2026-10-29
gain: You change a definition without losing the trust of whoever relies on it.
---

# Why now

> Credit leads dropped 15% overnight. Did something break?
> — A colleague from the credit team

Nothing broke: from Monday a lead counts only once it is confirmed. The figure is better than before, but whoever did not know reads a drop that never happened.

Promise: how to change a definition so that everyone still trusts the figures after.

# Core idea

A **definition** may change when you learn more; trust breaks only when the change is silent, so you change it in one place, announce the day it starts, and mark the break in the series.

## Like a new rule in a sport

When football changed its offside rule, nobody doubted the scores: the change was announced before the season, and the records name the year it started.

## For example

From 1 October a credit lead counts only after the visitor confirmed it. The Owner changes it in dbt, writes it in the description of the field, tells those who use the Resource, and the chart of the year shows a line at 1 October: "new definition".

# See it

```chart
{
  "semgraph": "categoryComparison",
  "metric": "creditLeads",
  "title": "Credit leads per week, before and after a new definition (example figures)",
  "measureType": "additive",
  "statistic": "sum",
  "ordered": true,
  "window": 35,
  "locale": "en",
  "context": { "domain": "Credit leads", "dataset": "Example", "reliability": "example figures" },
  "points": [
    { "category": "W38", "sum": 1240 },
    { "category": "W39", "sum": 1210 },
    { "category": "W40", "sum": 1050 },
    { "category": "W41", "sum": 1035 },
    { "category": "W42", "sum": 1060 }
  ]
}
```

Look at: the step between week 39 and week 40.

You see: about 160 fewer leads a week from the week the new definition started. The leads did not drop; what counts as a lead changed. Without the announcement, and without a mark in the chart, it reads as a drop.

# Check your understanding

## You find that the count of active offices includes offices without any listing. How do you change it?

- [ ] Fix it in the dashboard that shows it
- [x] Change the definition in dbt, announce the day it starts, and mark the break
- [ ] Wait until nobody uses the figure any more

Why: a definition lives in one place. Changing it there and telling whoever relies on it keeps their trust; a quiet fix in one dashboard makes two truths.

## After a change of definition, the chart of the year shows one smooth line. What is missing?

- [x] Where the old definition stops and the new one starts
- [ ] A dashed line for the whole year
- [ ] Nothing: the line shows every week

Why: before and after a change is no continuous trend. The break must show, so that nobody reads the step as a change in the business.

# You can now

change a definition visibly: in one place, announced, and marked in the series, so the figures keep their trust.

## Where to next

- Deeper: 4.3.2
- Next to it: K3.4
- Apply: [Open Collections](/collections) Read the descriptions of a Resource you own, and check that they say what counts today.
