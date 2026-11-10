---
number: 1.2.7
status: draft
minutes: 5
added: 2026-11-10
changed: 2026-11-10
gain: You tell "how many" from "how many times" before you add anything up.
---

# Why now

> How many listings did we have in October? I need one number for the monthly report.
> — A colleague from sales, about a monthly report

Two figures come back, 52,000 and 9,400, and both are right. The question asks two things at once, and a dashboard that adds up the days answers neither.

Promise: whether a figure tells how things stand, or what moved.

# Core idea

A **state** tells how things stand on one day and a movement what happened in a period: movements you add up over the period, a state you read on one day and never add up.

## Like a door

Its colour is a state: ask on any day and there is one answer. Its opening is a movement: it happens, at a time, again and again. Thirty days of "the door is red" is still one red door.

## At Immoscoop

Listings online on 31 October is a state: about 52,000. Listings added in October is a movement: about 9,400. For rent or for sale is neither: it describes a listing, and you split both by it. Add up the 31 daily counts of listings online and you get 1.6 million, every listing counted about 31 times.

# See it

```chart
{
  "semgraph": "calendarAverage",
  "metric": "listingsOnline",
  "title": "Listings online per day, per month (example figures)",
  "measureType": "unique",
  "uniqueAggregation": "daily",
  "unit": "month",
  "locale": "en",
  "context": { "domain": "Listings", "dataset": "Example", "reliability": "example figures" },
  "points": [
    { "period": "2026-05", "mean": 50800, "sd": 600 },
    { "period": "2026-06", "mean": 51300, "sd": 550 },
    { "period": "2026-07", "mean": 50200, "sd": 700 },
    { "period": "2026-08", "mean": 49600, "sd": 650 },
    { "period": "2026-09", "mean": 51400, "sd": 600 },
    { "period": "2026-10", "mean": 52000, "sd": 500 }
  ]
}
```

Look at: "per day" in the title, and the value of October.

You see: a state over a month is the average of its days, about 52,000 for October, never their sum of 1.6 million.

# Check your understanding

## Which of these is a state?

- [ ] Leads sent this week
- [x] Agencies with an active subscription on 1 November
- [ ] Listings taken offline in October

Why: a state tells how things stand on one day. The other two count what happened during a period.

## The dashboard shows active agencies for each day of last week: about 1,200 every day. How many active agencies were there that week?

- [ ] 8,400: the seven days added up
- [x] About 1,200: a state is read on a day, not added up over the days
- [ ] No way to tell

Why: adding up the seven days counts every agency seven times. For the week, take the state on one day, or the average of the days.

## You want to know whether October was a busy month for new listings. Which figure answers that?

- [ ] Listings online on 31 October
- [x] Listings added in October
- [ ] Listings online on each day of October, added up

Why: busy is about what happened, a movement, so you count what was added during the month. A state on one day says how many there were, not how many came in.

# You can now

tell whether a figure is a state or a movement before you add it up, and ask "are we counting what happened, or how things stand?"

## Where to next

- Deeper: 2.3.6
- Next to it: 1.2.2
- Apply: [Open Collections](/collections) Read the model type of a Resource: `state` or `event` tells you which one you are looking at.
