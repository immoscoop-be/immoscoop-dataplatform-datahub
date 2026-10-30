---
number: K5.1
status: draft
minutes: 5
added: 2026-10-29
changed: 2026-10-29
gain: You know what a Resource tells you, how far you can trust it, and whom to ask about it.
---

# Why now

> Weekly lead volume says 840 leads from the website last week. Can I put that in front of the board, and who do I ask if it looks odd?
> — A colleague from marketing

Data Hub holds Resources. Knowing what one is tells you where its figures come from, how far you can trust them, and who stands for them.

Promise: what a Resource is, what its page holds, and who answers for it.

# Core idea

A **Resource** is one table of BigQuery with its page: what it holds, how far you can trust it and who stands for it; the data itself stays in BigQuery.

## Like a book in a library

The library does not write the book, but its card tells you what the book is about, where it stands, and whom to ask. The book itself stays on the shelf.

## For example

Weekly lead volume is in the Collection Credit leads, whose Owner Unit is the credit team: the number of credit leads per week and per lead source, at Level 4 Explored. A question about it goes as a Message on its page, to the credit team.

# See it

```chart
{
  "semgraph": "categoryComparison",
  "metric": "creditLeads",
  "title": "Credit leads per lead source, one week (example figures)",
  "measureType": "additive",
  "statistic": "sum",
  "period": "2026-W42",
  "locale": "en",
  "context": { "domain": "Credit leads", "dataset": "Weekly lead volume", "reliability": "example figures" },
  "points": [
    { "category": "Website", "sum": 840 },
    { "category": "Partner", "sum": 310 },
    { "category": "Mailing", "sum": 120 },
    { "category": "Phone", "sum": 95 }
  ]
}
```

Look at: the footer of the chart, which names the Resource it reads.

You see: the figures come from Weekly lead volume. Its page tells what one row is, who stands for it and at which Level it is: that is where you check before you show the figure.

# Check your understanding

## Who is the Owner of a Resource?

- [ ] Whoever built its table in dbt
- [x] The Owner Unit of its Collection
- [ ] The Data Team

Why: the Owner is the team that understands the data and stands for it: the Owner Unit of the Collection the Resource is in. The Data Team builds and registers it.

## Who sees a Resource that is not published?

- [x] Only the Data Team and its Owner Unit
- [ ] Everyone who sees its Collection
- [ ] The whole company

Why: only its Owner publishes a Resource; until then, only the Data Team and the Owner Unit see it. Published, everyone who sees its Collection does.

## A field of a Resource changed since its last Confirmation. What happens to its Level?

- [ ] It drops one step
- [x] It stays, and the Resource shows a warning until its Owner marks the change as seen
- [ ] It goes back to 0 Beta

Why: a changed field does not lower the Level; it warns whoever reads it, until its Owner or the Data Team looked at the change.

## Open a Resource and find whom to ask about it. Where do you send your question?

Try it: [Open Collections](/collections)

- [x] As a Message on its page, which goes to its Owner
- [ ] By e-mail to the Data Team
- [ ] In the description of the Resource

Why: a question on a Resource is a Message on its page: it reaches its Owner, and everyone who sees the Resource can read the answer later.

# You can now

explain what a Resource in Data Hub is, what its page holds, and whom to ask when you doubt a figure.

## Where to next

- Deeper: 4.3.2
- Next to it: K3.4
- Apply: [Open Collections](/collections) Open a Resource and find its Owner, its Level and its grain.
