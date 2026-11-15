---
number: K5.15
status: draft
minutes: 4
added: 2026-11-15
changed: 2026-11-15
gain: You show colleagues where to start in a table of many fields and what to filter its Preview on, and the EDA what to explore first.
---

# Why now

> Ten fields, and I only want Discover. Which ones matter, and what do I filter on?
> — A colleague from marketing, opening Search Console impressions for the first time

SEO knows that five of its ten fields answer nearly every question, and that mixing Discover with web search is the classic mistake. The colleague does not, and the Resource says it only once its Owner has marked those fields.

Promise: which fields to mark as Key Fields and as Parameters, and what each does for a colleague, a Preview and the EDA.

# Core idea

**Key Fields** are the few fields of a Resource a colleague should look at first and its EDA explores; its Parameters are the fields its Preview offers to filter on.

## At Immoscoop

Search Console impressions, whole site has ten fields and one row per day, query, country, device and search type. SEO marks five Key Fields: `data_date`, `query`, `search_type`, `impressions` and `clicks`. `country` and `device` are part of the grain but no Key Field, and `impressions` identifies no row but is one: a Key Field is what matters, not what makes a row unique. Each Key Field needs its Business Description before the Resource is published, and the EDA explores at least these five. SEO marks one Parameter, `search_type`: its Preview then offers its values to pick, such as web, discover and news, next to the newest days, so a colleague sees only Discover without writing SQL. Both lists stand under Querying on its Overview, and Claude reads them before it queries the Resource.

# Check your understanding

## A Resource holds one row per listing per day, identified by `listing_id` and `day`. Are those two its Key Fields?

- [ ] Yes: Key Fields are the fields that identify each row
- [x] Only if a colleague should look at them first; what identifies each row is its grain
- [ ] Yes, and no other field may be one

Why: the grain says what one row is; the Key Fields say where a colleague starts. A count that identifies no row is often a Key Field, and a field of the grain need not be one.

## A colleague wants the Preview of a Resource of yours to show only the rows of one country, without writing SQL. What makes that possible?

- [ ] Marking `country` as a Key Field
- [x] Marking `country` as a Parameter: the Preview then offers its values to pick
- [ ] Nothing: a Preview always shows the newest rows of everything

Why: a Preview offers a choice for its partition column, its first cluster column and each Parameter of its Resource, with up to 100 values to pick. Key Fields change nothing in a Preview: they tell a colleague, and the EDA, where to look.

## To be safe, you mark twenty of the thirty fields of a Resource as Key Fields. What does that do?

- [ ] Nothing but good: more Key Fields, more help
- [ ] Data Hub keeps the five used most and drops the rest
- [x] Colleagues lose where to start, each of the twenty needs a Business Description before you publish, and the EDA explores all twenty

Why: Key Fields work because they are few: they say where to start. Each one asks for a Business Description before the publication, and the EDA covers at least all of them.

# You can now

mark the few fields a colleague should start from as Key Fields and the ones they filter on as Parameters, and ask "which fields answer nearly every question asked of it?" before you choose.

## Where to next

- Next to it: K5.14
- Next to it: K5.18
- Apply: [Open Collections](/collections) Open a Resource and look at its Key Fields and Parameters under Querying on its Overview, then at the choices of its Preview.
