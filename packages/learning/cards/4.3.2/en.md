---
number: 4.3.2
status: draft
minutes: 5
added: 2026-10-29
changed: 2026-10-29
gain: You change a Resource without breaking the reports of people you have never met.
---

# Why now

> I only renamed one column. Why did the KBC report go empty this morning?
> — An owner of a Resource, on a Tuesday

A change that looks small on your side can break what others built on your data. Adding a column breaks nothing; renaming or removing one breaks every query that reads it.

Promise: how to recognise a breaking change, and what to agree with the people who use your data.

# Core idea

A **breaking change**, a field renamed, removed or with another meaning, gets a new version and is announced to those who use the data; adding a field is never breaking.

## Like a train timetable

Adding a train breaks nobody's journey. Moving the 8:12 to 8:20 breaks the plans of everyone who takes it, so the railway announces it before the new timetable starts.

## For example

The owner renames `lead_source` to `lead_channel`. Every query, Lens and report that reads `lead_source` stops working. Adding `lead_channel` next to it, and removing `lead_source` only after the users moved over, breaks nothing.

# See it

```chart
{
  "semgraph": "categoryComparison",
  "metric": "creditLeads",
  "title": "Credit leads per week in a report on the Resource (example figures)",
  "measureType": "additive",
  "statistic": "sum",
  "ordered": true,
  "window": 35,
  "locale": "en",
  "context": { "domain": "Credit leads", "dataset": "Example", "reliability": "example figures" },
  "points": [
    { "category": "W38", "sum": 1210 },
    { "category": "W39", "sum": 1185 },
    { "category": "W40", "sum": 1240 },
    { "category": "W41", "sum": null },
    { "category": "W42", "sum": null }
  ]
}
```

Look at: the last two weeks, which are empty, not zero.

You see: the report stopped finding its field when it was renamed in week 41. The leads were there; the agreement on what the Resource holds was broken.

# Check your understanding

## Which change to a published Resource is breaking?

- [ ] Adding a field `lead_channel`
- [x] Renaming `lead_source` to `lead_channel`
- [ ] Writing a better business description

Why: a rename removes the old name, and everything that reads it stops working. Adding a field or describing it better changes nothing for what was built on it.

## A field keeps its name, but from now on counts test leads too. Is that breaking?

- [x] Yes: its meaning changed, so every figure built on it changes without warning
- [ ] No: the name and the type stayed the same
- [ ] Only if a report breaks

Why: a change of meaning is breaking even when nothing goes empty. That is the most dangerous kind, as the figures keep coming and are wrong.

## Data Hub tells you that a field of your Resource changed since its last Confirmation. What does that mean?

- [ ] Its Level dropped
- [x] It shows a warning until you, or the Data Team, mark it as seen
- [ ] It is withdrawn

Why: a changed field leaves the Level as it is, but the Resource warns whoever reads it until its owner looked at the change and confirmed what it now holds.

# You can now

recognise a breaking change before you make it, and give it a new version and an announcement instead of a surprise.

## Where to next

- Next to it: K3.4
- Next to it: K5.1
- Apply: [Open your Messages](/messages) See what Data Hub told you about the changes to your Resources.
