---
number: 2.1.3
status: draft
minutes: 5
added: 2026-11-10
changed: 2026-11-10
gain: When someone shows you a rising early number, you ask the two questions that decide what it is worth.
---

# Why now

> Sessions are up 40% since the campaign started. So where are the extra leads?
> — A colleague from marketing, three weeks into a campaign

The campaign had one target, more sessions, and it reached it. The leads the target was meant to bring did not come.

Promise: why pushing an early number does not bring the late one with it.

# Core idea

A **leading indicator** moves first and a lagging one follows, tied by a factor and a delay: lagging = leading × factor, after the lead time.

## Like a shop

People through the door are the early number, people at the till the late one. Only a share of the visitors buys, and in an estate agent's shop they buy weeks after their visit. Hand out free coffee at the door and the counter at the door goes up; the sales don't.

## At Immoscoop

Sessions are leading, leads are lagging. In a normal week about 4 in 100 sessions bring a lead, some weeks later. A campaign that buys 40% more sessions from people who are not looking for a home raises the sessions, not the leads: the factor of those extra sessions is close to zero.

# See it

```chart
{
  "semgraph": "calendarRatio",
  "metric": "sessionToLead",
  "title": "Leads per session, per week (example figures)",
  "measureType": "ratio",
  "numeratorName": "leads",
  "denominatorName": "sessions",
  "unit": "week",
  "locale": "en",
  "context": { "domain": "Leads", "dataset": "Example", "reliability": "example figures" },
  "points": [
    { "period": "2026-W33", "numerator": 800, "denominator": 20000 },
    { "period": "2026-W34", "numerator": 816, "denominator": 20400 },
    { "period": "2026-W35", "numerator": 792, "denominator": 19800 },
    { "period": "2026-W36", "numerator": 808, "denominator": 20200 },
    { "period": "2026-W37", "numerator": 812, "denominator": 28000 },
    { "period": "2026-W38", "numerator": 820, "denominator": 28400 },
    { "period": "2026-W39", "numerator": 806, "denominator": 27800 },
    { "period": "2026-W40", "numerator": 814, "denominator": 28200 }
  ]
}
```

Look at: the last four weeks, when the campaign ran: the base of sessions under the line, and the line itself.

You see: the base grows by 40% while the share of sessions that brings a lead drops from 4.0% to 2.9%. The leads stay at about 800 a week: the extra sessions brought almost none.

# Check your understanding

## Newsletter sign-ups doubled this month. What do you ask before you expect more leads?

- [ ] Nothing: twice the sign-ups means twice the leads
- [x] How many sign-ups become a lead, and how long that takes
- [ ] Whether the sign-ups were counted twice

Why: a sign-up is an early number. What it is worth later depends on the share that becomes a lead and on the time that takes, and neither is in the count of sign-ups.

## A team gets a target of 20% more listing views this quarter. What is most likely to happen?

- [ ] The leads rise by about 20% too
- [x] The views rise, by whatever raises views fastest, and the leads need not follow
- [ ] Views and leads stay the same

Why: a target on an early number makes that number the goal. The cheapest ways to raise views need not bring the people who send a lead.

## Leads dropped this week, two weeks after sessions dropped. What does that most likely show?

- [x] The delay between the two: the lagging number follows the leading one
- [ ] The tracking of leads broke this week
- [ ] Sessions and leads have nothing to do with each other

Why: a lagging number follows the leading one after its lead time, so a drop in sessions shows in the leads later. Look at the delay before you look for a broken measurement.

# You can now

ask "what's the factor, and how long does it take?" before you trust an early number, or set a target on it.

## Where to next

- Next to it: 1.2.1
- Apply: [Open Query](/query/new) Put sessions per week and leads per week side by side, and find how many weeks the second follows the first.
