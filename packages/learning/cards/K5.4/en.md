---
number: K5.4
status: draft
minutes: 4
added: 2026-11-12
changed: 2026-11-12
gain: When a recent figure looks odd, you know whether it is wrong or its data is still coming in.
---

# Why now

> These numbers are odd.
> — A colleague, looking at the most recent days of a dashboard

They were looking at a period whose data was still coming in. For those days odd figures are normal, and they still move from one day to the next.

Promise: how to tell a figure that is wrong from one that is not finished yet.

# Core idea

A recent figure is final only after its ripening time, the **Stability** of its Resource: before that it is not wrong, only not finished.

## Like an election night

On election night the first municipalities are counted early, and the picture swings as the big cities come in. Nobody calls the first count wrong: it is not finished. At a given point every vote is counted, and you know the result will not change any more.

## At Immoscoop

Sessions are classified with data of Google Ads, which comes in over seven days. The sessions are there the next morning, but whether they were paid still moves for a week: the paid sessions of the last seven days look low until that week has passed. Data Hub has no field for the Stability yet: look for it under Watch out on the Resource, in the pitfalls its Owner writes, and ask its Owner when it is not there.

# See it

```chart
{
  "semgraph": "movingWindowAverage",
  "metric": "paidSessions",
  "title": "Paid sessions per day, as counted on 26 October (example figures)",
  "measureType": "additive",
  "window": 1,
  "asOf": "2026-10-25",
  "locale": "en",
  "context": { "domain": "Sessions", "dataset": "Example", "reliability": "example figures" },
  "points": [
    { "end": "2026-09-28", "mean": 1180 },
    { "end": "2026-09-29", "mean": 1150 },
    { "end": "2026-09-30", "mean": 1120 },
    { "end": "2026-10-01", "mean": 1190 },
    { "end": "2026-10-02", "mean": 1100 },
    { "end": "2026-10-03", "mean": 960 },
    { "end": "2026-10-04", "mean": 990 },
    { "end": "2026-10-05", "mean": 1170 },
    { "end": "2026-10-06", "mean": 1140 },
    { "end": "2026-10-07", "mean": 1160 },
    { "end": "2026-10-08", "mean": 1130 },
    { "end": "2026-10-09", "mean": 1090 },
    { "end": "2026-10-10", "mean": 940 },
    { "end": "2026-10-11", "mean": 1010 },
    { "end": "2026-10-12", "mean": 1200 },
    { "end": "2026-10-13", "mean": 1150 },
    { "end": "2026-10-14", "mean": 1120 },
    { "end": "2026-10-15", "mean": 1170 },
    { "end": "2026-10-16", "mean": 1110 },
    { "end": "2026-10-17", "mean": 970 },
    { "end": "2026-10-18", "mean": 1000 },
    { "end": "2026-10-19", "mean": 1130 },
    { "end": "2026-10-20", "mean": 1040 },
    { "end": "2026-10-21", "mean": 930 },
    { "end": "2026-10-22", "mean": 850 },
    { "end": "2026-10-23", "mean": 660 },
    { "end": "2026-10-24", "mean": 450 },
    { "end": "2026-10-25", "mean": 330 }
  ]
}
```

Look at: the last seven days, right of −7d.

You see: they fall step by step, to 330 on the last day, against about 950 to 1,200 on the days before. Nothing dropped: those days are still being classified, and a week later they stand as high as the days before them.

# Check your understanding

## The pitfalls of a Resource of leads say that late leads arrive for up to three days. Yesterday shows 30% fewer leads than a normal day. What do you do?

- [ ] Raise a Signal: the leads dropped yesterday
- [x] Wait until yesterday is three days old, then compare it
- [ ] Leave yesterday out of your reports for good

Why: for three days, yesterday is not finished: late leads are still coming in. Once those days have passed, its figure is final, and only then is a drop a drop.

## Every morning a colleague copies the figure of the day before into a spreadsheet, to follow the trend. The data keeps coming in for five days. What does the spreadsheet show?

- [ ] The real trend, one day behind
- [x] A trend that is too low: every day was copied before it was final
- [ ] A trend that is too high: late data is counted twice

Why: each day was copied while its data was still coming in, so every value in the spreadsheet stays below its final figure. Copy a day only once the Stability says it is final.

## A Resource says Reliable since 1 January 2025. Is its figure of yesterday final?

- [ ] Yes: everything since 1 January 2025 is reliable
- [ ] No: only data before 1 January 2025 is final
- [x] That date does not say: it is where reliable data starts, not how long the last days keep moving

Why: Reliable since is a start date: data before it is not to be trusted. Whether the last days are final is the Stability of the Resource, which its pitfalls or its Owner tell you.

# You can now

ask "is this number final yet?" before you question a recent figure, and look for the answer in the pitfalls of its Resource, or ask its Owner.

## Where to next

- Next to it: K5.2
- Next to it: 4.3.2
- Apply: [Open Collections](/collections) Open a Resource you use and read Watch out on its Summary: look for days that are still coming in.
