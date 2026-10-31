# Conversations

| | |
| --- | --- |
| Domain | 14 of Data Hub · code `CV` |
| Status | The Messages in Data Hub implemented; notifications by e-mail and in Slack follow ([technical](../technical/14-conversations.md)) |
| Source of truth | This file |
| Origin | Listed in the domain overview on Confluence; no page of its own yet (Confluence name: Gesprek) |

**Scope:** Questions, Remarks and margin notes on an object.

**In one sentence:** every Message in Data Hub knows the object it is about, a Resource, a Lens, a query or any other, so that it always links to it, and so that all Messages about an object can be found and shown on it.

Every type of Message, from a User, an Owner, the Data Team or Data Hub itself, is in the [Message catalogue](message-catalogue.md): who sends it to whom and when, its texts, its Learning Card and what it asks.

*Functional domain 14 of Data Hub. Overview of all domains: [Functional domains](README.md).*

## Already touched on elsewhere

Pointers to material this domain will build on, collected during the migration. They are navigation, not requirements of this domain.

- Reactions on a Resource: [DEC-SR-20](04-stacks-and-resources.md#dec-sr-20), [DEC-SR-21](04-stacks-and-resources.md#dec-sr-21), [FR-SR-29](04-stacks-and-resources.md#fr-sr-29), [FR-SR-30](04-stacks-and-resources.md#fr-sr-30), and the [Kinds of Reaction](04-stacks-and-resources.md#kinds-of-reaction)
- Communication as a function of Data Hub: [What Data Hub does](../../overview/data-hub.md#what-data-hub-does)
- Form of the communication between colleagues: [OP-DH-33](../../overview/open-themes.md#op-dh-33)
- Notifications to an Owner reach the whole Owner Unit: [FR-LN-01](07-log-and-notifications.md#fr-ln-01)
- The Conversations of a Resource as a tab: [design](../../design/principles.md#messages-on-a-resource)

## Decisions

*The decisions and requirements below come from Max, 2026-10-23. They are proposals, still to be validated, and therefore Proposed.*

- <a id="dec-cv-01"></a>**DEC-CV-01** · Every Message carries its Subject: the kind of object it is about, such as a Resource, a Lens or a query, and the ID of that object. Data Hub sets the Subject from where the Message is written, on the page of the object or from a link to it; the writer never types it, and it never changes.
- <a id="dec-cv-02"></a>**DEC-CV-02** · Messages are kept in one place, by Subject. The Conversations of an object, the Message Centre of a User and every notification read from that one place, so that a Message exists once, wherever it shows.
- <a id="dec-cv-03"></a>**DEC-CV-03** · The Subject is the same for every kind of object in Data Hub that has an ID: Resources today; Lenses, queries by their Query ID ([FR-LN-05](07-log-and-notifications.md#fr-ln-05)), Reports, Collections and later kinds alike. A new kind of object adds only its name and how to link to it; Messages, their links and their retrieval stay the same. This answers [OP-CV-03](#op-cv-03).
- <a id="dec-cv-04"></a>**DEC-CV-04** · A Message is never private and is not a chat with a person: for that there is Slack. A Message enriches the data of its object and informs colleagues, so everyone who may see the object sees it. This answers [OP-CV-01](#op-cv-01).
- <a id="dec-cv-05"></a>**DEC-CV-05** · A Message is about a whole object, a Collection, a Resource, a Lens or a query, and never about a part of it, such as a Column or a Parameter, nor about a second object. This answers [OP-CV-02](#op-cv-02).
- <a id="dec-cv-06"></a>**DEC-CV-06** · What goes to and from the Data Team about an object goes through Messages too, on that object: a Request asks the Data Team for a decision, such as accepting a very large Lens ([FR-LE-09](09-lenses.md#fr-le-09)), and its reply is the decision. So the history of the decision stays with the object, for everyone who may see it.
- <a id="dec-cv-07"></a>**DEC-CV-07** · Every type of Message is in the Message Catalogue, which is part of the source code, in `packages/contracts`: who sends it to whom and when, its texts, plain and laid out, in Dutch and English, the Learning Card that explains it, and what it asks of whoever receives it. The web app, and later Slack and the MCP server, take their texts from it, and its page in docs, the [Message catalogue](message-catalogue.md), is generated from it, never written by hand. *Decided on 2026-10-28, by Max.*
- <a id="dec-cv-08"></a>**DEC-CV-08** · Data Hub has no communication between colleagues as such: every Message is about an asset in Data Hub, someone asking or telling something about it, and lives on that asset ([DEC-CV-01](#dec-cv-01), [DEC-CV-04](#dec-cv-04)). Its form is the kinds of Message of the [Message catalogue](message-catalogue.md): a Question, Remark, Signal or Request, and their replies. *Decided on 2026-10-28, by Max ([OP-DH-33](../../overview/open-themes.md#op-dh-33)).*
- <a id="dec-cv-09"></a>**DEC-CV-09** · A Question and a Remark both notify the Owner of the object and everyone already in the conversation. *Decided on 2026-10-28, by Max ([OP-CV-05](#op-cv-05)).*
- <a id="dec-cv-10"></a>**DEC-CV-10** · A Registration gives one Message per Resource, never one for several Resources of the same run. *Decided on 2026-10-28, by Max ([OP-CV-06](#op-cv-06)).*
- <a id="dec-cv-11"></a>**DEC-CV-11** · When the Data Team adds a Resource to a Collection, Data Hub tells the Owner of that Collection with a Message. *Decided on 2026-10-28, by Max ([OP-CV-07](#op-cv-07)).*
- <a id="dec-cv-12"></a>**DEC-CV-12** · When a Resource is withdrawn, Data Hub tells its Owner with a Message. Its Consumers are not told. *Decided on 2026-10-28, by Max ([OP-CV-08](#op-cv-08)).*

## Terms

| Term | Meaning |
| --- | --- |
| [Message](../../definitions.md#message) | What a User writes on an object in Data Hub, such as a Resource, a Lens or a query, to enrich its data and inform colleagues: a Question, Remark, Signal or Request, or a reply. Never private. |
| [Subject](../../definitions.md#subject) | What a Message is about: the kind of object and its ID. |
| [Request](../../definitions.md#request) | A Message that asks the Data Team for a decision on its object; its reply is the decision. |
| [Message Catalogue](../../definitions.md#message-catalogue) | The list of every type of Message, in the source code, with its Message ID, its texts, its Learning Card and what it asks. |
| [Message ID](../../definitions.md#message-id) | The fixed code of a type of Message in the Message Catalogue, such as `MSG-RES-02`. |

## Flow

1. **Writing.** On the page of a Resource, a User asks a Question about it. Data Hub gives the Message its Subject: Resource, with the ID of that Resource.
2. **Delivering.** The Owner Unit gets the Message in its Message Centre and as a notification ([FR-LN-01](07-log-and-notifications.md#fr-ln-01)), each with a link to the Resource, opening at the Message.
3. **Replying.** The Owner opens the Message in context: the page of the Resource, with the Question in a floating window over it ([FR-CV-09](#fr-cv-09)). They reply there, with the Resource in view; the reply has the same Subject.
4. **Showing.** The Conversations of the Resource show every Message with its Subject, the Question and its reply among them, to everyone who may see the Resource.

## Requirements

<a id="fr-cv-01"></a>
### FR-CV-01 · A Message is always about something

**Status:** Implemented · **Source:** Max, 2026-10-23 · **Screens:** [collection-messages](../../design/screens/collection-messages.html), [learning-message](../../design/screens/learning-message.html), [lens-messages](../../design/screens/lens-messages.html), [messages](../../design/screens/messages.html), [resource-messages](../../design/screens/resource-messages.html)

Every Message has a Subject ([DEC-CV-01](#dec-cv-01)): a Question, Remark, Signal or Request on an object, and a reply alike. A reply takes the Subject of the Message it answers. There is no Message without a Subject. *Note of 2026-10-24: a Learning Card is an object of Messages too, and a Message can carry one ([FR-LR-06](16-learning.md#fr-lr-06), [FR-LR-07](16-learning.md#fr-lr-07)).*

<a id="fr-cv-02"></a>
### FR-CV-02 · A Message links to its object

**Status:** Implemented · **Source:** Max, 2026-10-23 · **Screens:** [lens-context](../../design/screens/lens-context.html), [lens-new-context](../../design/screens/lens-new-context.html), [messages](../../design/screens/messages.html)

Wherever a Message shows, in the Message Centre, in a notification, through Claude or another channel, it carries a link to its object, opening at the Message in the Conversations of that object: the page of a Resource or a Lens, a query in Query. Data Hub builds the link from the Subject when it shows the Message, so that the link keeps working when the object is renamed. The Message shows the object by its kind, with its icon, and its current name.

*Note of 2026-10-23: opening at the Message is "Open in context", the page of the object with the Message in a floating window ([FR-CV-09](#fr-cv-09)).*

<a id="fr-cv-03"></a>
### FR-CV-03 · A Message is placed on its object, not sent to a person

**Status:** Implemented · **Source:** Max, 2026-10-23 · **Screens:** [collection-messages](../../design/screens/collection-messages.html), [learning-message](../../design/screens/learning-message.html), [lens-context](../../design/screens/lens-context.html), [lens-messages](../../design/screens/lens-messages.html), [lens-new-context](../../design/screens/lens-new-context.html), [messages](../../design/screens/messages.html), [notifications](../../design/screens/notifications.html), [resource-messages](../../design/screens/resource-messages.html)

A Message has no recipient of its own: it is placed on its object, for everyone who may see it ([DEC-CV-04](#dec-cv-04)). Who gets a notification of it follows its kind: a Question or a Remark notifies the Owner of the object, which is its whole Owner Unit ([FR-LN-01](07-log-and-notifications.md#fr-ln-01)), and everyone already in the conversation ([DEC-CV-09](#dec-cv-09)); a Signal notifies the Owner and the Data Team ([FR-SR-30](04-stacks-and-resources.md#fr-sr-30)); a Request notifies the Data Team, and its decision notifies who sent it ([FR-CV-08](#fr-cv-08)).

*Note of 2026-10-29, on building part 7a: in Data Hub the notification is the Message for the User, unread in the Message Centre with its number in the rail ([TR-CV-01](../technical/14-conversations.md#tr-cv-01)); by e-mail and in Slack it follows with part 7b of the [build order](../../design/build-order.md).*

*Note of 2026-10-29, on building part 7b: catalogue notifies by the recipients of each type in the Message Catalogue, never the writer of the Message, in Data Hub, by e-mail and in Slack ([TR-LN-01](../technical/07-log-and-notifications.md#tr-ln-01), [TR-LN-02](../technical/07-log-and-notifications.md#tr-ln-02)).*

<a id="fr-cv-04"></a>
### FR-CV-04 · All Messages about an object can be retrieved

**Status:** Implemented · **Source:** Max, 2026-10-23 · **Screens:** [collection-messages](../../design/screens/collection-messages.html), [learning-message](../../design/screens/learning-message.html), [lens-messages](../../design/screens/lens-messages.html), [resource-messages](../../design/screens/resource-messages.html)

Data Hub finds every Message about an object by its Subject, kind and ID, with their replies, newest first. The Conversations of the object show them, and the API and the MCP server of Data Hub return them, so that Claude can read what was asked and answered about an object.

<a id="fr-cv-05"></a>
### FR-CV-05 · Who sees a Message follows who sees its object

**Status:** Implemented · **Source:** Max, 2026-10-23 · **Screens:** [collection-messages](../../design/screens/collection-messages.html), [learning-message](../../design/screens/learning-message.html), [lens-messages](../../design/screens/lens-messages.html), [messages](../../design/screens/messages.html), [resource-messages](../../design/screens/resource-messages.html)

Only a User who may see the object of a Message sees the Message and follows its link: a Resource by its Publication and Collection ([FR-SR-31](04-stacks-and-resources.md#fr-sr-31)), a Lens by its Resources ([DEC-CO-16](03-collections.md#dec-co-16)), a query by who ran it and the Data Team ([DEC-LN-01](07-log-and-notifications.md#dec-ln-01)). Everyone who may see the object sees all its Messages: none is private ([DEC-CV-04](#dec-cv-04)).

<a id="fr-cv-06"></a>
### FR-CV-06 · The Message Centre

**Status:** Implemented · **Source:** Max, 2026-10-23 · [design](../../design/principles.md#messages) · **Screens:** [messages](../../design/screens/messages.html)

Every User has a Message Centre, reached from the navigation with the number of unread Messages. It shows, by default, the Messages for them: on the objects their Owner Unit owns, the Messages they wrote or answered, the Signals for the Data Team, and what Data Hub itself tells them, such as a Level that dropped. It filters on unread, written by them and everything they may see; on the kind of Message; and on the kind of object. Each Message shows its object and links to it ([FR-CV-02](#fr-cv-02)); opened, it shows its replies and a field to answer.

*Note of 2026-10-30: it opens on its unread Messages, and says "Nothing to catch up on" when there are none; the Messages for them stay one click away ([DEC-UX-136](../../design/principles.md#dec-ux-136)).*

<a id="fr-cv-07"></a>
### FR-CV-07 · The Messages of an object, on the object

**Status:** Implemented · **Source:** Max, 2026-10-23 · [design](../../design/principles.md#messages) · **Screens:** [collection-messages](../../design/screens/collection-messages.html), [learning-message](../../design/screens/learning-message.html), [lens](../../design/screens/lens.html), [lens-context](../../design/screens/lens-context.html), [lens-messages](../../design/screens/lens-messages.html), [resource-detail](../../design/screens/resource-detail.html), [resource-messages](../../design/screens/resource-messages.html)

The page of a Collection, a Resource and a Lens has "Messages", with their number, which opens the Messages on that object in a slide-in: the Message Centre filtered on the object ([DEC-CV-02](#dec-cv-02)). It starts with a field for a new Message, whose Subject is that object. A Collection takes a Question or a Remark; a Resource and a Lens also a Signal, as a Signal is about data.

<a id="fr-cv-08"></a>
### FR-CV-08 · A Request asks the Data Team for a decision

**Status:** Implemented · **Source:** Max, 2026-10-23 · **Screens:** [lens-new](../../design/screens/lens-new.html), [lens-new-context](../../design/screens/lens-new-context.html), [messages](../../design/screens/messages.html)

A Request is a Message on an object that asks the Data Team for a decision ([DEC-CV-06](#dec-cv-06)). The first is accepting a very large Lens: "Send to the data team" on making it sends a Request on that Lens, with what one run reads and the word of its author ([FR-LE-09](09-lenses.md#fr-le-09)). Data Hub sends one itself when a Lens grows into very large ([FR-LE-10](09-lenses.md#fr-le-10)). A Request is waiting, accepted or refused. A member of the Data Team decides in the Message Centre, and the decision is its reply, a refusal with a reason; who sent it gets a notification. Every Request waiting is in the Message Centre of the Data Team.

<a id="fr-cv-09"></a>
### FR-CV-09 · A Message opens in its context

**Status:** Implemented · **Source:** Max, 2026-10-23 · [design](../../design/principles.md#messages) · **Screens:** [lens-context](../../design/screens/lens-context.html), [lens-new-context](../../design/screens/lens-new-context.html), [messages](../../design/screens/messages.html)

Every Message in the Message Centre, and the link in a notification of it, has "Open in context". It opens the page of its object as it is, with the Message in a floating window over it: the Message with its replies and a field to reply, or for a Request the decision of the Data Team ([FR-CV-08](#fr-cv-08)). The page stays usable behind the window, so that the User reads the object while answering: the result of a Lens, the columns of a Resource, the size check of a Lens waiting to be accepted. The address of the page names the Message, so that the same link works from a notification ([FR-CV-02](#fr-cv-02)). The window shows one Message; the slide-in shows all Messages on the object ([FR-CV-07](#fr-cv-07)).

<a id="fr-cv-10"></a>
### FR-CV-10 · Every type of Message is in the Message Catalogue

**Status:** Implemented · **Source:** Max, 2026-10-28

Every type of Message, what a person writes and what Data Hub writes itself, has an entry in the [Message catalogue](message-catalogue.md), with a fixed Message ID ([DEC-CV-07](#dec-cv-07)): its kind, the kinds of object it can be about, who sends it, who gets a notification of it, when it is written and how many there are, the requirements it comes from and its open points. A new type of Message enters the catalogue before it is built. A test checks the catalogue, and `pnpm docs:check` fails when its page in docs is behind it.

<a id="fr-cv-11"></a>
### FR-CV-11 · A Message has a plain and a laid-out text

**Status:** Implemented · **Source:** Max, 2026-10-28

Every type of Message has two layouts, with the same parameters. Plain text has no formatting at all: for a notification, the fallback of a Slack message or a screen reader; its first line stands alone, as the line of the Message in a list. Laid-out text uses a small part of Markdown that every channel can render: paragraphs, strong, struck, a name as code, items and the words of a person as a quote.

<a id="fr-cv-12"></a>
### FR-CV-12 · What Data Hub writes is system text with placeholders

**Status:** Implemented · **Source:** Max, 2026-10-28

A Message that Data Hub writes itself is system text with placeholders, filled in when the Message shows, so that a name in it is always current. It has one template per language, Dutch and English, with the same parameters ([NFR-LOC-10](../non-functional/localisation.md#nfr-loc-10)), and its names are never translated ([NFR-LOC-01](../non-functional/localisation.md#nfr-loc-01)). For a Message a person writes, the catalogue holds the frame of their words wherever it shows outside its object, such as in a notification, and for a Request or a notice the facts Data Hub adds to them.

<a id="fr-cv-13"></a>
### FR-CV-13 · Every type of Message says what it asks of whoever receives it

**Status:** Implemented · **Source:** Max, 2026-10-28

For every type of Message, the catalogue says what it asks of whoever receives it, nothing, an answer, a decision or something to do, and of whom. It names the buttons in the Message that take the receiver to that action, which link the action to the Message; the states the Message goes through while it waits; and what ends it, which the Message then shows. A Message that asks nothing says so in its own text.

<a id="fr-cv-14"></a>
### FR-CV-14 · Every type of Message from Data Hub has its Learning Card

**Status:** Implemented · **Source:** Max, 2026-10-28

For every type of Message that Data Hub writes itself, the catalogue names the Learning Card that explains it ([FR-LR-38](16-learning.md#fr-lr-38)), and why it fits: named by a requirement or a decision, proposed from the master learning plan, or still to be written, with the nearest card there is today. A Message that a person writes carries a card only when its writer adds one ([FR-LR-07](16-learning.md#fr-lr-07)).

<a id="fr-cv-15"></a>
### FR-CV-15 · A Message reaches every channel from the same texts

**Status:** Implemented · **Source:** Max, 2026-10-28 · **Screens:** [messages](../../design/screens/messages.html), [notifications](../../design/screens/notifications.html)

The web app shows a Message from the catalogue: the first line of its plain text in a list and in a notification, its laid-out text when it is opened. Later, Slack and the MCP server show the same Message from the same texts: Slack its laid-out text in its own mark-up, with the plain text as the fallback; the MCP server its laid-out text with its parameters, so that Claude reads what a person reads. Which channel carries a notification, and how often, is [OP-DH-20](../../overview/open-themes.md#op-dh-20).


*Note of 2026-10-28: the part for Claude comes in version 2 ([DEC-CH-02](13-channels.md#dec-ch-02)).*

*Note of 2026-10-29, on building part 7a: the web app shows what Data Hub writes from the catalogue, its first line in a list and its laid-out text when opened; a Message a person wrote shows their words, with its kind, its writer and its object beside them, as the [design](../../design/screens/messages.html) does, so that the frame of the catalogue is for notifications ([TR-CV-03](../technical/14-conversations.md#tr-cv-03)).*

*Note of 2026-10-29, on building part 7b: Slack shows the laid-out text in its own mark-up with the plain text as its fallback, and e-mail the first line of the plain text as its subject and the laid-out text as its body, as drawn in [notifications](../../design/screens/notifications.html) ([TR-LN-03](../technical/07-log-and-notifications.md#tr-ln-03), [TR-LN-04](../technical/07-log-and-notifications.md#tr-ln-04)); the MCP server follows in version 2.*

## Edge cases

<a id="ec-cv-01"></a>
### EC-CV-01 · The object no longer exists

**Status:** Implemented

When the object of a Message is removed, or its Collection dissolved, the Message stays, still found by its Subject. Its link then says that the object no longer exists, with the name it had.

<a id="ec-cv-02"></a>
### EC-CV-02 · A Resource moves to another Collection

**Status:** Implemented

The Messages about a Resource follow it to its new Collection, as their Subject is the Resource and not its Collection. Who sees them changes with who may see the Resource ([FR-CV-05](#fr-cv-05)).

## Out of scope

Who gets which notification, when and through which channel belongs to [Log and notifications](07-log-and-notifications.md); the channels themselves to [Channels](13-channels.md).

## Open points

- [x] <a id="op-cv-01"></a>**OP-CV-01** · Decide whether a Message to one person shows in the Conversations of its object for everyone who may see the object, or only for its writer and its recipient. Proposal: for everyone who may see the object, as the Reactions do ([DEC-SR-20](04-stacks-and-resources.md#dec-sr-20)), so that an answer helps the next person with the same question. *Raised on 2026-10-23.* *Decided on 2026-10-23: there are no private Messages and no Messages to a person; a Message enriches the data and informs colleagues, and a chat belongs in Slack ([DEC-CV-04](#dec-cv-04)).*
- [x] <a id="op-cv-02"></a>**OP-CV-02** · Decide whether a Message can point to a part of its object besides its Subject, such as a Column of a Resource or a Parameter of a Lens, or to a second object, such as the query behind a figure on a Resource. *Raised on 2026-10-23.* *Note of 2026-10-23, from Max: no second object. A part is in doubt: picking a Column while writing asks more of the writer, but every remark about a field is good documentation of the data. A proposal that asks nothing extra: a Message written from the row of a Column, on the Columns tab, carries that Column as well, the way the Subject is set from where a Message is written; it shows on the Column and in the Conversations of the Resource.* *Decided on 2026-10-23: no; a Message stays on the level of the objects themselves ([DEC-CV-05](#dec-cv-05)).*
- [x] <a id="op-cv-04"></a>**OP-CV-04** · Discuss Messages as a whole before they are built: what they are for, enriching the data and informing colleagues, their kinds, and who is notified of which, as Max asked. *Raised on 2026-10-23.* *Done on 2026-10-28, by Max.*
- [x] <a id="op-cv-05"></a>**OP-CV-05** · Decide who gets a notification of a Remark. [FR-CV-03](#fr-cv-03) says a Question or a Remark notifies the Owner of the object; the [Kinds of Reaction](04-stacks-and-resources.md#kinds-of-reaction) of a Resource say a Remark notifies only whoever is already in the conversation, and a Question the Owner and them. The Message Catalogue follows [FR-CV-03](#fr-cv-03), with whoever is in the conversation added ([MSG-CNV-02](message-catalogue.md#msg-cnv-02)). *Raised on 2026-10-28, while making the Message Catalogue.* *Decided on 2026-10-28, by Max: the Owner and everyone in the conversation ([DEC-CV-09](#dec-cv-09)).*
- [x] <a id="op-cv-06"></a>**OP-CV-06** · Decide whether a Registration gives one Message per Resource or one per run. The design shows one Message for three Resources that came in together ([messages](../../design/screens/messages.html)), while a Message has one Subject, a whole object ([DEC-CV-01](#dec-cv-01), [DEC-CV-05](#dec-cv-05)). The catalogue has one per Resource ([MSG-RES-01](message-catalogue.md#msg-res-01)). Proposal: one per Resource, which the Message Centre groups by run in its list. *Raised on 2026-10-28, while making the Message Catalogue.* *Decided on 2026-10-28, by Max: one per Resource ([DEC-CV-10](#dec-cv-10)).*
- [x] <a id="op-cv-07"></a>**OP-CV-07** · Decide whether Data Hub tells the Owner when the Data Team adds a Resource to their Collection ([MSG-RES-08](message-catalogue.md#msg-res-08)). No requirement asks for it, but the Owner takes the Resource from there ([Flow: registering a Resource](04-stacks-and-resources.md#flow-registering-a-resource), step 9), and without a Message finds it only by looking. The catalogue has it, Proposed. *Raised on 2026-10-28, while making the Message Catalogue.* *Decided on 2026-10-28, by Max: yes ([DEC-CV-11](#dec-cv-11)).*
- [x] <a id="op-cv-08"></a>**OP-CV-08** · Decide whether Data Hub tells the Owner when a Resource is withdrawn ([DEC-SR-26](04-stacks-and-resources.md#dec-sr-26), [MSG-RES-06](message-catalogue.md#msg-res-06)), and whether its Consumers hear it too. The catalogue has it for the Owner, Proposed. *Raised on 2026-10-28, while making the Message Catalogue.* *Decided on 2026-10-28, by Max: the Owner, yes ([DEC-CV-12](#dec-cv-12)).*
- [x] <a id="op-cv-09"></a>**OP-CV-09** · Review the Dutch texts of the [Message catalogue](message-catalogue.md), a first version, and decide the Dutch words for the terms the translation reference lacks: Owner and Owner Unit (written owner and owner unit for now), Request (aanvraag) and withdrawn (ingetrokken). *Raised on 2026-10-28, while making the Message Catalogue.* *Decided on 2026-10-28, by Max: the first version is accepted and can be revised later; the words as written stand, and are in the [translation reference](../../definitions.md#translation-reference).*
- [x] <a id="op-cv-03"></a>**OP-CV-03** · Decide which kinds of Subject come first. Resources have Conversations today ([design](../../design/principles.md#messages-on-a-resource)); Lenses, Reports and Collections would follow with the same Subject. *Raised on 2026-10-23.* *Decided on 2026-10-23: the Subject works the same for every kind of object, Resources, Lenses and queries among them, and later kinds ([DEC-CV-03](#dec-cv-03)).*
