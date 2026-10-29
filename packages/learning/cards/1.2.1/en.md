---
number: 1.2.1
status: draft
minutes: 4
added: 2026-10-29
changed: 2026-10-29
gain: You quote a figure for what it really counts, so nobody reads page views as people.
---

# Why now

> The dashboard says 180,000 visits last week. That is a lot of people, isn't it?
> — A colleague from marketing

"Visits" can mean visitors, sessions or page views, and the three differ by a factor of several. Before you compare a figure or pass it on, you need to know which one it is.

Promise: how to tell what a figure counts, and what to ask when its label does not say.

# Core idea

A figure counts one thing: **visitors**, **sessions** and **page views** are three different counts of the same week, as one visitor can have several sessions and one session many page views.

## Like a museum

The people who came in, the times the door opened and the paintings looked at: three counts of one day at a museum, and none of them is the other.

## For example

One week has 25,000 visitors, 61,000 sessions and 180,000 page views. A chart labelled "visits" that shows 180,000 counts page views, not people.

# See it

```chart
{
  "semgraph": "categoryComparison",
  "metric": "visits",
  "title": "Three counts of the same week (example figures)",
  "measureType": "additive",
  "statistic": "sum",
  "period": "2026-W40",
  "locale": "en",
  "context": { "domain": "Website", "dataset": "Example", "reliability": "example figures" },
  "points": [
    { "category": "Visitors", "sum": 25000 },
    { "category": "Sessions", "sum": 61000 },
    { "category": "Page views", "sum": 180000 }
  ]
}
```

Look at: the three bars of the same week.

You see: one week counts 25,000, 61,000 or 180,000, depending on what is counted. A label that only says "visits" does not tell you which of the three you have.

# Check your understanding

## A tile says "Visits: 61,000". What do you do before you pass it on?

- [ ] Read it as 61,000 people
- [x] Ask whether it counts visitors, sessions or page views
- [ ] Divide it by seven to get a day

Why: "visits" is no count of its own; the answer decides whether you are talking about people, visits or pages.

## One visitor comes three times in a week and looks at four pages each time. What does the week count?

- [x] 1 visitor, 3 sessions and 12 page views
- [ ] 3 visitors, 3 sessions and 12 page views
- [ ] 1 visitor, 1 session and 12 page views

Why: a visitor counts once in the week, each visit is a session, and every page looked at is a page view.

# You can now

tell what a figure counts, and ask for the agreed term when its label does not say.

## Where to next

- Deeper: 1.2.2
- Next to it: 2.3.5
- Apply: [Open Collections](/collections) Read the description of a field before you count with it.
