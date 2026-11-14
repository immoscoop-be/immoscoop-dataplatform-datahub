---
number: K5.7
status: draft
minutes: 4
added: 2026-11-14
changed: 2026-11-14
gain: You know what a red dot means, who repairs it, and that it often comes back by itself.
---

# Why now

> My report has a red dot this morning. Did I break something?
> — A colleague from marketing, on a Monday morning

Overnight, a column the report reads disappeared from the data, because it was renamed in dbt. The report did not show wrong figures: it stopped.

Promise: what the red dot means, who repairs it, and why it often repairs itself.

# Core idea

What reads something that no longer exists is **Broken**: it stops rather than show figures it no longer stands for, and it works again once what it reads is back, or once its query reads what replaced it.

## Like a recipe whose ingredient is gone

Your favourite recipe calls for one brand of stock cubes, and the shop stops selling them. The recipe is not wrong and your kitchen is not broken. You cannot cook it until the cubes are back on the shelf, or until you rewrite the recipe for the cubes that replaced them. What you do not do is cook it without, and serve something that tastes off.

## At Immoscoop

The Data Team renames the column `lead_channel` of Weekly lead volume in dbt. After the next run, the Lens Leads per source name, which reads `lead_channel`, is Broken: nobody can run it, it carries a red dot wherever it is listed, and the reports that hold it are Broken too. The credit team, its Owner Unit, gets the Message "The lens Leads per source name is broken", which names the column that no longer exists. They change the query of the Lens to the new name, and the red dot goes. Had the column come back, the Lens would have worked again by itself.

# Check your understanding

## A report you use has a red dot since this morning. What happened?

- [ ] Its figures are wrong now
- [ ] You broke it by changing a filter yesterday
- [x] Something it reads no longer exists, so it does not run until that is back or its query is changed

Why: a Broken report shows no figures at all rather than wrong ones. Holding the pointer on the red dot names what no longer exists; nothing you did on the report caused it.

## The Data Team renamed a column your own query reads. What does Data Hub do?

- [ ] It changes your SQL to the new name
- [ ] Nothing: the query keeps running with the old name
- [x] It marks your query Broken and tells you; you change the SQL, or it works again when the old name comes back

Why: a renamed column is, for Data Hub, a column that is gone and a new one. Data Hub never rewrites your SQL: you decide whether the new column means what the old one did.

## Who repairs a Broken Lens?

- [ ] The Data Team, always
- [ ] Every colleague who uses it
- [x] Its Owner Unit changes its query, or nobody has to when what is missing comes back

Why: the Owner Unit stands for the Lens, so it gets the Message and changes the query; when what is missing comes back, Data Hub repairs nothing, the Lens simply runs again.

## One Lens of a report with five is Broken. What about the report?

- [ ] The other four Lenses still show, without the broken one
- [x] The report is Broken until that Lens works again, or until its Owner takes the Lens out
- [ ] The report keeps the last figures of that Lens

Why: a report is read as a whole, so a missing part makes all of it stop rather than tell half the story.

# You can now

tell from a red dot what no longer exists and who repairs it, and ask "is it coming back, or do we change the query?" before anyone rebuilds anything.

## Where to next

- Next to it: K5.1
- Deeper: 4.3.2
- Apply: [Open your Messages](/messages) See whether something you own is Broken, and what no longer exists.
