# Log and notifications: technical requirements

| | |
| --- | --- |
| Realises | [Log and notifications](../functional/07-log-and-notifications.md) |
| Status | Notifications by e-mail and in Slack implemented |
| Source of truth | This file |

How a Message reaches the people it notifies outside Data Hub, by e-mail and as a direct message in Slack. The service [catalogue](../../architecture/services/catalogue.md) keeps every Message ([TR-CV-01](14-conversations.md#tr-cv-01)) and sends its notifications; [identity](../../architecture/services/identity.md) knows who they reach. In Data Hub itself a Message reaches the User in the Message Centre ([TR-CV-03](14-conversations.md#tr-cv-03)).

## Requirements

<a id="tr-ln-01"></a>
### TR-LN-01 · catalogue sends every Message as it is written, and again until it went out

**Status:** Implemented · **Realises:** [DEC-LN-02](../functional/07-log-and-notifications.md#dec-ln-02), [FR-CV-03](../functional/14-conversations.md#fr-cv-03)

A trigger on `messages` puts every Message in the outbox `notifications` as it is written, in the same transaction, so that no way of writing one is missed; the Messages from before are not notified. Every request to catalogue that may have written one, any but a read, sends what is due before it answers, for at most four seconds, as Cloud Run gives a service no time once it answered. Every five minutes Cloud Scheduler calls `POST /internal/notifications/deliver` with a Google ID token of `datahub-scheduler` for catalogue's address, which catalogue checks itself ([TR-PF-14](00-platform.md#tr-pf-14)); that round sends what is left, for at most fifty seconds.

A round takes what is due with `for update skip locked` and leases it for two minutes, so that two rounds never send the same. `notification_deliveries` keeps what went out, an e-mail to an address or a direct message to a User, so that trying again sends only what failed. What failed is tried again after 1, 5, 15, 60 and 240 minutes, with what went wrong in `failure`; after the sixth try it is given up and logged as an error.

<a id="tr-ln-02"></a>
### TR-LN-02 · A notification reaches the recipients of its type, each once, never its writer

**Status:** Implemented · **Realises:** [FR-LN-01](../functional/07-log-and-notifications.md#fr-ln-01), [FR-CV-03](../functional/14-conversations.md#fr-cv-03), [DEC-LN-03](../functional/07-log-and-notifications.md#dec-ln-03), [DEC-LN-07](../functional/07-log-and-notifications.md#dec-ln-07)

Who a Message notifies follows the recipients of its type in the Message Catalogue, in that order, each person for the first reason that holds: `owner`, the Owner Unit of the Collection of its object, and for a Resource without a Collection the Data Team; `dataTeam`; `writer`, who wrote the Message it answers or the Request it decides; `participants`, who started its conversation or replied in it before; `author`, who made its Lens. The Owners of the Resources under a Lens and the Consumers of a Resource come with the Messages that need them ([MSG-LEN-04](../functional/message-catalogue.md#msg-len-04), [MSG-RES-07](../functional/message-catalogue.md#msg-res-07)).

An Owner Unit and the Data Team get one e-mail at the address of their Google group, in Dutch, which reaches every member, also who never signed in: the address of the Owner Unit as the Collection keeps it, `datahub-datateam@` for the Data Team. In Slack each of their members Data Hub knows gets a direct message, in their own language. identity keeps the Groups and roles of a User as it last read them, at a sign-in or a renewal, and none once the account is no longer active; catalogue asks `POST /internal/people` with its Google ID token for identity's address which Users of the Groups, the roles and the IDs it names Data Hub knows, with their address, name and language ([DEC-UX-96](../../design/principles.md#dec-ux-96)). A person gets an e-mail of their own unless a group they are known to be in gets it; whoever wrote the Message gets no direct message, though the e-mail to their group still reaches them.

<a id="tr-ln-03"></a>
### TR-LN-03 · E-mail goes through the SMTP relay of Workspace, from one fixed address

**Status:** Implemented · **Realises:** [DEC-LN-02](../functional/07-log-and-notifications.md#dec-ln-02), [FR-CV-15](../functional/14-conversations.md#fr-cv-15), [DEC-PF-31](00-platform.md#dec-pf-31), [DEC-UX-129](../../design/principles.md#dec-ux-129)

catalogue sends e-mail to `smtp-relay.gmail.com` on port 587 with TLS, from `DATAHUB_MAIL_FROM`, `Data Hub <datahub@immoscoop.be>` (`Data Hub uat` in uat), without a password: the relay admits Data Hub by the address its traffic leaves from. Terraform gives catalogue Direct VPC egress of all its traffic into the network `datahub`, and Cloud NAT takes it out on the one static address `datahub-egress`, the output `mail_egress_address`, which a Workspace admin adds to the relay once ([GCP setup](../../architecture/gcp-setup.md#9-google-workspace-by-a-workspace-admin)); the subnet reaches Google's APIs privately. Every e-mail says it was sent by a machine (`Auto-Submitted: auto-generated`), so that nobody's out-of-office answers it.

Its subject is the first line of the plain text of the Message, at most 140 characters, cut at a word with a quote closed. Its body is HTML with inline styles, always light, as drawn in [notifications](../../design/screens/notifications.html): the mark and "Data Hub", the object with its kind and Collection, the laid-out text of the Message with only the marks of the Message Catalogue and every value escaped, "Open in context" from the catalogue linking to the Message in context in the web app, and at the foot why it came, the Message Centre as a link and that replies are not read, from `NOTIFICATION_TEXTS` of the contracts in Dutch and English. A plain-text part holds the same.

<a id="tr-ln-04"></a>
### TR-LN-04 · Slack gets a direct message from the app of Data Hub

**Status:** Implemented · **Realises:** [DEC-LN-05](../functional/07-log-and-notifications.md#dec-ln-05), [DEC-LN-06](../functional/07-log-and-notifications.md#dec-ln-06), [FR-CV-15](../functional/14-conversations.md#fr-cv-15), [DEC-UX-129](../../design/principles.md#dec-ux-129)

catalogue reads the bot token from the secret `datahub-slack-bot-token`, when it first needs it and again every ten minutes; while the secret has no value, Slack is off and a notification goes by e-mail alone. It finds a User with `users.lookupByEmail` by the address of their Google account, opens the direct message with `conversations.open` and posts with `chat.postMessage`, never in a channel. The message holds the laid-out text in the mark-up of Slack (`*strong*`, `~struck~`, `` `code` ``, `>` for a quote, a bullet per item), "Open in context" as a button, and the object and why it came as context; its `text` is the plain text, which Slack shows where it cannot lay it out. A User who is not in Slack gets e-mail alone, and is not looked up again for that Message.
