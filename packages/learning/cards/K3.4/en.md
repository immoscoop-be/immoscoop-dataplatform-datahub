---
number: K3.4
status: draft
minutes: 4
added: 2026-10-29
changed: 2026-10-29
gain: You know where to look up what a term means, and where to record a definition so that everyone counts the same.
---

# Why now

> The sales dashboard says 1,420 credit leads in September and the credit dashboard 1,180. Which definition is the real one?
> — A colleague from credit

When two figures with the same name differ, it is usually not the data but the definition. Knowing where definitions live tells you which one counts, and where to look.

Promise: the difference between an explanation and a definition, and where each lives.

# Core idea

The **glossary** explains a term in plain words, and the **official definition** lives in one place only, the dbt project and Colleciónes; whoever needs to count reads the definition, never a copy of it.

## Like a dictionary and the law

A dictionary explains what "resident" means in everyday words. The law says exactly who counts as one. You learn from the first, you decide by the second.

## For example

The glossary says a `creditLead` is "a lead we send to KBC". The definition in dbt says which ones count: without test and duplicate requests. The sales dashboard copied an older rule and counts those too, so it shows 240 more.

# See it

```chart
{
  "semgraph": "categoryComparison",
  "metric": "creditLeads",
  "title": "Credit leads in September, on two dashboards (example figures)",
  "measureType": "additive",
  "statistic": "sum",
  "period": "2026-09",
  "locale": "en",
  "context": { "domain": "Credit leads", "dataset": "Example", "reliability": "example figures" },
  "points": [
    { "category": "Sales dashboard, its own rule", "sum": 1420 },
    { "category": "Credit dashboard, the definition in dbt", "sum": 1180 }
  ]
}
```

Look at: the two bars for the same month and the same name.

You see: a difference of 240 that is no error in the data: one dashboard counts by a copy of an old rule, the other by the definition in dbt.

# Check your understanding

## You want to know exactly which leads count as a `creditLead`. Where do you look?

- [ ] In the glossary
- [x] In the official definition, in dbt and Colleciónes
- [ ] In the dashboard that shows the most

Why: the glossary explains in plain words; only the definition says exactly what counts. A dashboard is a user of the definition, not its source.

## Your team starts counting a new kind of lead. Where do you record its definition?

- [x] In one place: the definition in dbt, with its explanation added to the glossary
- [ ] In the description of every dashboard that uses it
- [ ] In a document of your team

Why: a definition recorded in one place is the same for everyone. Every copy drifts away from it, and then two dashboards disagree.

## Open a Resource and compare its description from dbt with its business description. What is the difference?

Try it: [Open Collections](/collections)

- [x] The one from dbt says how it is built; the business description what it means for the business
- [ ] They are always the same text
- [ ] The business description replaces the one from dbt

Why: both stand side by side on purpose: the description from dbt follows the definition, the business description explains it in the words of its owner.

# You can now

look up what a term means in the glossary, and find and record its definition in the one place where it lives.

## Where to next

- Deeper: 4.3.2
- Next to it: K5.1
- Apply: [Open Collections](/collections) Read the description from dbt and the business description of a Resource side by side.
