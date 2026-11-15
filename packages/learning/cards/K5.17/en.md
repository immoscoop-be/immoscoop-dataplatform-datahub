---
number: K5.17
status: draft
minutes: 4
added: 2026-11-15
changed: 2026-11-15
gain: You never compare this year with a start-up period that was never complete.
---

# Why now

> Impressions are up 150% on last February. Which of our changes did that?
> — A colleague from marketing, in the month report

Last February is not a month to compare with: the export of Search Console started halfway through it, and its first two weeks were a test. The table has rows from that day on, so nothing stopped the comparison.

Promise: from which day a Resource is reliable, and how that day differs from a Known Gap.

# Core idea

**Reliable since** is the day the whole table starts to be reliable; a Known Gap is a hole after that day, or in part of the rows.

## At Immoscoop

Search Console impressions, whole site, has rows from 14 February 2025, the day the export of Search Console started. Its first two weeks were a test, not yet complete, so the SEO team, its Owner, sets it reliable since 1 March 2025. The day stands under Known Behaviour on the Overview of the Resource, and its Summary says: do not read earlier data as reliable. The queries Google anonymises are another matter: they have no query text, in about a quarter of the rows, every day since. No later day would fix that, so they are a Known Gap of the Resource.

# See it

```chart
{
  "semgraph": "calendarAverage",
  "metric": "searchImpressions",
  "title": "Search Console impressions per day, per month (example figures)",
  "measureType": "additive",
  "unit": "month",
  "locale": "en",
  "context": { "domain": "Search Console", "dataset": "Example", "reliability": "example figures" },
  "points": [
    { "period": "2025-02", "mean": 19800, "sd": 8600, "n": 15 },
    { "period": "2025-03", "mean": 46200, "sd": 5200, "n": 31 },
    { "period": "2025-04", "mean": 47800, "sd": 5600, "n": 30 },
    { "period": "2025-05", "mean": 49100, "sd": 5900, "n": 31 },
    { "period": "2025-06", "mean": 45300, "sd": 5400, "n": 30 },
    { "period": "2025-07", "mean": 41800, "sd": 4800, "n": 31 },
    { "period": "2025-08", "mean": 40500, "sd": 4600, "n": 31 },
    { "period": "2025-09", "mean": 48900, "sd": 5500, "n": 30 },
    { "period": "2025-10", "mean": 50200, "sd": 5700, "n": 31 },
    { "period": "2025-11", "mean": 49600, "sd": 5600, "n": 30 },
    { "period": "2025-12", "mean": 43100, "sd": 6900, "n": 31 },
    { "period": "2026-01", "mean": 51800, "sd": 5800, "n": 31 },
    { "period": "2026-02", "mean": 50600, "sd": 5300, "n": 28 }
  ]
}
```

Look at: February 2025, the first month, before the day the Resource is reliable since: its 15 days are the test of the export.

You see: those days average about 20,000 impressions, against 40,000 to 52,000 a day in every month after. Against that test, February 2026 looks two and a half times as high; against the months after it, it is an ordinary month.

# Check your understanding

## A Resource has rows from 3 January 2024 and says Reliable since 1 April 2024. You want its trend over the longest period you can. Where does it start?

- [ ] On 3 January 2024: the table has rows from that day
- [ ] On 3 January 2024, leaving out the days that look odd
- [x] On 1 April 2024: what came before is not to be relied on, however complete it looks

Why: the first day in a table is when its rows start; reliable since is when they can be relied on. Its Owner set that day because the weeks before it fall short, whether or not that shows in a chart.

## A Resource is reliable since January 2025. In March 2026 a feed stopped, and ten days have no rows. What does its Owner change?

- [ ] Reliable since, to the day after the ten days
- [ ] Nothing: a hole that short needs no warning
- [x] They leave reliable since as it is, and add a Known Gap for those ten days

Why: moving the day would throw away more than a year that can be relied on, for a hole of ten days. A hole after the day a Resource is reliable since is a Known Gap, narrowed down to its period, so a reader steps around just those days.

## In a Resource of credit leads, the leads that come from MySQL rather than from the website never have a `visitorId`. Where does its Owner warn about it?

- [ ] In reliable since: a later day, as part of the table is never complete
- [ ] Nowhere: whoever needs the `visitorId` sees that it is empty
- [x] In a Known Gap, narrowed down to those rows and that field

Why: those rows never become complete, so no day of reliable since can warn about them, and a later day throws away everything else. A hole in part of the rows is a Known Gap: narrowed down to the rows and the field, it says exactly where it holds.

# You can now

ask "since when is this Resource reliable?" before you compare with its first months, and write a hole after that day as a Known Gap, not as a later day.

## Where to next

- Next to it: K5.3
- Next to it: K5.4
- Apply: [Open Collections](/collections) Open a Resource you use and find Reliable since under Known Behaviour on its Overview, before you compare with its first months.
