---
number: K5.8
status: draft
minutes: 4
added: 2026-11-14
changed: 2026-11-14
gain: You find the answer a colleague already built before you write your own query, and you know when your own query is the right way.
---

# Why now

> The lens I use every Monday was deleted. Do I have to write the SQL myself now?
> — A colleague from marketing, on a Monday

The lens behind their weekly report is gone. Writing a query of their own feels like the only way back, while another Lens may already answer the same question.

Promise: when a Lens is the better answer, and when your own query is.

# Core idea

Look for a **Lens** before you write a query: a Lens is a question a colleague already answered and keeps working, with Parameters you set yourself; your own query is for the question no Lens answers.

## At Immoscoop

Mia Peeters deleted the lens Leads per source name, with "Replaced by the lens Leads per source, week by week". Instead of writing its SQL again, the colleague opens the new Lens, sets the week as its Parameter, and has their Monday figure. When they later also need the leads per region, which no Lens shows, they start a new query on Weekly lead volume: Data Hub first shows the Lenses on that Resource, and only then the empty query.

# Check your understanding

## You want the number of leads per source last month. What do you do first?

- [ ] Write a query on the Resource that holds the leads
- [x] Look for a Lens that answers it: a new query shows the Lenses on its Resources first
- [ ] Ask the Data Team for an export

Why: a Lens is a question someone already answered, checked and keeps working; you set its Parameters, such as the month, without touching its SQL. Data Hub has no exports.

## A Lens shows the leads per source per week, but you also need them per region. What now?

- [ ] Change the SQL of the Lens
- [ ] Use the Lens and add the regions by hand in Excel
- [x] Write your own query on the same Resources; the Lens stays as it is for everyone who uses it

Why: a Lens belongs to its Owner Unit and serves every colleague who runs it; a question of your own is a query of your own.

## Your own query answers a question your whole team asks every week. What does it deserve?

- [ ] Nothing: everyone can copy your SQL
- [ ] A screenshot in Slack every Monday
- [x] To become a Lens, so that the team runs it with its own Parameters and it is kept working

Why: a question that comes back is what a Lens is for; a copied query or a screenshot answers it once, and goes stale without anyone noticing.

# You can now

ask "does a Lens answer this already?" before you write a query, and know when your own query is the right way.

## Where to next

- Next to it: K5.5
- Next to it: K5.6
- Apply: [Open Query](/query/new) Name your question and choose its Resources: the Lenses that already answer it come first.
