# Data Hub design principles

Status: first version, 22 October 2026. Built in a design session with Max.

This file is the source of truth for **the rules** of the design. The **values** (colours, sizes, durations of transitions) live only in [`tokens.css`](tokens.css). The **screens** live in [`screens/`](screens/). Confluence describes this and links to it, but does not duplicate it.

Working agreement: when a rule changes, change this file first, then the tokens and the code.

Its decisions and open points carry IDs with the code `UX`, numbered and linked like the requirements ([requirements conventions](../requirements/README.md)). The web app does not follow this design yet; [OP-UX-07](#op-ux-07) to [OP-UX-13](#op-ux-13) are where it differs from what is decided or built today.

## Sources of truth

| What | Where |
| --- | --- |
| Rules, navigation behaviour, decisions | this file |
| Style values | [`tokens.css`](tokens.css) |
| Components | [`base.css`](base.css) (prototype), later the components in the app |
| Screens | [`screens/*.html`](screens/), each with the requirements it fulfils |

Data Hub is an internal tool and has no Figma. The design lives in code ([DEC-UX-01](#dec-ux-01)).

## General

- The interface is in **Dutch** by default, with English available; names stay English and are never translated ([DEC-DH-65](../overview/data-hub.md#dec-dh-65), [localisation](../requirements/non-functional/localisation.md)). *Note of 2026-10-25: this replaces "the interface is in English". The prototypes still show the interface in English.*
- **Calm and air:** plenty of negative space. Rather less on a screen than a full screen.
- **Full screen.** The content uses the full width, divided into blocks, never long rows or lines across the full width.

## Layers and focus

There are three layers:

1. **Background:** a slow transition between three warm colours (sand, blush, mist), or a picture painted as a watercolour ([DEC-UX-34](#dec-ux-34)).
2. **Frames:** the tab of the active navigation icon, the panel and the main area. Slightly transparent, they blend into the background.
3. **Reading surfaces:** everything with text on it that you actually read. Fully opaque (white, or warm grey within a white surface).

**Focus follows the mouse.** The window the mouse is in gets fully opaque reading surfaces. The other windows become slightly softer.

- By default the focus is on the main area, because that is where the actual work happens.
- The transition is slow and sweeps; it does not switch on and off (`--motion-focus`).
- A short delay (`--delay-focus`) makes sure that a mouse that only passes by sets nothing in motion.
- On touch, hover does not exist: there the window tapped last gets the focus.

## Colour

- **Colour only on content** (charts, Collections, Resources), **never on navigation**.
- Hover and active are **shades of grey**, not colour.
- The palette is **warm grey**. A deliberate deviation from the cool greys in the brandbook, because Data Hub is an internal tool.
- Text is **warm dark grey, never black**.
- Collections get a colour from the Collection palette. It lives in one configuration file, to which colours are added over time ([DEC-UX-60](#dec-ux-60)). Magenta, bordeaux and teal come from the brand; ochre, slate blue and olive are additions. The colour shows as **a thin bar on the left edge** of the card of a Collection, and of the head of its page ([DEC-UX-15](#dec-ux-15)).
- **Signal colour** (ochre) only for a state that calls for action, such as a Level that has dropped.
- **Urgent colour** (red, `--signal-urgent`) only for "Without a collection": Resources that wait for the Data Team ([DEC-UX-16](#dec-ux-16)); and for the button of a run that reads above the approval threshold ([DEC-UX-28](#dec-ux-28)).

*The app today uses the colours of the brandbook and nine Collection colours of its own: see [OP-UX-09](#op-ux-09). The nine stay in the configuration file next to the six of this design until testing on uat shows which stay ([DEC-UX-60](#dec-ux-60)).*

## Themes

- Light and dark. Dark is **warm dark grey** ([OP-UX-09](#op-ux-09)).
- By default the theme follows the system. The User can switch; the choice is remembered.

## Typography

- **Poppins**, with its weights for hierarchy: regular for text, medium for titles and names, semibold sparingly.
- One large page title, the rest small and calm.
- Technical names (Keys, columns, Log IDs) in a monospace font.

## Shape

- **Rounding only, never shadow.** Shadow does not work with transparent surfaces.
- Concave corners where two surfaces flow into each other: the active navigation icon into the panel (`--flare-nav`), the active tab into its content (`--flare-tab`).

## Icons

- One family: **Phosphor**.
- **Filled icons** for everything of the interface.
- **Line icons** for what the User chooses, such as the icon of a Collection, in the **light** weight by default; the other weights of Phosphor are possible too ([DEC-CO-19](../requirements/functional/03-collections.md#dec-co-19)). The icon of a Collection is **grey, without a circle**; its colour is the bar on the edge of its card ([DEC-UX-15](#dec-ux-15)). Only a real Collection has that bar.

*The web app built today still takes the icon of a Collection from Tabler Icons; moving it is [OP-CO-16](../requirements/functional/03-collections.md#op-co-16). The prototypes still draw those icons in the regular weight.*

- A Resource has **no icon of its own**: icons are for the interface and for Collections ([DEC-UX-06](#dec-ux-06)).
- In a list, an item has the **icon of its kind**: a table for a Resource, the same for every Resource. That icon is part of the interface ([DEC-UX-11](#dec-ux-11)).

## Navigation

- **On the left, floating:** the icons have no bar or background of their own. Three main items (Collections, Query, Reports; no Lenses, which live in their Collections, [DEC-UX-66](#dec-ux-66); see [OP-UX-11](#op-ux-11) and [DEC-UX-17](#dec-ux-17)); at the bottom Messages, with the number unread ([DEC-UX-29](#dec-ux-29)), then theme, the learning centre ([DEC-UX-52](#dec-ux-52)) and the account. There is no button for settings ([DEC-UX-53](#dec-ux-53)).
- **Collapsed,** each icon shows a label after a short delay. The active icon keeps its transparent tile.
- **A slide-out panel per main item.** The active icon and the panel form one shape: the icon has the same background as the panel and flows into it with concave corners.

### Navigation rules

1. **Click on another main item:** you go to that section and its panel slides open. The panel always belongs to the active section.
2. **Click on the main item you are already in:** the panel slides in or out. The button in the panel does the same.
3. **Click on an item in the panel:** the detail opens on the right; the panel stays.
4. **Click on a Collection in the panel:** its page opens on the right, and it unfolds in the panel ([DEC-UX-13](#dec-ux-13)). **The arrow** next to it only folds or unfolds it. Several can be unfolded at once.
5. Whether the panel is open or closed is **remembered per User** ([OP-UX-13](#op-ux-13)).

### What is in the panel

The panel is **the index of its section**: one panel, never a second one for what is inside an item ([DEC-UX-10](#dec-ux-10)). Screens: every screen of Collections; [resource-detail](screens/resource-detail.html) shows a Collection unfolded.

For Collections:

- **On top:** the title, a plus button for a new Collection, and search.
- **"Your collections":** each Collection with its icon, name, number of Resources and whether it is public or private, and an arrow that turns when it unfolds. The Collection whose page is open has an outline.
- **An unfolded Collection** shows what it holds in its own card, as a **plain list**: no box or rounded corners per item, little space between them.
  - Each item: the icon of its kind, under the centre of the icon of the Collection; its name; a small maturity icon on the right, in grey.
  - The item you are on: its name in medium weight and the darkest colour. Opening a Resource unfolds its Collection.
  - A Resource that is not published: its name in a lighter grey, without an icon. Hover says "not published" ([DEC-UX-12](#dec-ux-12)).
  - The first eight items, then "Show all" with the number.
  - **Then its Lenses,** right after the Resources, without a label of their own: the icon tells them apart. The Lenses of the Collection that the User sees, each with the lens icon, its name and its Level. Each group shows its first eight, then "Show all". Reports join later as a group of their own ([DEC-UX-65](#dec-ux-65), [FR-CO-36](../requirements/functional/03-collections.md#fr-co-36)).
- **"Shared resources":** each with the icon of its kind, its name and the team that owns it ([OP-UX-02](#op-ux-02)).
- **For the Data Team,** on top: "Without a collection", a card with the Resources that wait for a Collection. It is no Collection, so it has no colour bar: it is in the urgent red instead, with a red tint, a red name and icon, and the number waiting in a red badge ([DEC-UX-16](#dec-ux-16)).
- **One line per name:** a name that is too long ends in an ellipsis and shows in full on hover. This holds for Collections and Resources alike.
- **Search** filters Collections, Resources and Lenses together. A Collection whose name matches stays as it was; a Collection with a matching Resource or Lens unfolds and shows only those.

## Start screen per section

Each main item opens on a **start screen**, not on an overview that repeats the panel. The panel is the index; the start screen shows what the list cannot show.

For Collections:

- **Intro** at the top, with a graphic element, "What are collections?", a short explanation, the button "New collection" and a link to more explanation.
  - It can be dismissed. That is saved **per User and per section** in the settings.
  - The intro has a **version number**: after a big change it can appear again.
  - Dismissed: a calm title bar with "Show intro" and the fixed button "New collection".
- **A search for a question,** "What do you want to know?", over Collections, Resources and Lenses, as a new query finds Lenses ([FR-CO-37](../requirements/functional/03-collections.md#fr-co-37), [FR-SR-48](../requirements/functional/04-stacks-and-resources.md#fr-sr-48)).
- **Yours:** the Collections of the User's Owner Units, then the Lenses of the User and their Owner Unit, with when they last ran them. A Lens that waits for the Data Team says so; only its author sees it.
- **Recently**, switchable between **Updated** and **Added**: what changed, by whom and when.
- **Discover:** popular Collections, then Lenses switchable between **Popular** ([OP-UX-01](#op-ux-01)) and **New**, each Lens as a tile with its name, the question it answers, its Level, and when it ran or how often.

*Lenses had a start screen of their own; it is withdrawn on 2026-10-26, as Lenses have no section any more. Its search, "Yours" and Discover moved to the start screen of Collections ([DEC-UX-66](#dec-ux-66)).*

For Learning ([learning-start](screens/learning-start.html), [DEC-UX-38](#dec-ux-38)): an intro, "What is the learning centre?", with "Start with the compass"; a search; "Continue" with the card the User was reading; "Required for you" ([OP-LR-18](../requirements/functional/16-learning.md#op-lr-18)); the path from easy to advanced; and "New and changed". See [Learning](#learning).

## Grid

- The grid is **always 100% wide**.
- Tiles have a **minimum width**; they stretch until there is room for an extra column. That way there is never an empty strip on the right.
- The minimum width depends on the content and is chosen per screen.

## Tabs

- Real tabs: **rounded corners at the top, concave corners at the bottom** that flow into the content surface, and a **fine line** under the row of tabs.
- The content surface under the tabs is a reading surface. Tiles in it get a light warm-grey tint instead of a border.

## Maturity

- The **maturity icon**: six bars, filled up to the current Level (0 Beta, 1 Available, 2 Described, 3 Confirmed, 4 Explored, 5 Monitored).
- When the Level has **dropped**, the previous Level shows as an outlined bar in the signal colour.
- The icon is the fixed symbol for maturity, wherever a Resource appears. On hover it shows the name of the Level.
- In the panel it is smaller and grey, so the names lead; on the page of a Resource it is full size and dark.

## Detail page of a Resource

Screens: [resource-detail](screens/resource-detail.html), [resource-edit](screens/resource-edit.html), [resource-columns-edit](screens/resource-columns-edit.html), [resource-unassigned](screens/resource-unassigned.html) and [resource-publish](screens/resource-publish.html).

- **Header:** the name, the Key with a copy button, the button "Query", which starts a new query on the Resource in [Query](#query) ([DEC-UX-21](#dec-ux-21)), "Messages" with their number, which opens the Messages on the Resource in a slide-in ([DEC-UX-29](#dec-ux-29)), and the button "Ask a question", which opens the same slide-in with Question chosen ([DEC-UX-08](#dec-ux-08)). For its Owner, while it is not published, "Publish" takes the place of "Ask a question" ([DEC-UX-31](#dec-ux-31)). No icon: a Resource has none of its own.
- **Status row:** maturity, Publication, Owner, open Signals. No freshness ([DEC-UX-07](#dec-ux-07)).
- **Warning on a change** since the last Confirmation ([DEC-MR-08](../requirements/functional/06-maturity-and-release.md#dec-mr-08), [DEC-UX-64](#dec-ux-64)): what changed and when, in the signal colour, with the Level that stays. For the Owner and the Data Team, "Mark as seen" takes it away; the change stays in the History. There is no Reconfirm.
- **Tabs:** Overview, Columns, Lineage, EDA, History, Preview, Queries. No tab Conversations: the Messages open from "Messages" in the header ([DEC-UX-67](#dec-ux-67)).
- **Overview,** in tiles:
  - **Description:** the two descriptions side by side ([DEC-UX-61](#dec-ux-61)): the Business Description, written in Data Hub, and the description from dbt with its model type and grain, each marked with where it comes from. Without a Business Description, the description from dbt fills the tile, and the Owner and the Data Team see "Add a business description".
  - **Maturity:** the ladder, with the previous Level after a drop.
  - **Publication:** who published the Resource and when, who confirmed it last and when, and since when the data is reliable.
  - **Known Behaviour:** intended use and pitfalls.
  - **Known Gaps:** the structural gaps in the data.
  - **Stability:** whether the data is still settling or can change by nature, and from when it is final.
  - **Key fields and Parameters.**
  - **Entities and relationships:** each Entity with its identifier and the Resources it joins to, also as a picture. An Entity without an identifier at this grain is shown, but joins nothing.
  - **Monitoring:** the active checks and the incidents.
  - **Partitions and clustering:** the partition column and its unit, the number of partitions, the cluster columns in their order, the size, and a sentence on how to query cheaply. From dbt and BigQuery, read-only.
  - **Recent history** with Log IDs, across the full width.
- **Columns:** each column with its type, its Business Description and its description from dbt side by side, its Entity, and what it serves as: the Partition, a Cluster column with its place, a Parameter. A column without a Business Description shows the one from dbt alone. "Edit" above the table, for the Owner and the Data Team, opens the Business Descriptions of the fields.

### Editing a Resource

- The Owner and the Data Team edit what Data Hub keeps about a Resource **in place,** on the Overview: the definition, intended use, pitfalls, Known Gaps, Stability, since when the data is reliable, and the key fields and Parameters ([DEC-UX-09](#dec-ux-09)).
- Each tile they can edit has an "Edit" link. Editing turns the tiles into fields, with a bar on top that says every saved change goes into the history, and "Cancel" and "Save".
- What comes from dbt (the description, model type and grain, the columns) and what the Data Team gives (the Entities and relationships) is shown next to the fields, marked as such, and not edited here.
- **The Business Description** is written next to the description from dbt, never over it: the field on the left, the description from dbt on the right, read-only ([DEC-UX-61](#dec-ux-61)). Left empty, the description from dbt stands alone.
- **The fields** are edited on the Columns tab, the same way: "Edit" turns the table into a list, one row per field with its name and type, its Business Description as a field, and its description from dbt. A description from dbt that changed in the last 30 days says so, with its date and the text before, so the Owner sees what moved under their own; a filter shows only those fields. Screen: [resource-columns-edit](screens/resource-columns-edit.html).

### Messages on a Resource

- **No tab of their own** ([DEC-UX-67](#dec-ux-67)): the Messages on a Resource open in the slide-in from "Messages" in its header, as on every object ([DEC-UX-29](#dec-ux-29)); "Ask a question" opens it with Question chosen. See [Messages](#messages).
- On a Signal, the Owner and the Data Team can make it an Anomaly.
- Every Message knows its Subject, the object it is about: a Resource here, a Lens or a query elsewhere, the same way ([DEC-CV-01](../requirements/functional/14-conversations.md#dec-cv-01), [DEC-CV-03](../requirements/functional/14-conversations.md#dec-cv-03)). Outside the page of its object, in the Message Centre or a notification, a Message shows that object with its icon and name and links to it, opening at the Message ([FR-CV-02](../requirements/functional/14-conversations.md#fr-cv-02)).

### Preview

Screen: [resource-preview](screens/resource-preview.html). Designed on 2026-10-23, to review.

- **The first rows** of the Resource, newest first, in a plain table: the values as they are, `null` shown as such (empty is not zero), a zero that stands out in the signal colour.
- **The Parameters** of the Resource choose which rows: a choice per Parameter above the table, such as the weeks and the lead source. Nothing to type: SQL is for [Query](#query). The partition column is always one of them, marked "Partition", and so is the first cluster column, marked "Cluster": a preview reads only what it shows. In BigQuery a `LIMIT` alone lowers nothing that is read.
- **The Pre-flight** sits next to the Parameters: what the preview scans, and how many partitions it reads ([FR-SR-36](../requirements/functional/04-stacks-and-resources.md#fr-sr-36), [FR-SR-40](../requirements/functional/04-stacks-and-resources.md#fr-sr-40)). Above the approval threshold it asks first ([FR-SR-37](../requirements/functional/04-stacks-and-resources.md#fr-sr-37)).
- **Under the table:** how many rows of how many, what was scanned, and the **Query ID** with a copy button and a link to the Query Log ([FR-LN-06](../requirements/functional/07-log-and-notifications.md#fr-ln-06)).
- **Two ways further,** as tiles under the table: the own question goes to Query, with "Query this resource", or to Claude with the Data Hub connector ([FR-SR-26](../requirements/functional/04-stacks-and-resources.md#fr-sr-26), [FR-CH-03](../requirements/functional/13-channels.md#fr-ch-03)), with a prompt to copy; a regular export goes to the Data Team ([FR-CH-01](../requirements/functional/13-channels.md#fr-ch-01), [FR-CH-02](../requirements/functional/13-channels.md#fr-ch-02)). No download button.

### Queries

Screen: [resource-queries](screens/resource-queries.html). Designed on 2026-10-23, to review ([DEC-UX-19](#dec-ux-19)).

- Every query that ran on the Resource, newest first: when, who, through what (Query, a preview, Claude, a Lens), what it was, what it read, and its Query ID. A blocked query shows its estimate.
- **The SQL** only for whoever ran it and the Data Team, as the Query Log has it ([DEC-LN-01](../requirements/functional/07-log-and-notifications.md#dec-ln-01)); for others the line says so. Who sees the list at all is open ([OP-SR-13](../requirements/functional/04-stacks-and-resources.md#op-sr-13)).
- **On top,** a few numbers: queries in the last 30 days, what they read, how many colleagues, how many filter on the partition column. And the button "Query this resource", which opens [Query](#query) with it.

### A Resource without a Collection

- Only the Data Team sees it. In the panel of Collections, the Data Team has "Without a collection" on top, unfolded like a Collection.
- Its page says that it is in no Collection and that only the Data Team sees it, where it came from, and has the button "Add to a collection" for the Data Team.
- Its Overview shows what exists already: the description from dbt and the maturity. The rest follows once it has an Owner.

### Publishing and confirming

Screen: [resource-publish](screens/resource-publish.html). Designed on 2026-10-24, to review ([DEC-UX-31](#dec-ux-31)). *The sheet to confirm again after a drop is withdrawn on 2026-10-26: a change to the schema no longer lowers the Level ([DEC-UX-64](#dec-ux-64)).*

- **Not published yet:** the status row says so, and a notice says who sees it now, its Owner Unit and the Data Team, and who will once it is published. In the panel it is grey, as every Resource that is not published. For its Owner, "Publish" is the main button of the header.
- **"Publish"** opens a sheet in three parts ([FR-SR-49](../requirements/functional/04-stacks-and-resources.md#fr-sr-49)):
  - **Who will see it:** everyone who sees its Collection, the whole company when the Collection is public ([FR-SR-31](../requirements/functional/04-stacks-and-resources.md#fr-sr-31)).
  - **What Data Hub checked:** that the User may publish it, and that it is Described. When a column has no description, the sheet names the columns, says that descriptions come from dbt, and "Publish and confirm" stays off.
  - **What you confirm,** as publishing is the first confirmation: what the Resource is and what it stands for, its Business Description and its description from dbt, and that every field has one. No figures and no question about its data: a confirmation makes no claim about the data inside it, which the EDA explores ([DEC-MR-07](../requirements/functional/06-maturity-and-release.md#dec-mr-07)).
- **The declaration and its button are one** ([DEC-UX-63](#dec-ux-63)): at the foot of the sheet, the checkbox with the declaration and the button stand together in one bar, the button at its right end. Until the box is ticked, the button is off; ticking it switches the button on and marks the bar. Cancel stands apart, outside the bar.
- At the bottom, both say that Data Hub keeps the confirmation with the fingerprint of that moment, and that it does not expire.

## Page of a Collection

Screens: [collection-overview](screens/collection-overview.html), [collection-edit](screens/collection-edit.html), [collection-add-resources](screens/collection-add-resources.html) and [collection-add-relations](screens/collection-add-relations.html). Designed and approved on 2026-10-23, the relations designed on 2026-10-25 ([DEC-UX-58](#dec-ux-58)); the switch at the bottom right of the overview, for the prototype only, shows it as a Data Admin, the Owner or a colleague.

- **Opens** when a User clicks a Collection in the panel ([DEC-UX-13](#dec-ux-13)). The page holds what the panel cannot: what the Collection is, what needs attention, and the lists in full ([DEC-UX-14](#dec-ux-14)).
- **Head:** the icon, the name and the description of the Collection; a row with the Owner Unit, private or public, the number of Resources and Lenses, and when and by whom it was created.
- **Actions, on the right of the head, per role:**
  - Only who owns the Collection changes it ([DEC-CO-15](../requirements/functional/03-collections.md#dec-co-15)). A colleague sees no actions.
  - "New lens", the primary action, for the Owner Unit and the Data Team ([DEC-CO-18](../requirements/functional/03-collections.md#dec-co-18)). What it opens is not designed yet ([OP-LE-01](../requirements/functional/09-lenses.md#op-le-01)).
  - "Edit", for the Owner Unit and the Data Team, on every Collection ([DEC-CO-18](../requirements/functional/03-collections.md#dec-co-18)).
  - "Add resources", for the Data Admins.
- **Needs attention,** for the Owner Unit and the Data Team, only when there is something: a change since the last Confirmation not marked seen yet, a Level that dropped, open Signals, Resources not published yet. Each line links to where it is solved.
- **Resources:** a table of every Resource the User sees, with the icon of its kind, the Display Name, the Level, the Publication, open Signals and the last change. A Resource that is not published is in a lighter grey. Data Admins have a button to remove a Resource from the Collection.
- **Lenses:** a table of the Lenses its Owner Unit added to the Collection ([DEC-CO-15](../requirements/functional/03-collections.md#dec-co-15)), with the icon of a Lens, the name, the type, what it is built on and its Level: the lowest Level of what it is built on.
- **Recent history:** the latest entries of the Log of the Collection, with a link to all of it. A colleague does not see the entries about Resources that are not published.
- **Editing** happens in place, as for a Resource: the head turns into fields with the edit bar on top. Name, description, Owner Unit (only groups of whoever edits; the Data Team chooses from every group of the domain, [FR-CO-35](../requirements/functional/03-collections.md#fr-co-35)), who sees it (private or public, with what that means), colour and icon. Dissolving is at the bottom, and only possible for an empty Collection.
- **Adding Resources** opens a **sheet** from the right over the page, in two steps, named on top with an arrow between them ([DEC-UX-58](#dec-ux-58)):
  1. **Choose resources:** the Resources without a Collection, searchable, each with its description from dbt, how it came in, and its Level, to tick one or more. A Resource is in one Collection at most, so only those without a Collection appear. The page stays visible behind it. "Next: relations" leads on.
  2. **Relations** ([FR-CO-33](../requirements/functional/03-collections.md#fr-co-33), [FR-CO-34](../requirements/functional/03-collections.md#fr-co-34)): the sheet widens. Per Resource its name and Level, the model it is built on, and how many of its fields have a relation. Under it, on a quiet surface, how it is stored: "Partitioned by" with the column and its unit, "Clustered by" with the columns as chips in their order, and "Partition filter: Required in every query" as a check box. Each says where it came from ("From dbt"); a filter BigQuery requires is checked and locked ("Required by BigQuery"), otherwise the Data Admin can turn it on. Then one line says where the relations come from: the docs of a Colleciónes model, or suggestions from the names of the fields. Then a table of every field: its name and type, its description from dbt; the relation, chosen from "No relation", "Identifies each row" and "Refers to"; and, unless there is none, the Entity identifier as `entity.identifier`, typed or chosen from the identifiers of the Domain Model. Under it, quietly, where it came from ("From the docs", "Suggested from its name") and how many Resources it links to. A field without a relation shows only the choice, greyed. "Show" switches between all fields and only those with a relation, for a model with many. At the foot "Back", what is about to happen, and "Add 2 resources".

## Query

Screen: [query](screens/query.html). Designed on 2026-10-23, to review.

- **A main section of its own,** next to Collections ([DEC-UX-17](#dec-ux-17)): a query can use every Resource the User may see, and later Lenses, not just one.
- **The panel** lists the queries that ran, not the Collections ([DEC-UX-20](#dec-ux-20)): **your own**, grouped by day and searchable. **The Data Team** also has "All": everyone's queries, with who ran them and their SQL ([DEC-LN-01](../requirements/functional/07-log-and-notifications.md#dec-ln-01)). Nobody else sees the queries of others.
- **Each query** in the panel: the icon of what it ran on, a table for Resources and an aperture for a Lens ([DEC-UX-11](#dec-ux-11)); its name; then what it ran on (for a Lens just "Lens", as the name is that of the Lens; for Resources the first, with "+1" for more), when and what it read; and a label for how it ran (a preview, Claude) or whether it was approved or blocked. A click opens it.
- **Resources come in** through the suggestions of the editor, or from "Query" on the page of a Resource.
- **A new query** ([query-new](screens/query-new.html)) is a screen in two halves ([DEC-UX-22](#dec-ux-22)):
  - **Left, your query:** its name, required and suggested from its Resources and the date ([DEC-UX-21](#dec-ux-21)); "What do you want to know?", the question of the query in a sentence; and its Resources, each with its Collection, its partition column and its Level, to remove or add.
  - **Right, what is already made:** the Lenses that use these Resources, only those whose Resources the User may all use ([DEC-CO-16](../requirements/functional/03-collections.md#dec-co-16)). First those on **exactly** these Resources, then those on **these and more**, where the other Resources are shown as dashed chips. Within each group, the Lenses that share most words with the question come first ([DEC-UX-23](#dec-ux-23)); the first is marked "Best match". Each with its name and a sentence on what it shows, the shared words marked in both; its Resources; its tags, the shared ones marked, and how many words it shares; its type, Collection, maker and use this month; its Level; and "Use this lens" as the primary button.
  - **At the bottom right,** "None of these fits?" with "Start your own" as a quiet button: reusing a Lens is the expected way, writing your own the alternative. Your own opens the editor with a template that filters on the partition column.
  - The new query is in the panel at once, as "not run yet".
- **Above the editor:** the name of the query, the sources it uses with their Level, and on the right "New query" and "Make it a lens", the primary button: a query that answers a question that comes back becomes a Lens ([DEC-UX-25](#dec-ux-25)).
- **The editor** writes BigQuery SQL. It **formats** the SQL on request (a button and Shift+Alt+F), and **suggests** as you type: the Resources, their columns and the Parameters, the partition and cluster columns first and marked as such. Parameters are named values such as `@dateFrom`, filled in under the editor.
- **The Pre-flight** is a card next to the editor: the estimate in large, marked "at most" as clustering can make the real read lower; a gauge with the approval and the block threshold ([FR-SR-37](../requirements/functional/04-stacks-and-resources.md#fr-sr-37)); per Resource the partitions it reads and through which column; what to do to read less; and "Run", or "Approve and run" above the approval threshold. A query without a filter on the partition column of a partitioned Resource gets a warning there ([FR-SR-40](../requirements/functional/04-stacks-and-resources.md#fr-sr-40)).
- **The result** under it: the rows, what was read and how many partitions, and the Query ID with a copy button.
- **To build it,** a proposal that holds for React and for Svelte ([OP-UX-10](#op-ux-10)): the editor CodeMirror 6 with its SQL language, a BigQuery dialect on top (backtick names, its functions) and suggestions from the columns Data Hub keeps; formatting with sql-formatter, which knows BigQuery. Both MIT. The Pre-flight as a dry run of BigQuery while typing pauses: it costs nothing and returns the bytes.

## Making a Lens

Screen: [lens-new](screens/lens-new.html). Designed on 2026-10-23, to review. The [walkthrough on Confluence](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1380253717) shows where it sits in the flow from exposure to Lens.

- **From a query.** "Make it a lens" on a query in Query opens this screen, still in the section Query ([DEC-UX-25](#dec-ux-25), [FR-LE-07](../requirements/functional/09-lenses.md#fr-le-07)). The SQL, the Parameters and the Resources of the query come along; "Cancel" goes back to it.
- **Left, the lens:** its name, from the query; its type ([DEC-DH-13](../overview/data-hub.md#dec-dh-13)); the question it answers, from the query; what it shows in a sentence and its tags ([FR-LE-06](../requirements/functional/09-lenses.md#fr-le-06)); what it does step by step, written by Data Hub from the SQL and editable ([FR-LE-03](../requirements/functional/09-lenses.md#fr-le-03)); its Parameters, each with the name Users see, its type, its default, a value or a function such as "today − 3 days", chosen in the same dropdown as on the page of a Lens ([FR-LE-13](../requirements/functional/09-lenses.md#fr-le-13)), and whether Users may change it ([FR-LE-04](../requirements/functional/09-lenses.md#fr-le-04), [DEC-DH-11](../overview/data-hub.md#dec-dh-11)); the Collection it goes into, with its colour bar, chosen from the Collections its author owns: a Lens always goes into one of them, even when its Resources are in other Collections ([DEC-CO-20](../requirements/functional/03-collections.md#dec-co-20)); its Resources and its Level, the lowest of theirs ([DEC-DH-10](../overview/data-hub.md#dec-dh-10)).
- **Right, the size check** ([FR-LE-08](../requirements/functional/09-lenses.md#fr-le-08)): what one run reads, measured now; a gauge with the two thresholds; per Resource the partitions it reads; then the outcome:
  - **Within range:** "Publish lens".
  - **Large:** a warning in the warning colour, what would make it read less, "Publish anyway" and "Back to the query".
  - **Very large:** it waits for the Data Team ([FR-LE-09](../requirements/functional/09-lenses.md#fr-le-09)): an optional word for the Data Team and "Send to the data team".
- **Under it,** that a Lens that later reads more than its range is checked again ([FR-LE-10](../requirements/functional/09-lenses.md#fr-le-10)).
- The prototype shows the three outcomes as scenarios, with a switch at the bottom. It shows an author in the Owner Unit; where the Lens of a colleague outside it goes is open ([OP-LE-04](../requirements/functional/09-lenses.md#op-le-04)), and so is how the rest of the story of a Lens is asked ([OP-LE-01](../requirements/functional/09-lenses.md#op-le-01)).

## Page of a Lens

Screen: [lens](screens/lens.html). Designed on 2026-10-23, to review. Where a Lens runs: its page, under Collections ([DEC-UX-26](#dec-ux-26), [FR-LE-11](../requirements/functional/09-lenses.md#fr-le-11), [DEC-UX-66](#dec-ux-66)). It shows the basic flavour of a Lens, a query with Parameters and a table as its result; other flavours, such as filtered or aggregated, come later ([OP-LE-07](../requirements/functional/09-lenses.md#op-le-07)).

- **The panel** is that of Collections: the Collection of the Lens unfolds, and the Lens is marked as the one that is open, as a Resource is ([FR-CO-19](../requirements/functional/03-collections.md#fr-co-19)). The breadcrumb reads Collections / its Collection.
- **Head:** the icon of a Lens, its name and what it shows in a sentence; a row with its Level, its type, its Collection with the colour bar, who made it and when, and its tags. For its Owner Unit only: "Edit" and "Open in Query", which starts a query from its SQL ([DEC-UX-27](#dec-ux-27)).
- **Two tabs:** Run, where it opens, and About.
- **Run, on top, the request:** its Parameters in a panel that folds open and shut. Folded, it is one line with each Parameter and its value; open, the Parameters stand side by side, each with the name Users see ([DEC-DH-11](../overview/data-hub.md#dec-dh-11)) and a dropdown, filled in with its default. The dropdown of a date offers a date, or a function with the function sign, worked out at every run: today, today minus a number of days, the start of this week, month or year, the end of the last complete week; each with the date it gives today ([FR-LE-13](../requirements/functional/09-lenses.md#fr-le-13)). A list offers its values. A Parameter that is changed is marked, shows its default under it, and "Default" puts that back. In the lower right corner of the panel, folded or not, "Run" with the Pre-flight in the button itself: "Run · 5.1 GB". Above the approval threshold it turns red and reads "Approve and run · 17.9 GB" ([FR-SR-37](../requirements/functional/04-stacks-and-resources.md#fr-sr-37), [DEC-UX-28](#dec-ux-28)); when the table is partitioned, a pop-out on the button then says how many partitions the run reads and which Parameter reads less ([FR-SR-40](../requirements/functional/04-stacks-and-resources.md#fr-sr-40)). The Pre-flight takes no room of its own. Parameters are not added here: that is editing, for the Owner Unit.
- **Run, below it, the result:** a table, with readable column names. Above it when and with which Parameters it ran and "Download CSV", within the row limit ([FR-CH-01](../requirements/functional/13-channels.md#fr-ch-01)); under it what was read and the Query ID with a copy button ([FR-LN-06](../requirements/functional/07-log-and-notifications.md#fr-ln-06)).
- **When a Parameter changes,** the result fades and says it is still for the old values, until the Lens runs again ([FR-LE-12](../requirements/functional/09-lenses.md#fr-le-12)).
- **Before the first run,** the result says so. A Lens does not run by itself when it is opened: every run is a query, with its Pre-flight. A proposal ([OP-LE-06](../requirements/functional/09-lenses.md#op-le-06)).
- **About:** tiles with the question it answers and what it shows; what it does step by step ([FR-LE-03](../requirements/functional/09-lenses.md#fr-le-03)); what it is built on, each Resource with its Collection and Level, and why the Lens has its Level; its Parameters with their type and default; and its history: who made it from which query, and how often it runs.
- **No SQL** on this page, on either tab: a colleague never sees the SQL of a Lens; its Owner Unit sees it when editing ([DEC-UX-27](#dec-ux-27), [FR-LE-14](../requirements/functional/09-lenses.md#fr-le-14)).
- The prototype shows the result up to date, after a change, before the first run and while choosing the value of To, with a switch at the bottom, and the page as the Owner Unit or a colleague.

## Learning

The Learning Centre ([DEC-LR-04](../requirements/functional/16-learning.md#dec-lr-04)). Its philosophy and guiding principles are on [Learning-centre: filosofie en guiding principles](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1381138494) (Confluence, Dutch); this design applies them ([DEC-LR-09](../requirements/functional/16-learning.md#dec-lr-09)). Screens:

- [learning-start](screens/learning-start.html): the start screen with the panel.
- [learning-card](screens/learning-card.html): a Learning Card, in five steps.
- [learning-see](screens/learning-see.html): See it, opened on its own from the context in Data Hub.
- [learning-message](screens/learning-message.html): a Message that carries a Learning Card.
- [learning-float](screens/learning-float.html): a card opened from a pop-out, in a floating window over the page.
- [learning-mcp](screens/learning-mcp.html): the steps of a card in Claude, as an MCP App.
- [learning-hover](screens/learning-hover.html): the marker and its pop-out, on a label, a chip and a button.

Designed on 2026-10-24 and 2026-10-25, to review ([DEC-UX-38](#dec-ux-38) to [DEC-UX-57](#dec-ux-57), [Learning](../requirements/functional/16-learning.md)).

- **In the rail,** the learning centre sits at the bottom, just above the account, with a graduation cap; it is not a main item ([DEC-UX-52](#dec-ux-52)).
- **The panel is the index of every Learning Card** ([FR-LR-03](../requirements/functional/16-learning.md#fr-lr-03)):
  - On top the title, search, and one silent count: "You have seen 14 of 113 cards" ([DEC-UX-51](#dec-ux-51), [FR-LR-32](../requirements/functional/16-learning.md#fr-lr-32)).
  - Then the Compass, then the four Learning Levels from easy to advanced, each a card in the tree, as a Collection is: its name with its step, the icon of its audience ([DEC-UX-62](#dec-ux-62)), how many of its cards the User has seen, and an arrow to unfold it.
  - Unfolded, it lists its sections, each with its number, name and how many of its cards the User has seen, and under each its cards: the icon of their kind (a book for a Learning Card, a compass for a card of the Compass, a chart for a Reading Card), the number and the name on one line, and a check when the User said "I understand it".
  - The card that is open is in medium weight and the darkest colour; opening a card unfolds its Learning Level.
  - A Learning Level gets no colour: colour stays on content. Its icon tells the audience: a person for 1 · User (`user`), a person in focus for 2 · Data-aware user (`user-focus`), a scatter chart for 3 · Data analyst (`chart-scatter`), a person with a gear for 4 · Data owner and expert (`user-gear`), from Phosphor, as everywhere. The step is in the name.
- **The page of a Learning Card, in five steps** ([DEC-UX-45](#dec-ux-45), [DEC-UX-48](#dec-ux-48), [FR-LR-27](../requirements/functional/16-learning.md#fr-lr-27)): light, one thing at a time, over the whole width of the page.
  - On top, the way to it (learning centre, Learning Level, section); the number and title; and "I understand it", the only button that is always there ([FR-LR-28](../requirements/functional/16-learning.md#fr-lr-28)). Marked, it becomes a quiet "Understood" with a check; a click undoes it. There are no labels.
  - Under the title, the five steps in a row, an arrow between each: a numbered circle and a name. The current step has a filled circle and medium weight; a step before it has a check. A click opens a step.
  - Next to the steps, the depth: "Quick" or "Full". On the quick path See it and Check your understanding are muted in the row, and can still be opened.
  - **Why now:** the sentence of a colleague, large, then the situation, and "In this card: …".
  - **Core idea:** the decision rule, large; the metaphor; the one example.
  - **See it:** the example as a chart, its relevant part highlighted and the rest faded, with "Look at …" and "You see …" beside it. A quiet link plays the video, if the card has one ([OP-LR-20](../requirements/functional/16-learning.md#op-lr-20)). It is the same page as See it opened from context.
  - **Check your understanding:** one question per screen ([FR-LR-30](../requirements/functional/16-learning.md#fr-lr-30)). The answers are buttons; a click reveals the answer and why. "Another question" follows, and nothing is counted. A try-it question names what to open, with a link to it, and asks what the User saw.
  - **You can now** ([DEC-UX-49](#dec-ux-49), [FR-LR-31](../requirements/functional/16-learning.md#fr-lr-31)): what the User can now do, large; "What it brings you"; and "Where to next", two or three choices as tiles: deeper, a neighbouring concept, and "Just apply it". At the foot, quiet: "Share in a message", "Messages" with their number, and the source. A small drawing of two overlapping circles stands beside the first field, while it is open ([OP-LR-21](../requirements/functional/16-learning.md#op-lr-21)).
  - **"Next", always in the same place:** a bar at the foot of the page, held to the bottom of the window: "Next: " with the name of the next step and one sentence on what it brings; the button on the right. It never waits for an answer. On the quick path, "Next" on Core idea leads to You can now. You can now has no "Next", only its choices.
- **See it on its own** ([DEC-UX-50](#dec-ux-50), [FR-LR-29](../requirements/functional/16-learning.md#fr-lr-29)): "See it" on an item of a pop-out opens See it as a page of its own in the learning centre: the way to it, "See it" with the title of the card, the example with "Look at …" and "You see …", and two ways on: back to where the User came from, and "Open the whole card".
- **In a Message** ([DEC-UX-41](#dec-ux-41), [FR-LR-07](../requirements/functional/16-learning.md#fr-lr-07)): "Add a learning card" next to the field of a new Message finds a card by its words. In the Message it shows as a small card: the book, its number and title, its Learning Level, and "Understood" when the reader marked it ([OP-LR-04](../requirements/functional/16-learning.md#op-lr-04)). A click opens the card.
- **Messages on a card** ([FR-LR-06](../requirements/functional/16-learning.md#fr-lr-06)): "Messages" opens the slide-in, as on every object; a card takes a Question or a Remark, which go to the Data Team.
- **A card wherever it helps** ([DEC-UX-56](#dec-ux-56), [DEC-UX-57](#dec-ux-57), [FR-LR-35](../requirements/functional/16-learning.md#fr-lr-35), [FR-LR-36](../requirements/functional/16-learning.md#fr-lr-36)):
  - **Only system text:** a button, a label, a chip or a status Data Hub writes itself can carry the marker; text that Users provide never does. On the page of a Resource, for example, its Level, its grain and "Mark as seen". A name, such as `creditLead`, always carries one, with at least its own card ([DEC-UX-59](#dec-ux-59), [FR-LR-37](../requirements/functional/16-learning.md#fr-lr-37)).
  - **The marker:** ⓘ (U+24D8, circled small i) right after the text ([OP-UX-22](#op-ux-22)), a Unicode character in the colour of its text, at about three quarters of its size and slightly raised, from a symbol font, as Poppins has none. No underline and no colour. Hovering the text tints it lightly, so its extent shows.
  - **A one-second hold:** the pop-out opens only when the pointer rests on the text for a second, so passing over the page opens nothing. Keyboard focus opens it at once.
  - **A text bubble:** the pop-out hangs under the text, or above it near the foot of the window, and its arrow points at the marker. On its head, quietly, how many cards explain the text: "Explained in 3 learning cards".
  - **An item per card,** each a tile of its own: the book, the number and title of the card, and "See it" on the right, on every item; the gain of the card, what knowing it brings, the same sentence wherever the card appears; and in grey whether and when the User saw it, with an eye for seen and a check for understood. At the foot, "Open the learning centre".
  - It stays open while the pointer is on it, and closes when the pointer leaves, on Escape or on scrolling. On a touch screen a tap on the marker opens it. A button keeps its own action; only its marker opens the pop-out when tapped.
  - **A click on an item** opens the card in a floating window over the page, as a Message opens in context ([DEC-UX-30](#dec-ux-30)); the User stays where they are. The text stays tinted while its card is open.
  - The window has on its head the graduation cap, "Learning card", the number and title, fold and close. Its body holds the same five steps as the page ([DEC-UX-47](#dec-ux-47)): the numbered circles with the name of the current step, and "I understand it" next to them, then the step.
  - At its foot the bar with "Next", and "Open in the learning centre", which opens the full page of the card.
- **The steps stand alone** ([DEC-UX-47](#dec-ux-47), [DEC-LR-08](../requirements/functional/16-learning.md#dec-lr-08)): each step is a block that needs nothing around it. In Claude an MCP App shows them with only the number and title of the card above, its five steps, and "Next" at the foot, with "Open in Data Hub" ([FR-LR-26](../requirements/functional/16-learning.md#fr-lr-26)).
- **No game** ([DEC-LR-09](../requirements/functional/16-learning.md#dec-lr-09)): no score, badge, rank, weekly goal, streak, team progress or note of success, and no red dot; only the silent count of the cards seen. This replaces the game elements of [DEC-UX-43](#dec-ux-43).

## Messages

Screens: [messages](screens/messages.html), the Message Centre; and the Messages on an object in a slide-in, on [a Collection](screens/collection-messages.html), [a Resource](screens/resource-messages.html) and [a Lens](screens/lens-messages.html); and a Message opened in context, [a Question on a Lens](screens/lens-context.html) and [a Request on a Lens to accept](screens/lens-new-context.html). Designed on 2026-10-23, to review ([DEC-UX-29](#dec-ux-29), [DEC-UX-30](#dec-ux-30)).

- **What a Message is:** a Question, Remark, Signal or Request on an object, or a reply, to enrich the data and inform colleagues. Never private, never a chat with a person; it is about a whole object, never a part of it ([DEC-CV-04](../requirements/functional/14-conversations.md#dec-cv-04), [DEC-CV-05](../requirements/functional/14-conversations.md#dec-cv-05)).
- **The Message Centre** is in the rail, under the main items, with the number unread on its icon. Its panel filters: For you, the default; Unread; Written by you; Everything you may see; then by kind, Questions, Remarks, Signals, Requests and what Data Hub tells you; and by the kind of object, Collections, Resources, Lenses, Queries ([FR-CV-06](../requirements/functional/14-conversations.md#fr-cv-06)).
- **Its list:** each Message with its object (the icon of its kind, the kind, the name and its Collection), its kind and its state (open, answered), who and when, and its first lines; a dot when it is unread, the number of replies. Chips on top: all, open, answered.
- **The Message opened** shows on the right: its object with "Open in context"; the Message with its replies; a field to reply, with who gets a notification. In the prototype the Request and the Question on a Lens open there.
- **Open in context** opens the page of the object as it is, with the Message in a floating window in the lower right ([DEC-UX-30](#dec-ux-30), [FR-CV-09](../requirements/functional/14-conversations.md#fr-cv-09)). The window has the kind of Message and its object on top; the Message with its replies; the field to reply and who gets a notification, or for a Request the reason, "Refuse" and "Accept" for the Data Team; at the bottom "All messages on this …", which opens the slide-in, and the way back to the Message Centre. The page behind stays usable: the User reads the result of a Lens or the size check of a Lens to accept while answering. The link in a notification opens the same way.
- **On every object,** a Collection, a Resource or a Lens, "Messages" with their number in the header opens the slide-in: on top a new Message, with its kind and who gets a notification; chips by kind; the Messages on this object with their replies; at the bottom that everyone who may see the object sees them, and the way to the Message Centre ([FR-CV-07](../requirements/functional/14-conversations.md#fr-cv-07)). On a Resource, "Ask a question" opens the same slide-in with Question chosen.
- **A Collection** takes a Question or a Remark; a Resource and a Lens also a Signal. The Messages on the Resources and Lenses of a Collection stay on those.
- **A changed description in dbt** is told to the Owner by Data Hub, in one Message per Resource and run ([FR-RC-17](../requirements/functional/05-resource-card.md#fr-rc-17)). Opened, it lists every description that changed, the table or a field, with its text before and after, and the Business Description next to it, or that there is none. It asks for nothing: no review, no answer. "Edit business descriptions" opens the Columns tab in editing, with the changed fields marked.
- **A changed field** since the last Confirmation is told to the Owner the same way, by Data Hub, with what changed; the warning on the Resource is where it is marked seen ([FR-MR-12](../requirements/functional/06-maturity-and-release.md#fr-mr-12)).
- **A Request** asks the Data Team for a decision on its object; the first is accepting a very large Lens, sent with "Send to the data team" when it is made ([DEC-CV-06](../requirements/functional/14-conversations.md#dec-cv-06), [FR-CV-08](../requirements/functional/14-conversations.md#fr-cv-08)). Opened, it shows what it asks to decide on, such as what one run reads, its range, the partitions and what a default would read. The Data Team has a field for its reason, "Refuse" and "Accept"; its author sees that it waits, and that only they see the Lens until then. The state shows in the list: waiting, accepted, refused.

## A link to something you may not see

Screen: [not-found](screens/not-found.html). Designed on 2026-10-24, to review ([DEC-UX-32](#dec-ux-32)).

- **One page** for a link to something that does not exist and to something the User may not see: a private Collection of another Owner Unit, a Resource that is not published, a Lens on a Resource they may not use, a query of someone else ([FR-CO-32](../requirements/functional/03-collections.md#fr-co-32)). It does not say which of the two it is: a private Collection does not exist for whoever is not in its Owner Unit ([FR-CO-17](../requirements/functional/03-collections.md#fr-co-17)).
- **It says what to do:** ask whoever sent the link, as its owner decides who sees it; or search what the User may see. Then the way to Collections and Lenses.
- **No "Ask for access":** it would tell that the object exists. Whether a User can ask for access, and how, is open ([OP-CO-13](../requirements/functional/03-collections.md#op-co-13)).

## Sign in

Screen: [sign-in](screens/sign-in.html). Designed on 2026-10-24, to review ([DEC-UX-35](#dec-ux-35)).

- **A photo of the set, as it is,** fills the screen, placed on its focus point ([DEC-UX-36](#dec-ux-36)). It moves very slowly, as every background.
- **The sign-in sits on a glass card** that blurs what lies behind it: the mark and "Data Hub", "Sign in", one sentence on what Data Hub is, and "Sign in with Google", the only way in ([FR-UM-01](../requirements/functional/02-user-management.md#fr-um-01)). Under the button: it takes the Immoscoop account, and Data Hub keeps no password of its own ([FR-UM-03](../requirements/functional/02-user-management.md#fr-um-03)).
- **The story of the photo** in the lower left, on glass too: its title, a few lines and who took it.
- **An account of another domain is refused** ([FR-UM-02](../requirements/functional/02-user-management.md#fr-um-02)): the card says which account was refused and to sign in with the account of work, and the button reads "Sign in with another account".
- It follows the theme of the system, as the User is not known yet, and shows a photo of the set of that theme. The light set has two photos so far, Alpenglow and Spring snow, which a switch in the prototype shows; the dark set has one, Lights on.
- Where a browser cannot blur, the card is nearly opaque.

## Sheets

- A **sheet** slides in from the right over the page, for a task that belongs to the page but is not the page, such as adding Resources to a Collection. The page stays visible behind it, dimmed; a click beside it or "Close" closes it.

## Floating window

- A **floating window** sits over a page for something done while the page stays in view, such as answering a Message in context ([DEC-UX-30](#dec-ux-30)). Unlike a sheet, it does not dim the page, which stays usable behind it.
- It opens in the lower right. Its head moves it; "Fold" shrinks it to its head, and closing it goes back to where it was opened from.

## Background and motion

- Motion in the background is **very slow** (`--background-cycle`), felt rather than seen.
- Only in the background: reading surfaces never move.
- **"Reduce motion"** in the system turns all animation off. A switch of the User can do so too; where it lives is open ([OP-UX-13](#op-ux-13)).
- Light for the computer: CSS, no video.
- An alternative we tried: three blurred blobs of colour that move slowly. The gradient is the current choice.
- **A picture** can take the place of the gradient ([DEC-UX-34](#dec-ux-34)): the painted counterpart of a photo of the set, a watercolour made from the photo itself, so that it blends into the colours of the app ([DEC-UX-37](#dec-ux-37)). It drifts as slowly as the gradient. The frames then blur it lightly, so that it never competes with the text. The photos are in `backgrounds/photos/`, their paintings in `backgrounds/painted/`: Alpenglow and Spring snow, and the ski lift, the first painting, whose photo is not in the set; for the dark theme, Lights on. Any screen shows one with `?bg=alpenglow`, `?bg=spring` or `?bg=ski` in its address, such as `lens.html?bg=alpenglow`; in the dark theme it shows Lights on.
- **Each theme has pictures of its own** ([DEC-UX-36](#dec-ux-36)): a photo is never darkened for the dark theme. The dark set has one photo so far, Lights on: a blue-hour photo from Max, made into a night picture with the lights of the village on, at the request of Max. Its painting keeps the lights as warm dabs of bare paper. Until there are more, the dark theme shows it, whatever the light theme shows. Who chooses the background, and how, is open ([OP-UX-20](#op-ux-20)).

## Decisions

All decided on 2026-10-22, in the design session.

- <a id="dec-ux-01"></a>**DEC-UX-01** · No Figma for Data Hub: an internal tool, the design lives in code next to the requirements.
- <a id="dec-ux-02"></a>**DEC-UX-02** · Navigation on the left with a slide-out panel, instead of navigation at the top.
- <a id="dec-ux-03"></a>**DEC-UX-03** · Each section opens on a start screen; the panel is the index. No separate overview screen that repeats the panel.
- <a id="dec-ux-04"></a>**DEC-UX-04** · The "Promoted" feature on the start screen is not built yet.
- <a id="dec-ux-05"></a>**DEC-UX-05** · Background: a gradient of three colours instead of blobs of colour. *Note of 2026-10-24: a picture can take its place ([DEC-UX-34](#dec-ux-34)).*

Decided on 2026-10-22, in the review of the detail page of a Resource against its requirements:

- <a id="dec-ux-06"></a>**DEC-UX-06** · A Resource has no icon of its own. Icons are for the interface and for Collections. *Note of 2026-10-22: the icon of its kind in a list is interface ([DEC-UX-11](#dec-ux-11)).*
- <a id="dec-ux-07"></a>**DEC-UX-07** · The detail page of a Resource does not show its freshness.
- <a id="dec-ux-08"></a>**DEC-UX-08** · "Ask a question" on a Resource starts a Question in its Conversations; it does not open a chat with Claude. *Note of 2026-10-23: it opens the Messages of the Resource in a slide-in, with Question chosen ([DEC-UX-29](#dec-ux-29)).*
- <a id="dec-ux-09"></a>**DEC-UX-09** · The Owner and the Data Team edit what Data Hub keeps about a Resource in place, on its Overview. What comes from dbt is shown next to it, read-only.

Decided on 2026-10-22, after a tryout of the panel:

- <a id="dec-ux-10"></a>**DEC-UX-10** · One panel for Collections and what they hold: a Collection unfolds in place in the list of Collections, so switching Collection is one click. This replaces the second panel with the Resources of one Collection and an arrow back.
- <a id="dec-ux-11"></a>**DEC-UX-11** · In a list, every item has the icon of its kind, the same for every item of that kind: a table for a Resource. It tells the kinds apart once Lenses and Reports join; it is not an icon of the item itself ([DEC-UX-06](#dec-ux-06)).
- <a id="dec-ux-12"></a>**DEC-UX-12** · A Resource that is not published is shown in a lighter grey, without the struck-through eye.

Decided on 2026-10-23, with the page of a Collection and the icon of a Collection:

- <a id="dec-ux-13"></a>**DEC-UX-13** · Clicking a Collection in the panel opens its page and unfolds it; the arrow next to it only folds and unfolds. This answers [OP-UX-14](#op-ux-14).
- <a id="dec-ux-14"></a>**DEC-UX-14** · From the page of a Collection, a User gets an overview of its Resources and its Lenses, creates a Lens, and edits the details of the Collection; a Data Admin also adds Resources. *Note of 2026-10-23: only who owns the Collection creates Lenses in it and edits it ([DEC-CO-15](../requirements/functional/03-collections.md#dec-co-15)).* *Approved on 2026-10-23, as designed in [collection-overview](screens/collection-overview.html).*
- <a id="dec-ux-15"></a>**DEC-UX-15** · The icon of a Collection is grey, without a circle; the colour of the Collection is a thin bar on the left edge of its card, and of the head of its page. Variant E of the exploration; this answers [OP-UX-16](#op-ux-16).
- <a id="dec-ux-16"></a>**DEC-UX-16** · "Without a collection" is not a Collection, so it never gets the colour bar of one. It is shown in an urgent red, because it waits for the Data Team and asks to be solved quickly. This answers [OP-UX-17](#op-ux-17).

Decided on 2026-10-23, with the preview and the query of a Resource:

- <a id="dec-ux-17"></a>**DEC-UX-17** · Query is a main section of its own, next to Collections, and not a tab of a Resource: a query goes over Resources, and later Lenses. This answers [OP-SR-11](../requirements/functional/04-stacks-and-resources.md#op-sr-11).
- <a id="dec-ux-18"></a>**DEC-UX-18** · Your own queries are not on the page: they slide in as a sheet. *Note of 2026-10-23: replaced by [DEC-UX-20](#dec-ux-20): they are the panel of Query.*
- <a id="dec-ux-19"></a>**DEC-UX-19** · The page of a Resource has a history of the queries that ran on it, in a tab "Queries".
- <a id="dec-ux-20"></a>**DEC-UX-20** · The panel of Query lists the queries that ran, not the Collections: your own by default, everyone's on request. This replaces [DEC-UX-18](#dec-ux-18). *Decided on 2026-10-23: everyone's, under "All", is for the Data Team only, as the Query Log has it ([DEC-LN-01](../requirements/functional/07-log-and-notifications.md#dec-ln-01)).*
- <a id="dec-ux-21"></a>**DEC-UX-21** · Every query has a name, given as the first step of a new query and suggested from where it starts; a query on a Lens bears the name of the Lens. In the panel, the icon of a query shows whether it ran on Resources or on a Lens. The page of a Resource has a button "Query" that starts a new query on it, its name already filled in.
- <a id="dec-ux-22"></a>**DEC-UX-22** · A new query shows, next to its name and Resources, the Lenses that already use these Resources: first those on exactly these, then those on these and more. Reusing a Lens is the first choice, "Start your own" the alternative, to prevent double work. The SQL is not on this screen.
- <a id="dec-ux-23"></a>**DEC-UX-23** · The Lenses suggested to a new query match on more than the Resources: on the words its question shares with their name, description and tags, common words left out, and the shared words are marked. No other names are suggested for the query than the one from its Resources and the date.
- <a id="dec-ux-24"></a>**DEC-UX-24** · A Lens shows no weight, light or heavy: whoever asks for data wants the answer, and a label does not stop them. What a query reads is shown in its Pre-flight. [FR-LE-02](../requirements/functional/09-lenses.md#fr-le-02) is withdrawn. Its size is checked once, for its author, when it is made ([FR-LE-08](../requirements/functional/09-lenses.md#fr-le-08)).
- <a id="dec-ux-25"></a>**DEC-UX-25** · "Make it a lens" is a button on a query in Query. It opens a screen with the Lens on the left, filled in from the query, and its size check on the right, which decides how it is published: at once, after a warning, or once the Data Team accepts it.
- <a id="dec-ux-26"></a>**DEC-UX-26** · A Lens runs on a page of its own in the section Lenses, with two tabs. Run: the request on top, its Parameters in a panel that folds open and shut, the Pre-flight and "Run"; below it the result, a table. About: what it answers, what it does, what it is built on, its Parameters and its history. This is the basic flavour, a query with Parameters and a table. *Note of 2026-10-26: the page of a Lens sits under Collections; there is no section Lenses ([DEC-UX-66](#dec-ux-66)).*
- <a id="dec-ux-27"></a>**DEC-UX-27** · The page of a Lens shows no SQL and adds no Parameters. A colleague never sees the SQL of a Lens; its Owner Unit sees it, and adds Parameters, when editing. "Open in Query" is for the Owner Unit only.
- <a id="dec-ux-28"></a>**DEC-UX-28** · On the page of a Lens the Pre-flight is in the "Run" button, in the lower right corner of the Parameters, with what the run reads; it takes no room of its own. Above the approval threshold the button turns red and asks to approve, and when the table is partitioned a pop-out on the button says how to read less.
- <a id="dec-ux-29"></a>**DEC-UX-29** · Messages have a Message Centre of their own, in the rail with the number unread, and every object with Messages, a Collection, a Resource or a Lens, opens its own Messages in a slide-in, which is the Message Centre filtered on that object, with a field to start one.
- <a id="dec-ux-30"></a>**DEC-UX-30** · "Open in context" on a Message opens the page of its object with the Message in a floating window over it, which does not dim the page, so that the User answers with the object in view. It replaces "Open the …" in the Message Centre. The floating window shows one Message; the slide-in of [DEC-UX-29](#dec-ux-29) all Messages on an object.
- <a id="dec-ux-31"></a>**DEC-UX-31** · Publishing and confirming a Resource happen in a sheet over its page. "Publish" is the first time, from Described, and is also the first confirmation; "Reconfirm" after a drop opens the same sheet as "Confirm again". The sheet says who will see the Resource and what Data Hub checked, and asks for the confirmation: the figures it was checked with, since when the data is reliable, and the declaration. *Note of 2026-10-26: the control figures and since when the data is reliable are left out of the sheet ([DEC-MR-07](../requirements/functional/06-maturity-and-release.md#dec-mr-07)), and the declaration moves next to its button ([DEC-UX-63](#dec-ux-63)).* *Note of 2026-10-26: "Reconfirm" and confirming again after a drop are withdrawn ([DEC-UX-64](#dec-ux-64)); only "Publish" opens the sheet.*
- <a id="dec-ux-32"></a>**DEC-UX-32** · A link to something the User may not see opens the same page as a link to something that does not exist, without saying which of the two it is, and with what to do instead. It has no "Ask for access".
- <a id="dec-ux-33"></a>**DEC-UX-33** · The section Lenses opens on a start screen: an intro, a search that finds Lenses by the words of a question, the Lenses of the User and their Owner Unit, and Lenses to discover, popular or new. Its panel holds the Lenses by Collection, as [OP-UX-18](#op-ux-18) proposes. *Note of 2026-10-26: withdrawn with the section Lenses; its parts moved to the start screen of Collections ([DEC-UX-66](#dec-ux-66)).*
- <a id="dec-ux-34"></a>**DEC-UX-34** · A picture can be the background, in place of the gradient: the painted counterpart of a photo ([DEC-UX-37](#dec-ux-37)), drifting as slowly. With a picture, the frames blur what is behind them lightly. The dark theme takes a picture of its own ([DEC-UX-36](#dec-ux-36)). The first pictures are ski slopes.
- <a id="dec-ux-35"></a>**DEC-UX-35** · Signing in shows a photo of the set as it is, with the sign-in on a glass card that blurs what lies behind it: the mark and the name, "Sign in", one sentence and "Sign in with Google". In a corner, on glass too, the story of the photo. A refused account is named on the card, with the button to try another.
- <a id="dec-ux-36"></a>**DEC-UX-36** · The pictures come as sets, each photo with its story: a title, a few lines and who took it. Max provides the photos and writes the stories. The light theme and the dark theme each have a set of their own: a photo is never darkened for the dark theme. Until the dark set has a photo, the dark theme keeps its gradient. *Note of 2026-10-24: the dark set has its first photo, a blue-hour photo from Max made into a night picture with its lights on, at the request of Max.*
- <a id="dec-ux-37"></a>**DEC-UX-37** · Each photo of a set has a painted counterpart, a watercolour made from the photo itself: the photo as it is for signing in, the painting for the background of the app. Both carry the same story. The dark set works the same way: its own photos, painted, never darkened ones.
- <a id="dec-ux-38"></a>**DEC-UX-38** · Learning is a main section, under Reports in the rail, with a start screen and a panel that is the index of every Learning Card: the Compass first, then the four Learning Levels from easy to advanced, each unfolding to its sections and their cards. The panel shows how many cards the User understood, per Learning Level and per section, and per card whether they did. *Designed on 2026-10-24, at the request of Max, to review.* *Note of 2026-10-24: the section is called the learning centre ([DEC-LR-04](../requirements/functional/16-learning.md#dec-lr-04)).* *Note of 2026-10-25: the panel counts the cards seen, not understood, and its progress card makes way for one silent count ([DEC-UX-51](#dec-ux-51)).* *Note of 2026-10-25: the learning centre leaves the main items, and sits at the bottom of the rail next to the account ([DEC-UX-52](#dec-ux-52)).*
- <a id="dec-ux-39"></a>**DEC-UX-39** · In the interface a Learning Level is named by its audience with its step, "1 · User" to "4 · Data owner and expert", with a mark of four short bars from easy to advanced. The word "Level" alone stays for the maturity of a Resource, Lens or Report, and a Learning Level gets no colour of its own. *Designed on 2026-10-24, to review.* *Note of 2026-10-26: the mark of four bars is replaced by an icon per Learning Level, as it looked like the maturity icon ([DEC-UX-62](#dec-ux-62)).*
- <a id="dec-ux-40"></a>**DEC-UX-40** · The page of a Learning Card reads as one column: what you will be able to do, the article with its graphics, the common mistake, the examples, the video, then the questions to check yourself. What comes before and after is beside it. "Mark as understood" is the main button of its header. *Designed on 2026-10-24, to review.* *Note of 2026-10-25: replaced by [DEC-UX-45](#dec-ux-45): the card is worked through in steps, and what comes before and after moved to Congrats.*
- <a id="dec-ux-41"></a>**DEC-UX-41** · A Message can carry a Learning Card, which shows in it as a small card with whether the reader understood it. A Learning Card has Messages of its own, like every object. *Designed on 2026-10-24, to review.*
- <a id="dec-ux-42"></a>**DEC-UX-42** · A link to a Learning Card stands inline in a text, underlined in teal with a small graduation cap. A click opens the card in a floating window over the page, as a Message in context ([DEC-UX-30](#dec-ux-30)), with "Mark as understood" and "Open in the learning centre". *Designed on 2026-10-24, at the request of Max, to review.* *Note of 2026-10-25: the window shows the steps of the card ([DEC-UX-47](#dec-ux-47)), and the button is "I understand it" ([DEC-UX-48](#dec-ux-48)).* *Note of 2026-10-25: the teal underline and the graduation cap make way for a marker and a pop-out ([DEC-UX-54](#dec-ux-54), [DEC-UX-55](#dec-ux-55)); the floating window stays.*
- <a id="dec-ux-43"></a>**DEC-UX-43** · The game elements of the learning centre are calm. They are progress, a Rank per Learning Level, a Weekly Goal as a ring, a Streak in weeks, Badges as round line marks in teal, Quests and team progress without names. A success is a quiet note in the lower left. There are no points, no ranking of colleagues and no confetti. *Designed on 2026-10-24, at the request of Max, to review.* *Note of 2026-10-25: withdrawn: no scores, badges, rankings or deadlines, only a silent count of the cards seen ([DEC-LR-09](../requirements/functional/16-learning.md#dec-lr-09), [DEC-UX-51](#dec-ux-51)).*
- <a id="dec-ux-44"></a>**DEC-UX-44** · Every User has a Learning Profile, opened from the progress card at the top of the panel of the learning centre and from its start screen. *Designed on 2026-10-24, to review.* *Note of 2026-10-25: withdrawn with the Learning Profile ([FR-LR-18](../requirements/functional/16-learning.md#fr-lr-18)).*
- <a id="dec-ux-45"></a>**DEC-UX-45** · The page of a Learning Card shows one step at a time, with the four steps in a row above it and an arrow between each. Its header holds only the title and "Mark as understood"; there are no labels. Every step ends with "Next" in a bar held to the foot of the window, always in the same place, saying what comes next and how this step helps there. *Designed on 2026-10-25, at the request of Max, to review.* *Note of 2026-10-25: five steps, with a quick and a full path; the button is "I understand it"; "Next" never waits for an answer, and the last step offers choices instead ([DEC-UX-48](#dec-ux-48), [DEC-UX-49](#dec-ux-49)).*
- <a id="dec-ux-46"></a>**DEC-UX-46** · Congrats is where a card celebrates: a drawing of two overlapping circles with a check, the Knowledge Matrix with the card in it, related subjects and next topics. The drawing moves once, only when motion is allowed, and there is no confetti. *Designed on 2026-10-25, at the request of Max, to review.* *Note of 2026-10-25: replaced by [DEC-UX-49](#dec-ux-49): the last step is You can now, without the Knowledge Matrix. Whether the drawing stays is open ([OP-LR-21](../requirements/functional/16-learning.md#op-lr-21)).*
- <a id="dec-ux-47"></a>**DEC-UX-47** · Each step of a Learning Card is a block that stands alone, so the page, the floating window and the MCP App in Claude show the same steps; only what is around them differs. *Designed on 2026-10-25, at the request of Max, to review.*
- <a id="dec-ux-48"></a>**DEC-UX-48** · A Learning Card has its five steps in the row above it, Why now to You can now, with a switch between the quick and the full path next to them; on the quick path the two middle steps are muted, not hidden. The page uses its whole width. "I understand it" is the only button of the header. "Next" never waits for an answer. *Designed on 2026-10-25, from the principles page, to review.*
- <a id="dec-ux-49"></a>**DEC-UX-49** · You can now has three parts: what the User can now do, large; what it brings them; and two or three choices as tiles: deeper, a neighbouring concept, and "Just apply it". It has no score, no badge and no single next card. *Designed on 2026-10-25, from the principles page, to review.*
- <a id="dec-ux-50"></a>**DEC-UX-50** · See it is a page of its own: the third step of a card, and reachable from a context link, such as "See it" with an eye next to a pitfall on a Resource. On its own it shows the example, "Look at …" and "You see …", the way back and the whole card. *Designed on 2026-10-25, from the principles page, to review.* *Note of 2026-10-25: from context, it opens from a row of the pop-out ([DEC-UX-55](#dec-ux-55)).*
- <a id="dec-ux-51"></a>**DEC-UX-51** · The learning centre shows one silent count: the cards a User has seen, on top of the panel and per Learning Level and section. No ring, no streak, no badge, no red dot. *Designed on 2026-10-25, from the principles page, to review.*
- <a id="dec-ux-52"></a>**DEC-UX-52** · The learning centre sits at the bottom of the rail, just above the account, not among the main items. *Decided on 2026-10-25, at the request of Max; this answers [OP-UX-21](#op-ux-21).*
- <a id="dec-ux-53"></a>**DEC-UX-53** · The rail has no button for settings. *Decided on 2026-10-25, at the request of Max.*
- <a id="dec-ux-54"></a>**DEC-UX-54** · What the learning centre explains carries a small marker right after it, ⓘ in the colour of its text, on a phrase or on a button. It is the only sign: no underline, no colour. *Designed on 2026-10-25, at the request of Max, to review; the character is open ([OP-UX-22](#op-ux-22)).* *Note of 2026-10-25: only on system text ([DEC-UX-56](#dec-ux-56)).* *Note of 2026-10-25: the character is decided, ⓘ ([OP-UX-22](#op-ux-22)).*
- <a id="dec-ux-55"></a>**DEC-UX-55** · Hovering or focusing a marked phrase or button opens a pop-out with one or more cards: for each, why or how it helps the User here, its number and title, and whether and when the User saw it. A card opens in the floating window, See it on its own. *Designed on 2026-10-25, at the request of Max, to review.* *Note of 2026-10-25: replaced by [DEC-UX-57](#dec-ux-57), after the review by Max.*
- <a id="dec-ux-56"></a>**DEC-UX-56** · Only system text carries the marker: a button, a label, a chip or a status. Text that Users provide never does. *Decided on 2026-10-25, at the request of Max.*
- <a id="dec-ux-57"></a>**DEC-UX-57** · The pop-out is a text bubble whose arrow points at its marker, and opens after the pointer rests on the text for a second. It says how many cards explain the text, and shows each as a tile: number and title, "See it" on every item, the gain of the card, and whether and when the User saw it. A click on an item opens the card in the floating window over the page. This replaces [DEC-UX-55](#dec-ux-55). *Designed on 2026-10-25, at the request of Max, to review.*
- <a id="dec-ux-58"></a>**DEC-UX-58** · Adding Resources is a sheet in two steps: choose the Resources, then the relation of every field. The second step lists the fields of each Resource with a choice of "No relation", "Identifies each row" or "Refers to", and the Entity identifier, filled in from the docs of a Colleciónes model or suggested from the name of the field, and says how many Resources each reference links to. *Designed on 2026-10-25, at the request of Max, to review.* *Note of 2026-10-25: the second step also shows how each Resource is stored, its partition column, cluster columns and whether a partition filter is required, derived from dbt and set by the Data Admin ([FR-CO-34](../requirements/functional/03-collections.md#fr-co-34)).*
- <a id="dec-ux-59"></a>**DEC-UX-59** · A name on a screen, such as `creditLead` or `visitorId`, carries the marker ⓘ like other system text, and its pop-out lists at least its own Learning Card, a minimal one if need be ([FR-LR-37](../requirements/functional/16-learning.md#fr-lr-37)). *Decided on 2026-10-25, by Max; not designed in the prototypes yet.*
- <a id="dec-ux-60"></a>**DEC-UX-60** · The Collection palette lives in one configuration file, to which colours are added over time, each with its name and its value for the light and the dark theme. It starts with the colours there are now: the six of this design, and the nine of the muted palette that existing Collections use. It is tuned after testing on uat. *Decided on 2026-10-25, by Max ([OP-UX-05](#op-ux-05), [OP-UX-08](#op-ux-08)).*
- <a id="dec-ux-61"></a>**DEC-UX-61** · The two descriptions of a Resource and of each field, the Business Description and the description from dbt, are shown side by side, each with where it comes from: the Business Description on the left, from the Owner; the description from dbt on the right. Neither is ever shown as replacing the other. On a narrow screen the Business Description comes first ([DEC-RC-01](../requirements/functional/05-resource-card.md#dec-rc-01), [DEC-RC-02](../requirements/functional/05-resource-card.md#dec-rc-02)).
- <a id="dec-ux-62"></a>**DEC-UX-62** · Each Learning Level has an icon of its own, for its audience: `user`, `user-focus`, `chart-scatter` and `user-gear`. The bars of the maturity icon belong to the maturity of a Resource, Lens or Report alone, and no other mark looks like them or is filled up to a step. *Decided on 2026-10-26, by Max: the maturity icon is not reused.*
- <a id="dec-ux-63"></a>**DEC-UX-63** · A declaration that a button acts on, such as confirming a Resource, stands in one bar with that button: the checkbox and its sentence on the left, the button at the right end. The button is off until the box is ticked, so it is clear that they are one. *Decided on 2026-10-26, by Max.*
- <a id="dec-ux-64"></a>**DEC-UX-64** · A change to the schema of a Resource since its last Confirmation shows as a warning on its page, for everyone, in the signal colour: what changed, when, and that the Level stays. "Mark as seen", for the Owner and the Data Team, takes it away. There is no Reconfirm and no sheet to confirm again ([DEC-MR-08](../requirements/functional/06-maturity-and-release.md#dec-mr-08)). *Decided on 2026-10-26, by Max.*
- <a id="dec-ux-65"></a>**DEC-UX-65** · An unfolded Collection in the panel shows what it holds in a group per kind: first its Resources, then its Lenses, each with the icon of its kind and its Level, without a label for the group: the icon is clear. Reports join later as a third group. Not one mixed list, which is hard to scan. *Decided on 2026-10-26, by Max ([OP-UX-15](#op-ux-15)).*
- <a id="dec-ux-66"></a>**DEC-UX-66** · Lenses have no section of their own, and no item in the rail: everything is reached through its Collection. A Lens is listed in its Collection, in the panel and on the page of the Collection; its page sits under Collections. The start screen of Collections finds Lenses too, by the words of a question, with the User's own Lenses and Lenses to discover ([FR-CO-37](../requirements/functional/03-collections.md#fr-co-37)). *Decided on 2026-10-26, by Max.*
- <a id="dec-ux-67"></a>**DEC-UX-67** · A Resource has no tab Conversations. Its Messages open in the slide-in from "Messages" in its header, as on every object, and "Ask a question" opens the same slide-in with Question chosen. *Decided on 2026-10-26, by Max ([OP-UX-19](#op-ux-19)).*

## Open points

- [ ] <a id="op-ux-01"></a>**OP-UX-01** · **Popular:** which measure? Views, the number of colleagues, or use in Lenses.
- [ ] <a id="op-ux-02"></a>**OP-UX-02** · **Shared resources** in the panel: align with the model of Publication (visibility hangs on Publication, ownership runs through the Collection).
- [ ] <a id="op-ux-03"></a>**OP-UX-03** · **Start screens** for Lenses and Reports. *Note of 2026-10-24: Lenses is designed (`lenses-start`, withdrawn on 2026-10-26, [DEC-UX-33](#dec-ux-33)); Reports remains.* *Note of 2026-10-26: the start screen of Lenses is withdrawn with its section ([DEC-UX-66](#dec-ux-66)); Reports remains.*
- [ ] <a id="op-ux-04"></a>**OP-UX-04** · **Tabs** Lineage, EDA, History, Conversations and Preview. *Note of 2026-10-22: Conversations is designed (`resource-conversations`, withdrawn on 2026-10-26); Lineage, EDA, History and Preview remain.* *Note of 2026-10-23: Preview and Queries are designed ([resource-preview](screens/resource-preview.html), [resource-queries](screens/resource-queries.html)), to review; SQL went to its own section ([DEC-UX-17](#dec-ux-17)).* *Note of 2026-10-26: the tab Conversations is withdrawn ([DEC-UX-67](#dec-ux-67)).*
- [x] <a id="op-ux-05"></a>**OP-UX-05** · **Collection palette:** align the three additional colours with the chart language. *Decided on 2026-10-25, by Max: the colours come from a configuration file and are tuned after testing on uat ([DEC-UX-60](#dec-ux-60)).*
- [ ] <a id="op-ux-06"></a>**OP-UX-06** · **Screens on mobile** or in narrow windows.

Raised while the design was taken into this repository, on 2026-10-22; not in the design session:

- [x] <a id="op-ux-07"></a>**OP-UX-07** · **Icons:** this design takes Phosphor as the one family, with its line icons for the icon of a Collection. [DEC-CO-13](../requirements/functional/03-collections.md#dec-co-13) and [DEC-CO-14](../requirements/functional/03-collections.md#dec-co-14) take Tabler Icons, and catalogue and the web app already offer every outline icon of Tabler but the logos of brands. Decide which family Data Hub uses. Moving the icons of existing Collections to Phosphor means mapping their names, as the two sets name their icons differently. *Decided on 2026-10-25, by Max: Phosphor, with the light weight favoured and the others possible ([DEC-CO-19](../requirements/functional/03-collections.md#dec-co-19)).*
- [x] <a id="op-ux-08"></a>**OP-UX-08** · **Collection palette:** this design has six colours (magenta, bordeaux, teal, ochre, slate blue, olive). [DEC-CO-07](../requirements/functional/03-collections.md#dec-co-07) and the app have the nine of the "muted" palette by Paul Tol, and catalogue stores those names. Decide which palette applies, and how the colours of existing Collections move over. Together with [OP-UX-05](#op-ux-05) and [OP-CO-02](../requirements/functional/03-collections.md#op-co-02). *Decided on 2026-10-25, by Max: one configuration file holds the palette and grows over time; it starts with the six of this design and the nine existing Collections use, and testing on uat shows which stay ([DEC-UX-60](#dec-ux-60)).*
- [ ] <a id="op-ux-09"></a>**OP-UX-09** · **Look:** [DEC-PF-22](../requirements/technical/00-platform.md#dec-pf-22) asks for the colours of the brandbook, with teal on larger areas, and one light look without a dark mode. This design has warm greys, colour only on content, and a light and a dark theme. Decide whether this design replaces those parts of DEC-PF-22.
- [ ] <a id="op-ux-10"></a>**OP-UX-10** · **Stack:** decide what builds this design: React with Mantine, as [DEC-PF-06](../requirements/technical/00-platform.md#dec-pf-06) and DEC-PF-22 decide, or Svelte, as other repositories of Immoscoop use (raised on 2026-10-20). The design itself does not depend on it: its values are CSS variables and its prototypes plain HTML and CSS.
- [ ] <a id="op-ux-11"></a>**OP-UX-11** · **Sections:** the navigation holds Collections, Lenses and Reports. The web app today also has Charts, the gallery of the Chart Server, and for the Data Team the search through the dbt projects. Decide where they go. *Note of 2026-10-23: Query joins them as a main section ([DEC-UX-17](#dec-ux-17)).*
- [ ] <a id="op-ux-12"></a>**OP-UX-12** · **Capitals in the interface:** the documentation writes Defined Terms with capitals, and so does the interface of the web app today ("New Collection", "Owner Unit"). The prototypes write the interface in sentence case ("New collection", "Your collections", "Owner: Credit team"). Decide which applies to the interface. *Note of 2026-10-25: the language principle writes the kinds of assets as names in lower case inside a sentence ("Wil je deze lens publiek maken?"), which fits sentence case ([NFR-LOC-02](../requirements/non-functional/localisation.md#nfr-loc-02)).*
- [ ] <a id="op-ux-13"></a>**OP-UX-13** · **Settings of a User:** the state of the panel and the dismissed intros, per section and with their version, are kept per User in the settings, and the theme is remembered. Data Hub has no settings of a User yet, and no requirement for them; the prototypes keep them in the browser. Decide where they are kept: in the browser, or in Data Hub, so that they follow the User to another device. *Note of 2026-10-25: the rail no longer has a button for settings ([DEC-UX-53](#dec-ux-53)). Where the switches of a User live, such as "reduce motion" and the background ([OP-UX-20](#op-ux-20)), is part of this.* *Note of 2026-10-25: the language of a User is one more such choice ([OP-DH-46](../overview/open-themes.md#op-dh-46)).*

Raised on 2026-10-22, with the panel of [DEC-UX-10](#dec-ux-10):

- [x] <a id="op-ux-14"></a>**OP-UX-14** · **A page of a Collection:** clicking a Collection in the panel only unfolds it, as no page of a Collection is designed. Decide whether it also opens a page of the Collection on the right, and what that page shows. Until then, several Collections can be unfolded at once and they fold only when clicked. *Decided on 2026-10-23: clicking a Collection opens its page ([DEC-UX-13](#dec-ux-13)).*
- [x] <a id="op-ux-15"></a>**OP-UX-15** · **Lenses and Reports in the panel:** they are to join the list of a Collection later, each with the icon of its kind ([DEC-UX-11](#dec-ux-11)). [DEC-DH-64](../overview/data-hub.md#dec-dh-64) has a Collection group Resources only. Decide whether a Collection holds Lenses and Reports too, and if so, whether its list is one mixed list or a small group per kind. Proposal: a group per kind, as a long mixed list is hard to scan. *Note of 2026-10-23: the page of a Collection lists the Lenses built on its Resources ([DEC-UX-14](#dec-ux-14)); the panel does not yet.* *Decided on 2026-10-26, by Max: the panel lists the Lenses of a Collection too, as a group of their own after the Resources ([DEC-UX-65](#dec-ux-65)).*
Raised on 2026-10-23:

- [x] <a id="op-ux-16"></a>**OP-UX-16** · **The icon of a Collection:** the tinted circle behind it is busy (Max, 2026-10-23). An exploration page showed six treatments side by side, in the panel and in the head of the page: A today, B only the icon, C a grey icon with a colour dot, D a thin ring, E the colour on the edge of the card, F a neutral tile. Choose one; it then moves into `base.css` and the screens. *Decided on 2026-10-23: E, the colour on the edge, for real Collections only ([DEC-UX-15](#dec-ux-15)); the exploration page is removed.*
- [x] <a id="op-ux-17"></a>**OP-UX-17** · **A strong colour for "Without a collection":** Max asked on 2026-10-23 for red or another strong colour, as it is for the Data Team only and needs solving quickly. The signal colour today is ochre, which is also a colour of the Collection palette. Proposal: a new token for what needs the Data Team now, a warm red (`#C4432F`, in dark `#E2725E`), with the number waiting in a small red badge; the exploration page showed it. Decide the colour, and whether it becomes a rule beyond this list. *Decided on 2026-10-23: the red, for "Without a collection" only, without a colour bar as it is no Collection ([DEC-UX-16](#dec-ux-16)).*
- [x] <a id="op-ux-18"></a>**OP-UX-18** · **The panel of Lenses:** the section Lenses has no panel yet. Proposal, as [designed](screens/lens.html): the Lenses the User may use, grouped by Collection in the same tree as the panel of Collections, each with the icon of a Lens and its Level. Decide whether this is it, and how it relates to Lenses in the panel of Collections ([OP-UX-15](#op-ux-15)). *Raised on 2026-10-23.* *Note of 2026-10-24: the start screen of Lenses has the same panel (`lenses-start`, withdrawn on 2026-10-26).* *Decided on 2026-10-26, by Max: there is no section Lenses and no panel of Lenses; Lenses are listed in their Collection ([DEC-UX-66](#dec-ux-66)).*
- [x] <a id="op-ux-19"></a>**OP-UX-19** · **The Conversations tab of a Resource:** the slide-in shows the Messages on every object, a Resource among them ([DEC-UX-29](#dec-ux-29)). Decide whether the tab Conversations of a Resource goes, so that all objects work the same, or stays next to the slide-in. Proposal: it goes. *Raised on 2026-10-23.* *Decided on 2026-10-26, by Max: it goes, as "Messages" in the header holds them ([DEC-UX-67](#dec-ux-67)).*
- [ ] <a id="op-ux-20"></a>**OP-UX-20** · **The background of a User:** a picture can take the place of the gradient ([DEC-UX-34](#dec-ux-34)), from the sets of [DEC-UX-36](#dec-ux-36), each photo with its painting ([DEC-UX-37](#dec-ux-37)). Decide who chooses it, each User in their settings ([OP-UX-13](#op-ux-13)) or one for everyone; whether a User can add a picture of their own; which background is the default; how signing in picks its photo, such as a new one each day; and whether the app then shows the painting of the photo the User saw when signing in. *Raised on 2026-10-24.*

Raised on 2026-10-24, while designing Learning:

- [x] <a id="op-ux-21"></a>**OP-UX-21** · **A fifth main item:** the rail holds three to four main items, and with Learning it holds five (Collections, Query, Lenses, Reports, Learning). Decide whether Learning is a main item, or is reached elsewhere, for example from the menu of the account or a help button. The design puts it in the rail ([DEC-UX-38](#dec-ux-38)). *Note of 2026-10-25: the principles want no learning-plan landing page as a mandatory starting point ([principles, 3.1](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1381138494)). The start screen is not one: every card also opens from context.* *Decided on 2026-10-25: the learning centre leaves the main items, and sits at the bottom of the rail next to the account ([DEC-UX-52](#dec-ux-52)).*
- [x] <a id="op-ux-22"></a>**OP-UX-22** · **The marker of what the learning centre explains** ([DEC-UX-54](#dec-ux-54)): the design uses ⓘ (U+24D8, circled small i), which reads as "there is an explanation here". Poppins has no such character, so it comes from a symbol font whose look differs a little per system. The alternatives are † (U+2020, dagger), which Poppins has and which reads as a footnote, and ※ (U+203B, reference mark), which is less known here. [learning-hover](screens/learning-hover.html) shows the three in place. Decide the character. *Raised on 2026-10-25.* *Decided on 2026-10-25 by Max: ⓘ (U+24D8), from a symbol font.*
- [ ] <a id="op-ux-23"></a>**OP-UX-23** · **Dutch prototypes:** decide how the prototypes follow the language principle ([DEC-DH-65](../overview/data-hub.md#dec-dh-65)). Proposal: a translation table in the prototypes, a key per sentence with its Dutch and English text, Dutch by default and a switch to English, so that [NFR-LOC-02](../requirements/non-functional/localisation.md#nfr-loc-02) shows at work and a name in the table stands out. The alternative is translating the texts in place, which is faster and keeps no English. Either way names stay untouched, and the markers on names ([DEC-UX-59](#dec-ux-59)) come in the same pass. *Raised on 2026-10-25.*

Raised on 2026-10-26, in the review of Max:

- [x] <a id="op-ux-24"></a>**OP-UX-24** · **Overriding a description from dbt, and reviewing it** ([FR-RC-16](../requirements/functional/05-resource-card.md#fr-rc-16), [FR-RC-17](../requirements/functional/05-resource-card.md#fr-rc-17)): editing in place ([DEC-UX-09](#dec-ux-09)) covers the Overview only, and no screen yet overrides the description of a field or reviews a text after a Change in dbt. Proposal: on the Columns tab, an action per field, "Override the description from dbt", that opens a field with the description from dbt under it; on the Overview, the definition takes the same action. The review is a sheet over the page, reached from the Message, with the description from dbt before and after the Change, the text of the Owner, and three choices: keep, change, or remove it. *Raised on 2026-10-26, in the review of Max.* *Decided on 2026-10-26: Max chose two descriptions side by side instead of an override, and a Message without a review; designed in resource-detail, resource-edit, resource-columns-edit and messages, to review ([DEC-UX-61](#dec-ux-61)).*
- [ ] <a id="op-ux-25"></a>**OP-UX-25** · **A deprecated Resource** ([FR-SR-50](../requirements/functional/04-stacks-and-resources.md#fr-sr-50), [OP-SR-16](../requirements/functional/04-stacks-and-resources.md#op-sr-16)): design how the mark shows on the page of the Resource, in the panel, in search and on the Lenses built on it, and where the Owner and the Data Team set it. Proposal: a label "Deprecated" next to the Level, with the reason on hover and on the page; set from the header of the Resource. *Raised on 2026-10-26, in the review of Max.*
