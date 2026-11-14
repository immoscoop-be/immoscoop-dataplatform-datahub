---
number: K5.11
status: reviewed
minutes: 4
added: 2026-11-14
changed: 2026-11-14
gain: You know whether you may still build on a Resource marked deprecated or withdrawn, and what to use instead.
---

# Why now

> This Resource says deprecated. Are the figures in my report wrong now?
> — A colleague from credit, while building a report

Its Owner marked it deprecated, with a reason and a Resource to use instead. Deprecated changes nothing in its figures: it still works as before, and its reason says why nobody should start building on it.

Promise: what deprecated and withdrawn tell you, and what to do with each.

# Core idea

A **deprecated** Resource still works but should no longer be built on, so build what is new on the Resource its mark names; a withdrawn one is gone for everyone but its Owner Unit and the Data Team, and what reads it stops until it comes back.

## At Immoscoop

The credit team marks Weekly lead volume deprecated: "a lead shared by two sources counts twice here", with Leads per week as the Resource to use instead. The Resource shows the mark on its page, in its Collection and in the panel, and Claude names it; the Lenses on it keep working, and the credit team builds their replacements on Leads per week, as new queries that become Lenses of their own. A month later the Data Team stops offering Weekly lead volume to Data Hub in dbt: it is withdrawn. Only the credit team and the Data Team still see it, with its Collection, its Confirmations and its history; a Lens that still read it is Broken. Had it been a mistake, it would have come back as it was.

# Check your understanding

## A Resource your Lens reads is marked deprecated. What happens to the Lens?

- [ ] It stops working
- [ ] Data Hub moves it to the Resource to use instead
- [x] It keeps working; build its replacement on the Resource the mark names while it still works

Why: deprecated hides nothing and blocks nothing: it warns. A Lens keeps its Resources; one on another Resource is a new query, which can become a Lens of its own.

## A Resource a colleague used last month is nowhere to be found. What may have happened?

- [ ] It was deleted, with all its history
- [ ] Data Hub hides Resources nobody used for a month
- [x] It was withdrawn: only its Owner Unit and the Data Team still see it, and it comes back as it was if it returns

Why: withdrawn is not deleted. A Resource is withdrawn when dbt no longer offers it to Data Hub; it keeps its Collection, its Confirmations and its history, ready to come back.

## You start a new report. A Resource that fits is marked deprecated, with another to use instead. What do you build on?

- [ ] The deprecated one, as it still works
- [ ] Neither, until the Data Team confirms
- [x] The one its mark names, as its Owner advises against the deprecated one

Why: deprecated is the Owner telling everyone not to build anything new on it; what you build today on a deprecated Resource, you move tomorrow.

# You can now

tell deprecated from withdrawn, and ask "what does the mark say to use instead?" before you build on a Resource.

## Where to next

- Next to it: K5.7
- Next to it: K5.1
- Apply: [Open Collections](/collections) Open a Resource you use and look for the mark deprecated, with what to use instead.
