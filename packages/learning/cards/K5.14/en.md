---
number: K5.14
status: draft
minutes: 4
added: 2026-11-15
changed: 2026-11-15
gain: You describe your table and each of its fields in the words of the business, so that colleagues outside your team understand them without asking you.
---

# Why now

> Impressions: is that how many people saw our site?
> — A colleague from marketing, reading Search Console figures

The description from dbt says how the table is made: daily Search Console impressions and clicks for the whole site, from the bulk export. It does not say what an impression is, nor what the table is for, so a colleague outside SEO takes an impression for a visitor.

Promise: what the Business Description adds next to the description from dbt, for the table and for each of its fields, and who reads it.

# Core idea

The **Business Description** describes in the words of the business what a table or a field is for, next to the description from dbt that says how it is made: a colleague reads yours first.

## At Immoscoop

Search Console impressions, whole site arrives in the Collection Attraction at 2 · Described, with SEO as its Owner. SEO writes its Business Description: "How often our site appears in Google, and how often people click through, per day, query, country, device and search type. Use it for the trend of our organic visibility; it counts appearances in Google, not visitors on our site." For the field `data_date`, dbt says "Date of the data"; SEO adds "The day of the searches, in Pacific Time as Google counts it: a day ends nine hours after ours." On its Overview and in its Columns, each Business Description stands first, marked From the Owner, with the one from dbt next to it; Claude reads both, and search finds the Resource on the words of either. Before it is published, its Key Fields need one too; the other fields are advised.

# Check your understanding

## The description from dbt of a field changes after you wrote its Business Description. What happens to yours?

- [ ] The new text from dbt replaces it
- [ ] It is hidden until you confirm it again
- [x] It stays as you wrote it, next to the new one, and a Message shows you both

Why: neither description replaces the other. When the one from dbt changes, the Owner gets a Message with its text before and after and the Business Description next to it, so you decide whether yours still holds.

## A Resource of your team has forty fields and no Business Description yet. Where do you start?

- [ ] With every field, one by one, before anything else
- [x] With the table, then its Key Fields; the other fields when you can
- [ ] With the table only: fields are the work of the Data Team

Why: the table and its Key Fields are what a colleague reads first, and what its publication asks; the other fields are advised, and a field without yours still shows its description from dbt.

## The description from dbt of `lead_count` says "Number of credit leads". A colleague asks whether someone who applied twice counts twice. Where does the answer belong?

- [ ] Nowhere: the description from dbt is enough
- [ ] In the description from dbt: the Data Team rewrites it in business words
- [x] In the Business Description of the field, next to the one from dbt

Why: dbt says how the field is made; whether a person counts once or twice is what it means for your work, and only you say that. Written on the field, it answers every colleague who reads it, and Claude, not only the one who asked.

# You can now

write what a table and its fields are for in the words of the business, next to what dbt says, and ask "how would a colleague outside my team read this?" before you publish it.

## Where to next

- Next to it: 4.7.1
- Next to it: K5.15
- Apply: [Open Collections](/collections) Open a Resource your team owns and read its Description and its Columns as a colleague outside your team would.
