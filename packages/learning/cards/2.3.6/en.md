---
number: 2.3.6
status: draft
minutes: 6
added: 2026-10-29
changed: 2026-10-29
gain: You see from the model type of a Resource what you may add up, and what never.
---

# Why now

> We had 52,000 listings online every day last week, so 364,000 listings that week?
> — A colleague, preparing a slide

Some tables you may add up over days, others never. The difference is not in the numbers but in what one row means, and every Resource says it with its model type.

Promise: the five model types, and what each means for counting.

# Core idea

The **model type** says what one row is, and with it what you may count: an `event` and a `fact` you add up, a `state` you count at a moment, a `dimension` describes others, and an `aggregate` you never add up again.

## Like a shop

The till receipts are events: add them up. The stock on the shelves is a state: you count it at closing time, not every hour added up. The price list is a dimension: it describes the products. The weekly sales report is an aggregate: its totals are made already.

## For example

An `event` is one row per thing that happened, at a moment, and never changes after, such as a lead sent. A `state` is one row per thing as it is, or was at a moment, such as a listing online on a day. A `fact` is one row per business occurrence with the measures to add up. A `dimension` is one row per thing that describes others, such as an agency. An `aggregate` is one row per group with its counts already made.

# See it

```chart
{
  "semgraph": "categoryComparison",
  "metric": "listingsOnline",
  "title": "Listings online on each day of one week (example figures)",
  "measureType": "additive",
  "statistic": "sum",
  "ordered": true,
  "window": 7,
  "locale": "en",
  "context": { "domain": "Listings", "dataset": "Example", "reliability": "example figures" },
  "points": [
    { "category": "Mon", "sum": 51800 },
    { "category": "Tue", "sum": 52100 },
    { "category": "Wed", "sum": 52000 },
    { "category": "Thu", "sum": 52300 },
    { "category": "Fri", "sum": 51900 },
    { "category": "Sat", "sum": 51700 },
    { "category": "Sun", "sum": 52200 }
  ]
}
```

Look at: seven bars of about 52,000, one for each day.

You see: mostly the same listings, counted again every day. Listings online is a state: the week has about 52,000 listings online, not seven times as many.

# Check your understanding

## A Resource holds one row per lead sent, with its moment. Which model type is it?

- [x] event
- [ ] state
- [ ] dimension

Why: a lead sent happened once, at a moment, and its row never changes after: that is an event, and its rows you may add up.

## A Resource holds one row per agency per week, with the number of leads it received. What may you do with it?

- [ ] Add up its rows over the year to count agencies
- [x] Read its counts as they are made, and add up the leads, not unique counts
- [ ] Treat it as an event

Why: it is an aggregate: its counts are made already. Adding up a unique count again would count agencies twice, as in 1.2.2.

## Open a Resource and look at its model type on its Overview. Which word does it show?

Try it: [Open Collections](/collections)

- [x] One of event, state, fact, dimension or aggregate
- [ ] Its number of rows
- [ ] The name of its dbt project

Why: every Resource in a Collection names its model type, next to its grain, so that you know what you may count before you open it in Query.

# You can now

tell the five model types apart, and say for each whether you may add up its rows.

## Where to next

- Next to it: 2.3.5
- Next to it: 1.2.2
- Apply: [Open Collections](/collections) Read the model type of a Resource before you add anything up.
