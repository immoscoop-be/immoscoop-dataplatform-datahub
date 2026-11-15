---
number: K5.18
status: draft
minutes: 4
added: 2026-11-15
changed: 2026-11-15
gain: You know what a Data Admin records about your Resource, why you check it, and how to have it corrected.
---

# Why now

> Publishing asks about a table type, a grain and mappings. Do I have to fill those in myself?
> — A colleague from SEO, before publishing a Resource

A Data Admin records them, in Data Hub, and they hold up no publication; on the Resource, the table type shows as its model type. Yet they decide how everyone counts on the table and joins it, and nobody knows better than its Owner whether they are right.

Promise: what the Data Admin records, why you check it, and how to have it corrected.

# Core idea

The **Data Admin** records the model type, the grain and the mappings of a Resource; its Owner checks them, because the EDA and every join start from them.

## At Immoscoop

A Data Admin records Weekly lead volume as an `aggregate` with one row per `week_start` and `lead_source`, and maps `lead_source` to `leadSource.leadSourceId`. Its Overview then shows "model type: aggregate" and "grain: week_start × lead_source", marked From the Data Team, and says it joins Lead sources through the lead source. The credit team, its Owner, reads them back. Had the grain said one row per week, a colleague, or Claude, would take the lead count of one row for the whole week; had `lead_source` not been mapped, its Overview and Claude would name no Resource it joins. What is off, the credit team asks the Data Team to correct in a Question on the Resource: only a Data Admin changes it, in Data Hub, and Claude cannot.

# Check your understanding

## Claude finds that the grain recorded for your Resource misses a field. What happens next?

- [ ] Claude corrects it, once you agree
- [ ] You correct it on the Overview, as you do the Business Description
- [x] You ask the Data Team, yourself or through Claude in a Message, and a Data Admin corrects it in Data Hub

Why: the model type, the grain and the mappings are recorded only by a Data Admin, in the web app. Claude can write the Question once you agree; you then check what the Data Admin recorded.

## Your Resource has no model type and no grain recorded yet, and you want to publish it. What holds?

- [ ] You cannot publish it until a Data Admin records them
- [ ] Nothing for you: they are the business of the Data Team
- [x] You may publish it, but ask for them now: the EDA, which takes it to 4 · Explored, starts from them

Why: they hold up no publication, yet what one row is decides how everyone counts on the Resource and what its EDA checks. Data Hub does not check a grain against the data, so its Owner, who knows the rows, is the one to read it back.

## A field of your Resource holds the identity of an agency, but no mapping is recorded for it. What do colleagues miss?

- [ ] Nothing: Data Hub links it by the name of the field by itself
- [x] Its Overview, and Claude, name no Resource it joins through the agency
- [ ] Nothing: it only means the Resource cannot be published yet

Why: a mapping links the Resource to every Resource that carries the same Entity, and a join starts from there. Data Hub links on mappings, not on names: a name that matches the Domain Model only makes it suggest one, for a Data Admin to confirm. A mapping is advised, not required, so ask for it when colleagues will join on that field.

# You can now

check the model type, the grain and the mappings a Data Admin recorded for your Resource, and ask "is one row really what it says here?" before the EDA or anyone else counts on it.

## Where to next

- Deeper: 2.3.6
- Next to it: 2.3.5
- Apply: [Open Collections](/collections) Open a Resource your team owns and look at its model type, its grain and its Entities on its Overview.
