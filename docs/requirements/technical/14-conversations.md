# Conversations: technical requirements

| | |
| --- | --- |
| Realises | [Conversations](../functional/14-conversations.md) |
| Status | The Messages in Data Hub implemented: the Message Centre, the Messages on every object, a Message in context and the decision on a Request; their notifications by e-mail and in Slack are in [Log and notifications](07-log-and-notifications.md) |
| Source of truth | This file |

How Messages are kept and shown, in the service [catalogue](../../architecture/services/catalogue.md), which keeps them for every object ([DEC-CV-02](../functional/14-conversations.md#dec-cv-02)), and in the [web app](../../architecture/services/web.md).

## Requirements

<a id="tr-cv-01"></a>
### TR-CV-01 · catalogue keeps every conversation, by its Subject

**Status:** Implemented · **Realises:** [FR-CV-01](../functional/14-conversations.md#fr-cv-01), [FR-CV-02](../functional/14-conversations.md#fr-cv-02), [FR-CV-04](../functional/14-conversations.md#fr-cv-04), [FR-CV-05](../functional/14-conversations.md#fr-cv-05), [FR-CV-06](../functional/14-conversations.md#fr-cv-06), [FR-CV-07](../functional/14-conversations.md#fr-cv-07), [EC-CV-01](../functional/14-conversations.md#ec-cv-01), [EC-CV-02](../functional/14-conversations.md#ec-cv-02), [DEC-CV-04](../functional/14-conversations.md#dec-cv-04), [DEC-CV-09](../functional/14-conversations.md#dec-cv-09)

A Message is a row of `messages`: its Message ID, its Subject, its writer by their fixed Google ID or none for Data Hub, its parameters, the words of its writer among them as `text`, its writer's name and how they stand to the object, Owner or Data Team, and its state. A reply, and the decision on a Request, is a row under the Message it answers (`parent_id`), with the same Subject; the first Message of a conversation keeps when it last moved and by whom. `message_reads` keeps until when each User read a conversation: it is unread for them once someone else moved it later.

Who sees a conversation follows who sees its object ([FR-CV-05](../functional/14-conversations.md#fr-cv-05)), worked out once per request from the Collections and Resources the User sees: a Collection they see, a Resource they may use, a Lens as query decides it ([TR-CV-02](#tr-cv-02)), a query by who wrote on it; the Data Team sees all. A conversation is for the User when they started it or replied in it, or when its first Message notifies them, by the recipients of its type in the Message Catalogue: as Owner, on what their Owner Units own; as the Data Team; as the author of its Lens.

`GET /messages` gives the conversations of a view, `forYou`, `unread`, `written` or `everything`, filtered on a kind, Question, Remark, Signal, Request or what Data Hub writes, on a kind of object, and on words in the Message, its replies or the name of its object; newest first, at most 200, with the counts of the panel. `GET /messages/unread` counts the conversations for the User that are unread. `GET /messages/{id}` gives one conversation with its replies, a reply its conversation; `GET /messages/on/{kind}/{id}` the conversations on a Collection, a Resource or a Lens. `POST /messages` writes a Question or a Remark on any of them, a Signal on a Resource or a Lens; a Signal on a Resource enters its Log (`CNV-050`). `POST /messages/{id}/replies` replies to a Question, Remark or Signal; the first reply of someone else makes a Question or a Signal answered. `POST /messages/{id}/read` marks a conversation read. A Message on an object that no longer exists keeps the name it had, and says so.

<a id="tr-cv-02"></a>
### TR-CV-02 · query tells catalogue about its Lenses, and the decisions on them

**Status:** Implemented · **Realises:** [FR-CV-05](../functional/14-conversations.md#fr-cv-05), [FR-CV-08](../functional/14-conversations.md#fr-cv-08), [FR-LE-09](../functional/09-lenses.md#fr-le-09), [FR-LE-10](../functional/09-lenses.md#fr-le-10), [DEC-CV-06](../functional/14-conversations.md#dec-cv-06), [DEC-PF-30](00-platform.md#dec-pf-30), [DEC-UX-128](../../design/principles.md#dec-ux-128)

Lenses live in query, and only query calls catalogue, never the other way. So query tells catalogue, with its Google ID token for catalogue's address, what decides who sees the Messages on a Lens: its name, its Collection, its Resources, its state and its author (`PUT /internal/lenses/{id}`, kept in `lenses` of catalogue). It does so whenever a Lens is made, edited, updated, stops or is decided on, when it starts, and in its daily check, so that a change that did not reach catalogue does tomorrow. catalogue applies the rule of query: a Lens in a Collection the User sees, on Resources they may all use; while it waits or once it is refused, its author and the Data Team only ([DEC-CO-16](../functional/03-collections.md#dec-co-16)).

When a run with its defaults makes a Lens stop past 1 GB, query sends the Request of Data Hub on it (`POST /internal/lenses/{id}/requests`, [MSG-LEN-03](../functional/message-catalogue.md#msg-len-03)), one at a time; when it grows past 100 MB from below and keeps running, query has Data Hub tell its author (`POST /internal/lenses/{id}/growth`, [MSG-LEN-02](../functional/message-catalogue.md#msg-len-02)), without the partition column for now. The Data Team decides on a Request on a Lens on the Lens, in query (`POST /lenses/{id}/decision`): query records the decision in catalogue as its reply (`POST /internal/messages/{id}/decision`, [MSG-CNV-05](../functional/message-catalogue.md#msg-cnv-05)) and changes the Lens with it, in its Log (`LEN-001`, `LEN-002`). Accepted, a waiting Lens is published and a stopped one runs again at that size; refused, a waiting Lens is `refused`: unpublished, for its author and the Data Team, not running and no longer frozen, until its author updates it from its query; a stopped one stays stopped. A stopped Lens without a Request, from before Messages, gets one when the Data Team decides. A Request on a query is decided in catalogue (`POST /messages/{id}/decision`), which query reads before a run ([TR-SR-18](04-stacks-and-resources.md#tr-sr-18)). Only the Data Team decides; a refusal needs a reason.

<a id="tr-cv-03"></a>
### TR-CV-03 · The web app shows the Message Centre, the Messages on an object and a Message in context

**Status:** Implemented · **Realises:** [FR-CV-02](../functional/14-conversations.md#fr-cv-02), [FR-CV-06](../functional/14-conversations.md#fr-cv-06), [FR-CV-07](../functional/14-conversations.md#fr-cv-07), [FR-CV-09](../functional/14-conversations.md#fr-cv-09), [DEC-UX-29](../../design/principles.md#dec-ux-29), [DEC-UX-30](../../design/principles.md#dec-ux-30)

Messages in the rail carries the number of conversations unread for the User, read when Data Hub opens, every minute and after a Message moves. `/messages` is the Message Centre: its panel filters on the views, the kinds and the kinds of object; `/messages/{id}` opens a Message on the right and marks it read. The page of a Collection, a Resource or a Lens has "Messages" with their number; `/{object}/messages` opens the slide-in, with what a person wrote on it. `/{object}/messages/{id}` opens a Message in context, a query too: the page of its object with the Message in a floating window, closed back to the Message Centre. A person's words show as they wrote them, with their name and object beside them; what Data Hub writes shows from the Message Catalogue, the first line of its plain text in a list and its laid-out text when opened, with the labels of its buttons, such as "Open in context", "Accept" and "Refuse".

<a id="tr-cv-04"></a>
### TR-CV-04 · catalogue keeps the marks of each User on a conversation

**Status:** Implemented · **Realises:** [FR-CV-19](../functional/14-conversations.md#fr-cv-19), [FR-CL-40](../functional/17-claude.md#fr-cl-40), [DEC-UX-360](../../design/principles.md#dec-ux-360), [DEC-UX-366](../../design/principles.md#dec-ux-366), [DEC-UX-367](../../design/principles.md#dec-ux-367)

A mark is a row of `message_marks`: the first Message of a conversation, the User by their fixed Google ID, the mark, `followUp`, `important` or `starred` as `MESSAGE_MARKS` of `@datahub/contracts/messages` lists them, and when it was set; a Message deleted takes its marks with it. Every conversation catalogue gives carries the marks of the User who asks, in that order, never those of anyone else. `PUT /messages/{id}/marks/{mark}` sets a mark and `DELETE` takes it off, each for the User alone, on a conversation they see, a reply marking its conversation; both answer the marks it holds now, and 404 on a Message they do not see. `GET /messages` takes `mark` to give the conversations of the User with that mark, newest first, read or not, and its counts hold how many conversations each mark holds, of those the User sees, whatever else is chosen. A conversation the User may no longer see is left out of both, its mark kept until they see it again.

The MCP server gives the marks with every Message `get_messages` reads, and reads one mark with its `mark`; `mark_message` sets or takes off a mark through the same routes, for every User, without showing first what it writes ([DEC-UX-367](../../design/principles.md#dec-ux-367)).

<a id="tr-cv-05"></a>
### TR-CV-05 · The web app shows the marks on a Message and in the panel

**Status:** Implemented · **Realises:** [FR-CV-19](../functional/14-conversations.md#fr-cv-19), [DEC-UX-361](../../design/principles.md#dec-ux-361) to [DEC-UX-365](../../design/principles.md#dec-ux-365)

`MarksButton.svelte` is the button of the marks: every mark set, filled, or an outlined flag; its dropdown is a menu of three `menuitemcheckbox` rows that stays open while marks are set. It sits in the head of an opened Message, in the floating window of a Message in context, in the head of each conversation of the slide-in and at the end of each line of the Message Centre, outside the link of the line. A mark set or taken off changes the Message wherever it shows and the counts of the panel at once, without reading the list again, so that a Message taken off in the view of its mark stays there, faded. The panel shows a mark only while it holds a Message or is the view shown, above the views, under a rule; its view reads `GET /messages` with that `mark`, with its name and what it is for as the title of the list, and leaves the chips out. The quick window has "Mark as …" and "Take off …" for an opened Message, and each mark as a view.
