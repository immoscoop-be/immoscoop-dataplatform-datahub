---
number: 1.2.2
status: draft
minutes: 5
added: 2026-10-29
changed: 2026-10-29
gain: You answer "why don't the weeks add up to the month?" yourself, in a minute, instead of asking the Data Team.
---

# Why now

> The report says 61,000 visitors last month, but its four weeks add up to 82,000. Which one is wrong?
> — A colleague from sales, on a Monday

You will hear this question again, every time a month is put next to its weeks or its days. Both figures are right, and a dashboard that adds the days up for you gets it wrong without telling you.

Promise: why the weeks of a unique count never add up to the month.

# Core idea

A **unique count** counts everyone once per period, so the counts of shorter periods never add up to the count of the longer one.

## Like a guest list

Someone who comes on Friday and on Saturday is on the list of both evenings, but is one guest of the weekend.

## For example

4,000 people visit on Monday and 3,000 on Tuesday. Together that is at least 4,000 and at most 7,000 people: whoever came on both days counts once. Page views and leads are not unique: those you may add up.

# See it

```chart
{
  "semgraph": "categoryComparison",
  "metric": "visitors",
  "title": "One week of visitors (example figures)",
  "measureType": "unique",
  "uniqueAggregation": "overPeriod",
  "statistic": "sum",
  "period": "2026-W40",
  "locale": "en",
  "context": { "domain": "Website", "dataset": "Example", "reliability": "example figures" },
  "points": [
    { "category": "The seven days added up", "sum": 9800 },
    { "category": "Unique visitors in the week", "sum": 6100 }
  ]
}
```

Look at: the two bars of the same week: the days added up, and the visitors counted over the whole week.

You see: 3,700 more in the first bar. Those are people who came on more than one day: adding the days up counts them again, so the week is lower, and right.

# Check your understanding

## In January 9,000 people sent a credit lead, in February 7,000. How many people sent one in the two months together?

- [ ] 16,000
- [x] At least 9,000 and at most 16,000
- [ ] 8,000, the average of the two

Why: whoever sent a lead in both months counts once in the two together, so the total lies between the busier month and the sum of both.

## Which of these may you add up over the days of a month?

- [ ] Unique visitors
- [x] Page views
- [ ] Unique listings published

Why: page views are not unique: every view counts, so the days add up to the month. Unique visitors and unique listings published need a count over the whole month.

## Each quarter about 300 agencies received a listing lead. Over the year the count says 420 agencies, not 1,200. What happened?

- [x] Nothing is wrong: most agencies received leads in more than one quarter
- [ ] The year is missing data
- [ ] The quarters count some agencies twice by mistake

Why: both figures are right. A quarter counts an agency once per quarter, the year once in the year, so the year is lower than the sum of its quarters.

## Which label tells you that a figure is a unique count?

- [ ] Sessions
- [x] Distinct users
- [ ] Page views

Why: "distinct" and "unique" mean that each one counts once. Sessions and page views count every visit and every view.

# You can now

recognise a unique count by its label, and explain why its days, weeks or months never add up.

## Where to next

- Deeper: 2.3.5
- Next to it: 2.3.6
- Apply: [Open Query](/query/new) Count the visitors of a month in one query, over the whole month, and compare it with its days added up.
