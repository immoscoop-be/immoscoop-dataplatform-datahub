---
number: 2.3.5
status: draft
minutes: 6
added: 2026-10-29
changed: 2026-10-29
gain: You explain why two counts of "the same" differ before anyone calls one of them wrong.
---

# Why now

> Marketing counts 1,310 listings in the region and we count 1,240. Who made a mistake?
> — A colleague from sales, about a monthly report

Two teams count the same thing and get two figures. Usually nobody made a mistake: they counted along a different key, and so answered a different question.

Promise: what to ask before you count, so that two figures can be compared.

# Core idea

Every count stands on a **grain**, what one row is, and a **key** you count along; when the two do not match one to one, a row is counted more than once or drops out, and the figure answers another question.

## Like a parcel and its addresses

A parcel goes to one house, but a street can run through two towns. Count parcels per town and per street, and the streets add up to more: the parcels on the street through both towns count in both.

## For example

A listing lies in one municipality, but a postal code can span several municipalities. Counted per municipality, the region has 1,240 listings; counted per postal code, 1,310. The 70 more are listings in postal codes that cross a border, counted once in each.

# See it

```chart
{
  "semgraph": "categoryComparison",
  "metric": "listings",
  "title": "Listings in one region, counted along two keys (example figures)",
  "measureType": "additive",
  "statistic": "sum",
  "period": "2026-09",
  "locale": "en",
  "context": { "domain": "Listings", "dataset": "Example", "reliability": "example figures" },
  "points": [
    { "category": "Added up per municipality", "sum": 1240 },
    { "category": "Added up per postal code", "sum": 1310 }
  ]
}
```

Look at: the two bars of the same listings in the same month, added up per municipality and per postal code.

You see: 70 more along the postal code. Neither is wrong: a postal code that spans two municipalities brings its listings into the total twice.

# Check your understanding

## A person can log in, leave an e-mail address or only carry a cookie. "Unique persons" counted on cookies gives 48,000, on logins 21,000. Which one is right?

- [ ] The one on logins, as it is the most exact
- [ ] The one on cookies, as it is the largest
- [x] Both, for a different question: they count along a different key

Why: a key is a choice. Cookies count browsers, logins count accounts. Which one fits depends on the question, and the report should say which one it took.

## Before you compare two counts, what do you ask first?

- [x] What one row is, and along which key each was counted
- [ ] Which of the two is the most recent
- [ ] Which team made it

Why: two counts with a different grain or key answer different questions. Only once both are the same can a difference mean something.

## Open a Resource in a Collection and look at its grain on its Overview. What does one row stand for?

Try it: [Open Collections](/collections)

- [x] The Resource says it in one sentence, such as "one row per listing per day"
- [ ] You can only tell from its SQL
- [ ] Every Resource has one row per day

Why: the grain of a Resource is written on its page, in a sentence and with its key fields, so that you know what you count before you count.

# You can now

name what one row is and along which key you count, before you count, and explain why two keys give two figures.

## Where to next

- Deeper: 2.3.6
- Next to it: 1.2.2
- Apply: [Open Collections](/collections) Open a Resource and read its grain before you count with it.
