---
number: K5.3
status: draft
minutes: 5
added: 2026-11-12
changed: 2026-11-12
gain: You know where data is missing from a Resource before you draw a conclusion from it, and you save your colleagues from making the same mistake.
---

# Why now

> Why is the lead source empty for all those leads? What happened there?
> — A colleague who works with leads, not the first to ask

The answer is always the same: for a period, the lead source was not registered with the leads. Nobody wrote it down, so the question keeps coming back. And the colleague who does not notice the hole asks nothing at all: they draw a conclusion, and it is wrong.

Promise: why a hole in the data only misleads when nobody wrote it down, and where to write it.

# Core idea

A hole in the data is not the problem, a hole nobody wrote down is: write it down as a **Known Gap** of its Resource, so that the colleagues after you don't make the same mistake on it.

## Like a pothole with a sign

There is a pothole in the road. Put a sign next to it, and every cyclist who comes by steers around it. Just warn people.

## At Immoscoop

The leads of that period are all there, but nobody can tell where they came from: what was not registered cannot be rewound. The Owner or the Data Team writes it down once, as a Known Gap of the Resource that holds the leads, narrowed down to that period and the field lead source. From then on it stands on the Overview of that Resource, with who added it and when: the colleague who wonders reads it there instead of asking again, and the colleague who counts leads per lead source sees it before drawing a conclusion.

# See it

```chart
{
  "semgraph": "calendarRatio",
  "metric": "leadsWithLeadSource",
  "title": "Leads with a lead source, per month (example figures)",
  "measureType": "ratio",
  "numeratorName": "leads with a lead source",
  "denominatorName": "leads",
  "unit": "month",
  "locale": "en",
  "context": { "domain": "Leads", "dataset": "Example", "reliability": "example figures" },
  "points": [
    { "period": "2025-10", "numerator": 5384, "denominator": 5400 },
    { "period": "2025-11", "numerator": 5186, "denominator": 5200 },
    { "period": "2025-12", "numerator": 4688, "denominator": 4700 },
    { "period": "2026-01", "numerator": 5583, "denominator": 5600 },
    { "period": "2026-02", "numerator": 5485, "denominator": 5500 },
    { "period": "2026-03", "numerator": 2800, "denominator": 5800 },
    { "period": "2026-04", "numerator": 2690, "denominator": 5400 },
    { "period": "2026-05", "numerator": 5682, "denominator": 5700 },
    { "period": "2026-06", "numerator": 5285, "denominator": 5300 },
    { "period": "2026-07", "numerator": 4887, "denominator": 4900 },
    { "period": "2026-08", "numerator": 4788, "denominator": 4800 },
    { "period": "2026-09", "numerator": 5584, "denominator": 5600 }
  ]
}
```

Look at: March and April 2026, where the line drops to about half, while the base of leads under it stays as high as in every other month.

You see: the gap ran from mid-March to mid-April, half of each month. The leads kept coming as in every other month, about 5,300 a month, but only half of those in March and April have a lead source. Counted per lead source, every source drops by about half in those two months, and without the Known Gap that reads as fewer leads, not as a hole in the data.

# Check your understanding

## You find out that a field of a Resource you use is empty for every row before last summer. What do you do?

- [ ] Nothing more: now that you know, you keep it in mind
- [ ] Ask the Data Team about it in a chat, and leave it at their answer
- [x] Look for it among its Known Gaps; if it is not there, add it when your team owns the Resource, or tell its Owner in a Message on the Resource

Why: what you keep in mind, or hear in a chat, helps nobody after you. A Known Gap warns everyone who opens the Resource, and a Message on the Resource reaches its Owner and stays readable for others.

## Listing views from the app halved during two weeks in August. What do you check before you explain why?

- [ ] Nothing: the figures come from Data Hub, so the drop happened
- [x] The Known Gaps of the Resource: whether one covers those weeks
- [ ] Which release of the app caused the drop

Why: a drop is either in the world or in the data. A Known Gap that covers those weeks says the data has a hole there; check that first, then look for a cause in the world.

## A Known Gap says that a field was not stored for three months last year. What does that mean for your analysis?

- [ ] The Resource is unreliable, so you look for another one
- [x] You use it, and for those three months you leave that field out, or say that it is missing
- [ ] Nothing: the gap is in the past, so you count as if it were not there

Why: a hole you know about is one you steer around. Counting through it as if it were not there is what leads to the wrong conclusion; dropping the whole Resource throws away everything outside the gap.

## Open a Resource and find its Known Gaps. What does a Known Gap tell you besides its text?

Try it: [Open Collections](/collections)

- [ ] When the Data Team will fix it
- [x] Who added it and when, and, when it is narrowed down, the period, fields or rows it holds for
- [ ] How many colleagues ran into it

Why: every Known Gap is an item of its own, with who added it and when, so you know whom to ask. Narrowed down to a period, fields or rows, it says where it holds, and Claude reads that too.

# You can now

ask "which Known Gaps does this Resource have?" before you draw a conclusion from it, and warn your colleagues of every hole you find, as a Known Gap of its Resource.

## Where to next

- Deeper: 4.7.1
- Next to it: K5.1
- Apply: [Open Collections](/collections) Open a Resource you use, and read its Known Gaps on its Overview before you trust a result.
