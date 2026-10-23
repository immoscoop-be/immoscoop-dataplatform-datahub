# Conversations

| | |
| --- | --- |
| Domain | 14 of Data Hub · code `CV` |
| Status | To be specified |
| Source of truth | This file |
| Origin | Listed in the domain overview on Confluence; no page of its own yet (Confluence name: Gesprek) |

**Scope:** Questions, Remarks and margin notes on an object.

**In one sentence:** every Message in Data Hub knows the object it is about, a Resource, a Lens, a query or any other, so that it always links to it, and so that all Messages about an object can be found and shown on it.

*Functional domain 14 of Data Hub. Overview of all domains: [Functional domains](README.md).*

## Already touched on elsewhere

Pointers to material this domain will build on, collected during the migration. They are navigation, not requirements of this domain.

- Reactions on a Resource: [DEC-SR-20](04-stacks-and-resources.md#dec-sr-20), [DEC-SR-21](04-stacks-and-resources.md#dec-sr-21), [FR-SR-29](04-stacks-and-resources.md#fr-sr-29), [FR-SR-30](04-stacks-and-resources.md#fr-sr-30), and the [Kinds of Reaction](04-stacks-and-resources.md#kinds-of-reaction)
- Communication as a function of Data Hub: [What Data Hub does](../../overview/data-hub.md#what-data-hub-does)
- Form of the communication between colleagues: [OP-DH-33](../../overview/open-themes.md#op-dh-33)
- Notifications to an Owner reach the whole Owner Unit: [FR-LN-01](07-log-and-notifications.md#fr-ln-01)
- The Conversations of a Resource as a tab: [design](../../design/principles.md#conversations)

## Decisions

*The decisions and requirements below come from Max, 2026-10-23. They are proposals, still to be validated, and therefore Proposed.*

- <a id="dec-cv-01"></a>**DEC-CV-01** · Every Message carries its Subject: the kind of object it is about, such as a Resource, a Lens or a query, and the ID of that object. Data Hub sets the Subject from where the Message is written, on the page of the object or from a link to it; the writer never types it, and it never changes.
- <a id="dec-cv-02"></a>**DEC-CV-02** · Messages are kept in one place, by Subject. The Conversations of an object, the Message Centre of a User and every notification read from that one place, so that a Message exists once, wherever it shows.
- <a id="dec-cv-03"></a>**DEC-CV-03** · The Subject is the same for every kind of object in Data Hub that has an ID: Resources today; Lenses, queries by their Query ID ([FR-LN-05](07-log-and-notifications.md#fr-ln-05)), Reports, Collections and later kinds alike. A new kind of object adds only its name and how to link to it; Messages, their links and their retrieval stay the same. This answers [OP-CV-03](#op-cv-03).
- <a id="dec-cv-04"></a>**DEC-CV-04** · A Message is never private and is not a chat with a person: for that there is Slack. A Message enriches the data of its object and informs colleagues, so everyone who may see the object sees it. This answers [OP-CV-01](#op-cv-01).
- <a id="dec-cv-05"></a>**DEC-CV-05** · A Message is about a whole object, a Collection, a Resource, a Lens or a query, and never about a part of it, such as a Column or a Parameter, nor about a second object. This answers [OP-CV-02](#op-cv-02).

## Terms

| Term | Meaning |
| --- | --- |
| [Message](../../definitions.md#message) | What a User writes on an object in Data Hub, such as a Resource, a Lens or a query, to enrich its data and inform colleagues: a Question, Remark or Signal, or a reply. Never private. |
| [Subject](../../definitions.md#subject) | What a Message is about: the kind of object and its ID. |

## Flow

1. **Writing.** On the page of a Resource, a User asks a Question about it. Data Hub gives the Message its Subject: Resource, with the ID of that Resource.
2. **Delivering.** The Owner Unit gets the Message in its Message Centre and as a notification ([FR-LN-01](07-log-and-notifications.md#fr-ln-01)), each with a link to the Resource, opening at the Message.
3. **Replying.** The Owner replies; the reply has the same Subject.
4. **Showing.** The Conversations of the Resource show every Message with its Subject, the Question and its reply among them, to everyone who may see the Resource.

## Requirements

<a id="fr-cv-01"></a>
### FR-CV-01 · A Message is always about something

**Status:** Proposed · **Source:** Max, 2026-10-23

Every Message has a Subject ([DEC-CV-01](#dec-cv-01)): a Question, Remark or Signal on an object, and a reply alike. A reply takes the Subject of the Message it answers. There is no Message without a Subject.

<a id="fr-cv-02"></a>
### FR-CV-02 · A Message links to its object

**Status:** Proposed · **Source:** Max, 2026-10-23

Wherever a Message shows, in the Message Centre, in a notification, through Claude or another channel, it carries a link to its object, opening at the Message in the Conversations of that object: the page of a Resource or a Lens, a query in Query. Data Hub builds the link from the Subject when it shows the Message, so that the link keeps working when the object is renamed. The Message shows the object by its kind, with its icon, and its current name.

<a id="fr-cv-03"></a>
### FR-CV-03 · A Message is placed on its object, not sent to a person

**Status:** Proposed · **Source:** Max, 2026-10-23

A Message has no recipient of its own: it is placed on its object, for everyone who may see it ([DEC-CV-04](#dec-cv-04)). Who gets a notification of it follows its kind: a Question or a Remark notifies the Owner of the object, which is its whole Owner Unit ([FR-LN-01](07-log-and-notifications.md#fr-ln-01)); a Signal notifies the Owner and the Data Team ([FR-SR-30](04-stacks-and-resources.md#fr-sr-30)).

<a id="fr-cv-04"></a>
### FR-CV-04 · All Messages about an object can be retrieved

**Status:** Proposed · **Source:** Max, 2026-10-23

Data Hub finds every Message about an object by its Subject, kind and ID, with their replies, newest first. The Conversations of the object show them, and the API and the MCP server of Data Hub return them, so that Claude can read what was asked and answered about an object.

<a id="fr-cv-05"></a>
### FR-CV-05 · Who sees a Message follows who sees its object

**Status:** Proposed · **Source:** Max, 2026-10-23

Only a User who may see the object of a Message sees the Message and follows its link: a Resource by its Publication and Collection ([FR-SR-31](04-stacks-and-resources.md#fr-sr-31)), a Lens by its Resources ([DEC-CO-16](03-collections.md#dec-co-16)), a query by who ran it and the Data Team ([DEC-LN-01](07-log-and-notifications.md#dec-ln-01)). Everyone who may see the object sees all its Messages: none is private ([DEC-CV-04](#dec-cv-04)).

<a id="fr-cv-06"></a>
### FR-CV-06 · The Message Centre

**Status:** Proposed · **Source:** Max, 2026-10-23 · [design](../../design/principles.md#messages)

Every User has a Message Centre, reached from the navigation with the number of unread Messages. It shows, by default, the Messages for them: on the objects their Owner Unit owns, the Messages they wrote or answered, the Signals for the Data Team, and what Data Hub itself tells them, such as a Level that dropped. It filters on unread, written by them and everything they may see; on the kind of Message; and on the kind of object. Each Message shows its object and links to it ([FR-CV-02](#fr-cv-02)); opened, it shows its replies and a field to answer.

<a id="fr-cv-07"></a>
### FR-CV-07 · The Messages of an object, on the object

**Status:** Proposed · **Source:** Max, 2026-10-23 · [design](../../design/principles.md#messages)

The page of a Collection, a Resource and a Lens has "Messages", with their number, which opens the Messages on that object in a slide-in: the Message Centre filtered on the object ([DEC-CV-02](#dec-cv-02)). It starts with a field for a new Message, whose Subject is that object. A Collection takes a Question or a Remark; a Resource and a Lens also a Signal, as a Signal is about data.

## Edge cases

<a id="ec-cv-01"></a>
### EC-CV-01 · The object no longer exists

**Status:** Proposed

When the object of a Message is removed, or its Collection dissolved, the Message stays, still found by its Subject. Its link then says that the object no longer exists, with the name it had.

<a id="ec-cv-02"></a>
### EC-CV-02 · A Resource moves to another Collection

**Status:** Proposed

The Messages about a Resource follow it to its new Collection, as their Subject is the Resource and not its Collection. Who sees them changes with who may see the Resource ([FR-CV-05](#fr-cv-05)).

## Out of scope

Who gets which notification, when and through which channel belongs to [Log and notifications](07-log-and-notifications.md); the channels themselves to [Channels](13-channels.md).

## Open points

- [x] <a id="op-cv-01"></a>**OP-CV-01** · Decide whether a Message to one person shows in the Conversations of its object for everyone who may see the object, or only for its writer and its recipient. Proposal: for everyone who may see the object, as the Reactions do ([DEC-SR-20](04-stacks-and-resources.md#dec-sr-20)), so that an answer helps the next person with the same question. *Raised on 2026-10-23.* *Decided on 2026-10-23: there are no private Messages and no Messages to a person; a Message enriches the data and informs colleagues, and a chat belongs in Slack ([DEC-CV-04](#dec-cv-04)).*
- [x] <a id="op-cv-02"></a>**OP-CV-02** · Decide whether a Message can point to a part of its object besides its Subject, such as a Column of a Resource or a Parameter of a Lens, or to a second object, such as the query behind a figure on a Resource. *Raised on 2026-10-23.* *Note of 2026-10-23, from Max: no second object. A part is in doubt: picking a Column while writing asks more of the writer, but every remark about a field is good documentation of the data. A proposal that asks nothing extra: a Message written from the row of a Column, on the Columns tab, carries that Column as well, the way the Subject is set from where a Message is written; it shows on the Column and in the Conversations of the Resource.* *Decided on 2026-10-23: no; a Message stays on the level of the objects themselves ([DEC-CV-05](#dec-cv-05)).*
- [ ] <a id="op-cv-04"></a>**OP-CV-04** · Discuss Messages as a whole before they are built: what they are for, enriching the data and informing colleagues, their kinds, and who is notified of which, as Max asked. *Raised on 2026-10-23.*
- [x] <a id="op-cv-03"></a>**OP-CV-03** · Decide which kinds of Subject come first. Resources have Conversations today ([design](../../design/principles.md#conversations)); Lenses, Reports and Collections would follow with the same Subject. *Raised on 2026-10-23.* *Decided on 2026-10-23: the Subject works the same for every kind of object, Resources, Lenses and queries among them, and later kinds ([DEC-CV-03](#dec-cv-03)).*
