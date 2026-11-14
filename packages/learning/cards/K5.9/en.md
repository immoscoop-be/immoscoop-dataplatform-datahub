---
number: K5.9
status: draft
minutes: 4
added: 2026-11-14
changed: 2026-11-14
gain: You keep the figures of a Lens up to date in Excel, and you know what to do when its key stops.
---

# Why now

> My Excel gets nothing new since this morning. Did someone delete the data?
> — A colleague from finance, at the month end

Their workbook gets the result of a Lens through an Excel key, and the key stopped after its year. The data is still in Data Hub; Excel can no longer sign in to get it.

Promise: how Excel gets the result of a Lens, and what to do when its key stops.

# Core idea

Excel gets the result of a Lens through your **Excel key**, a personal key that lasts a year: when Excel gets nothing new, check the key before you doubt the data.

## At Immoscoop

The finance team refreshes the Lens Leads per source, week by week in its monthly workbook, through Power Query. A month before the key of that workbook stops, its User gets the Message "Your Excel key Monthly close expires on 31 October 2027". They make a new key on My page, name it after the workbook, copy it the one time Data Hub shows it, and put it in Excel in the place of the old one; the next refresh works as before. Excel gets the data of the Lens with its Parameters at their default values, worked out anew at every refresh: never a picture, never a Resource and never a query.

# Check your understanding

## Your workbook refreshes, but gets nothing new since today. What do you check first?

- [ ] Whether the Resource behind it was deleted
- [ ] Whether you need a new copy of the workbook
- [x] Whether your Excel key stopped or was revoked: My page lists your keys, with when each was last used and when it expires

Why: the key is how Excel signs in, in your name; when it stops, Excel gets nothing, while the data in Data Hub has not changed.

## A colleague asks for your Excel key, so that their copy of the workbook works too. What do you do?

- [ ] Send it in a private message
- [ ] Put it in the shared workbook, so that everyone can use it
- [x] Let them make a key of their own on My page

Why: an Excel key signs in in the name of its User, with what that User may see and do; a key of their own gets them what they may see, and stops when they can no longer sign in.

## Can you get a whole Resource into Excel?

- [ ] Yes: with an Excel key every Resource can be loaded
- [ ] Only by exporting it from Query
- [x] No: Excel gets the result of a Lens, with its Parameters at their default values

Why: Data Hub has no exports; a Lens answers a question that comes back, and that answer is what Excel refreshes.

# You can now

keep a Lens up to date in Excel with a key of your own, and ask "is my key still valid?" before you doubt the data.

## Where to next

- Next to it: K5.8
- Next to it: K5.10
- Apply: [Open your Excel keys](/me/keys) See your keys, when each was last used and when it expires.
