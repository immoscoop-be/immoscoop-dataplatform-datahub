---
number: K5.6
status: draft
minutes: 4
added: 2026-11-12
changed: 2026-11-12
gain: You see how much data a query reads before it runs, and no longer fear you are throwing money out of the door.
---

# Why now

> Am I consuming too much data with this? I don't want to throw money out of the door.
> — A colleague outside data, before running a query

Every query reads data in BigQuery, and reading costs money. As long as you cannot see how much a query reads, every query feels like a risk.

Promise: how you see what a query will read before it runs, and what a warning asks of you.

# Core idea

The **Pre-flight** shows what a query will read before it runs, so you see what you are doing: as long as it gives no warning, you are doing nothing wrong.

## Like a prepaid phone card

You see the balance before you call, and a warning comes when it runs low. Until then, you just call.

## At Immoscoop

A colleague working on the raw event data once ran a very expensive query. Data Hub measures every query before it runs: the Pre-flight says what it will read, in MB or GB, not in euros. By default, a query that reads up to 100 MB runs at once; from 100 MB to 1 GB you approve it yourself, after a warning; above 1 GB it runs only once the Data Team has accepted a Request.

# Check your understanding

## The Pre-flight of your query says it reads 40 MB at most, and shows no warning. What does that tell you?

- [ ] Nothing yet: what a query costs only shows afterwards
- [ ] It might still throw money out of the door: ask the Data Team before you run it
- [x] It stays below the first threshold: run it, you are doing nothing wrong

Why: the Pre-flight measures a query before it runs, so you know what it reads before it costs anything. Without a warning, it stays within what you may run freely.

## The Run button has turned red: the Pre-flight says your query reads 600 MB at most, and asks you to approve it. What do you do?

- [ ] Approve it: the button lets you, so it must be fine
- [ ] Close the query: a red button means you did something wrong
- [x] Read what the warning says and what would read less, then decide whether your question needs that much

Why: between the two thresholds the choice is yours. The pop-out on the button says what reads less, such as a filter on a shorter period. Approving once you have read it is fine; clicking past it unread is the one thing to avoid.

## With the thresholds as they are set by default, a query would read 3 GB. What happens?

- [ ] It runs, and the bill comes later
- [ ] It runs after a warning, like any large query
- [x] It does not run until someone of the Data Team has accepted a Request for it

Why: by default, above 1 GB the Data Team looks first. You send the query to them, with a word on why if you like, and their answer comes back in your Message Centre; once accepted, that query runs for you.

## You change the period of a query five times, to see what each version reads. What did that cost?

- [ ] Five queries: every check reads the data
- [x] Nothing: the Pre-flight measures a query without reading the data
- [ ] Only the last version, the one you kept

Why: the Pre-flight asks BigQuery what the query would read, without reading it, and that costs nothing. Only a run reads the data.

# You can now

ask "how heavy is this?" before you run a query, find the answer in its Pre-flight, and run it without worry as long as no warning comes.

## Where to next

- Next to it: K5.1
- Apply: [Open Query](/query/new) Write a query and read the bar at its foot: what it reads, against the two thresholds on its gauge.
