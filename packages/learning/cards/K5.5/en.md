---
number: K5.5
status: draft
minutes: 5
added: 2026-11-12
changed: 2026-11-12
gain: You look for the difference between two figures where it starts: when and from which data each was made, and whom to ask about it.
---

# Why now

> I have these bar charts on a print screen, and this number from an email. What is the difference?
> — A colleague, asking the Data Team

Nobody knows where the print screen was taken, or where the number in the email comes from. Yet the Data Team is asked to explain the difference between them.

Promise: how to find where a figure comes from, and whom to ask about it.

# Core idea

Before you ask anyone to explain a figure, know when and from which data it was made; in Data Hub the **Query ID** under its result leads to both.

## Like a photo of a street

Someone shows you a photo of a street and asks which city it is. You study the houses, the cars and the shop signs, and still you guess.

## At Immoscoop

A colleague puts bar charts from a print screen next to a number from an email, and asks the Data Team for the difference. Without when and from which data each was made, the Data Team sees the word "the" and has to guess which sentence it stood in. In Data Hub every result carries its Query ID under it, which leads to when its query ran, its SQL and the Resources it read. A query belongs to whoever ran it, so you ask them; a Lens is found in its Collection, with the Resources it is built on, and each Resource names its Owner. A figure that carries no Query ID goes back to whoever sent it, with the same question: when, and from which data?

# Check your understanding

## A slide of your manager shows fewer leads for October than the figure you reported. What do you do first?

- [ ] Send both figures to the Data Team and ask why they differ
- [x] Find out when and from which data the figure on the slide was made, starting with whoever made the slide
- [ ] Keep your own figure: the slide must be wrong

Why: two figures differ for a reason that sits in where they come from: another day, another table, another filter. Until both origins are known, the Data Team can only guess which reason it is, and so can you.

## A figure from Data Hub carries its Query ID. What does that tell you?

- [ ] That the figure is right
- [ ] That it is the figure of today
- [x] Which run it comes from: when its query ran, and what it read

Why: a Query ID names one run of one query. It says where the figure comes from, not whether it is right, and the same query run on another day can give another figure.

## A colleague sends you a figure from Data Hub with its Query ID. Who can show you the query behind it?

- [x] The colleague who ran it, as a query belongs to whoever ran it
- [ ] Anyone: every query in Data Hub is public
- [ ] Nobody: once a query has run, it is gone

Why: every query is its User's own, in their panel of Query, and Data Hub keeps each run with its Query ID for as long as Data Hub exists. The colleague who ran it opens it and sees what it read; the Data Team sees every query too.

## Open a Lens in its Collection. Whom do you ask first about a figure it gives?

Try it: [Open Collections](/collections)

- [ ] The Data Team, which makes every Lens
- [x] The Owner of the Resources it is built on
- [ ] Nobody: a Lens has no owner

Why: colleagues across Immoscoop make Lenses, and the page of a Lens names the Resources it is built on, each with the Owner that stands for its data. That is where a question about its figures starts.

# You can now

trace a figure to when and from which data it was made before you ask anyone to explain it, and ask first: whom do I ask about this query?

## Where to next

- Next to it: K5.1
- Next to it: 4.7.1
- Apply: [Open Collections](/collections) Open a Lens in its Collection, and find the Resources it is built on and the Owner of each.
