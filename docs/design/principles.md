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

- The interface is in **English** ([FR-SR-15](../requirements/functional/04-stacks-and-resources.md#fr-sr-15)).
- **Calm and air:** plenty of negative space. Rather less on a screen than a full screen.
- **Full screen.** The content uses the full width, divided into blocks, never long rows or lines across the full width.

## Layers and focus

There are three layers:

1. **Background:** a slow transition between three warm colours (sand, blush, mist).
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
- Collections get a colour from the Collection palette. Magenta, bordeaux and teal come from the brand; ochre, slate blue and olive are additions. The colour shows as **a thin bar on the left edge** of the card of a Collection, and of the head of its page ([DEC-UX-15](#dec-ux-15)).
- **Signal colour** (ochre) only for a state that calls for action, such as a Level that has dropped.
- **Urgent colour** (red, `--signal-urgent`) only for "Without a collection": Resources that wait for the Data Team ([DEC-UX-16](#dec-ux-16)); and for the button of a run that reads above the approval threshold ([DEC-UX-28](#dec-ux-28)).

*The app today uses the colours of the brandbook and nine Collection colours of its own: see [OP-UX-08](#op-ux-08) and [OP-UX-09](#op-ux-09).*

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
- **Line icons** for what the User chooses, such as the icon of a Collection. The icon of a Collection is **grey, without a circle**; its colour is the bar on the edge of its card ([DEC-UX-15](#dec-ux-15)). Only a real Collection has that bar.

*The icon of a Collection comes from Tabler Icons today: see [OP-UX-07](#op-ux-07).*

- A Resource has **no icon of its own**: icons are for the interface and for Collections ([DEC-UX-06](#dec-ux-06)).
- In a list, an item has the **icon of its kind**: a table for a Resource, the same for every Resource. That icon is part of the interface ([DEC-UX-11](#dec-ux-11)).

## Navigation

- **On the left, floating:** the icons have no bar or background of their own. Three to four main items (now Collections, Query, Lenses, Reports; see [OP-UX-11](#op-ux-11) and [DEC-UX-17](#dec-ux-17)); at the bottom Messages, with the number unread ([DEC-UX-29](#dec-ux-29)), then theme, settings and account.
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
  - Lenses and Reports join the list later, each with the icon of its kind ([OP-UX-15](#op-ux-15)).
- **"Shared resources":** each with the icon of its kind, its name and the team that owns it ([OP-UX-02](#op-ux-02)).
- **For the Data Team,** on top: "Without a collection", a card with the Resources that wait for a Collection. It is no Collection, so it has no colour bar: it is in the urgent red instead, with a red tint, a red name and icon, and the number waiting in a red badge ([DEC-UX-16](#dec-ux-16)).
- **One line per name:** a name that is too long ends in an ellipsis and shows in full on hover. This holds for Collections and Resources alike.
- **Search** filters Collections and Resources together. A Collection whose name matches stays as it was; a Collection with a matching Resource unfolds and shows only the matching Resources.

## Start screen per section

Each main item opens on a **start screen**, not on an overview that repeats the panel. The panel is the index; the start screen shows what the list cannot show.

For Collections:

- **Intro** at the top, with a graphic element, "What are collections?", a short explanation, the button "New collection" and a link to more explanation.
  - It can be dismissed. That is saved **per User and per section** in the settings.
  - The intro has a **version number**: after a big change it can appear again.
  - Dismissed: a calm title bar with "Show intro" and the fixed button "New collection".
- **Recently**, switchable between **Updated** and **Added**: what changed, by whom and when.
- **Popular collections.**

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

Screens: [resource-detail](screens/resource-detail.html), [resource-edit](screens/resource-edit.html), [resource-conversations](screens/resource-conversations.html) and [resource-unassigned](screens/resource-unassigned.html).

- **Header:** the name, the Key with a copy button, the button "Query", which starts a new query on the Resource in [Query](#query) ([DEC-UX-21](#dec-ux-21)), "Messages" with their number, which opens the Messages on the Resource in a slide-in ([DEC-UX-29](#dec-ux-29)), and the button "Ask a question", which opens the same slide-in with Question chosen ([DEC-UX-08](#dec-ux-08)). No icon: a Resource has none of its own.
- **Status row:** maturity, Publication, Owner, open Signals. No freshness ([DEC-UX-07](#dec-ux-07)).
- **Alert on a drop:** what happened, and a button "Reconfirm" for the Owner. It disappears when all is well.
- **Tabs:** Overview, Columns, Lineage, EDA, History, Conversations, Preview, Queries.
- **Overview,** in tiles:
  - **Definition:** the definition in business language, written in Data Hub, and under it the description from dbt with its model type and grain, marked as coming from dbt.
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
- **Columns:** each column with its type, description, Entity, and what it serves as: the Partition, a Cluster column with its place, a Parameter.

### Editing a Resource

- The Owner and the Data Team edit what Data Hub keeps about a Resource **in place,** on the Overview: the definition, intended use, pitfalls, Known Gaps, Stability, since when the data is reliable, and the key fields and Parameters ([DEC-UX-09](#dec-ux-09)).
- Each tile they can edit has an "Edit" link. Editing turns the tiles into fields, with a bar on top that says every saved change goes into the history, and "Cancel" and "Save".
- What comes from dbt (the description, model type and grain, the columns) and what the Data Team gives (the Entities and relationships) is shown next to the fields, marked as such, and not edited here.

### Conversations

- One list of Questions, Remarks and Signals, newest first, each with its kind, who wrote it, when, and the replies.
- On top, a field to start one, with the kind to choose. "Ask a question" in the header opens it with Question chosen.
- Under the field, who gets a notification for the chosen kind.
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

## Page of a Collection

Screens: [collection-overview](screens/collection-overview.html), [collection-edit](screens/collection-edit.html) and [collection-add-resources](screens/collection-add-resources.html). Designed and approved on 2026-10-23; the switch at the bottom right of the overview, for the prototype only, shows it as a Data Admin, the Owner or a colleague.

- **Opens** when a User clicks a Collection in the panel ([DEC-UX-13](#dec-ux-13)). The page holds what the panel cannot: what the Collection is, what needs attention, and the lists in full ([DEC-UX-14](#dec-ux-14)).
- **Head:** the icon, the name and the description of the Collection; a row with the Owner Unit, private or public, the number of Resources and Lenses, and when and by whom it was created.
- **Actions, on the right of the head, per role:**
  - Only who owns the Collection changes it ([DEC-CO-15](../requirements/functional/03-collections.md#dec-co-15)). A colleague sees no actions.
  - "New lens", the primary action, for the Owner Unit. What it opens is not designed yet ([OP-LE-01](../requirements/functional/09-lenses.md#op-le-01)).
  - "Edit", for the Owner Unit. The Data Team has it too today; whether that stays is open ([OP-CO-12](../requirements/functional/03-collections.md#op-co-12)).
  - "Add resources", for the Data Admins.
- **Needs attention,** for the Owner Unit and the Data Team, only when there is something: a Level that dropped and waits for a Confirmation, open Signals, Resources not published yet. Each line links to where it is solved.
- **Resources:** a table of every Resource the User sees, with the icon of its kind, the Display Name, the Level, the Publication, open Signals and the last change. A Resource that is not published is in a lighter grey. Data Admins have a button to remove a Resource from the Collection.
- **Lenses:** a table of the Lenses its Owner Unit added to the Collection ([DEC-CO-15](../requirements/functional/03-collections.md#dec-co-15)), with the icon of a Lens, the name, the type, what it is built on and its Level: the lowest Level of what it is built on.
- **Recent history:** the latest entries of the Log of the Collection, with a link to all of it. A colleague does not see the entries about Resources that are not published.
- **Editing** happens in place, as for a Resource: the head turns into fields with the edit bar on top. Name, description, Owner Unit (only groups of whoever edits), who sees it (private or public, with what that means), colour and icon. Dissolving is at the bottom, and only possible for an empty Collection.
- **Adding Resources** opens a **sheet** from the right over the page: the Resources without a Collection, searchable, each with its description from dbt, how it came in, and its Level, to tick one or more. A Resource is in one Collection at most, so only those without a Collection appear. The page stays visible behind it.

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
- **Left, the lens:** its name, from the query; its type ([DEC-DH-13](../overview/data-hub.md#dec-dh-13)); the question it answers, from the query; what it shows in a sentence and its tags ([FR-LE-06](../requirements/functional/09-lenses.md#fr-le-06)); what it does step by step, written by Data Hub from the SQL and editable ([FR-LE-03](../requirements/functional/09-lenses.md#fr-le-03)); its Parameters, each with the name Users see, its type, its default, a value or a function such as "today − 3 days", chosen in the same dropdown as on the page of a Lens ([FR-LE-13](../requirements/functional/09-lenses.md#fr-le-13)), and whether Users may change it ([FR-LE-04](../requirements/functional/09-lenses.md#fr-le-04), [DEC-DH-11](../overview/data-hub.md#dec-dh-11)); the Collection it goes into, with its colour bar; its Resources and its Level, the lowest of theirs ([DEC-DH-10](../overview/data-hub.md#dec-dh-10)).
- **Right, the size check** ([FR-LE-08](../requirements/functional/09-lenses.md#fr-le-08)): what one run reads, measured now; a gauge with the two thresholds; per Resource the partitions it reads; then the outcome:
  - **Within range:** "Publish lens".
  - **Large:** a warning in the warning colour, what would make it read less, "Publish anyway" and "Back to the query".
  - **Very large:** it waits for the Data Team ([FR-LE-09](../requirements/functional/09-lenses.md#fr-le-09)): an optional word for the Data Team and "Send to the data team".
- **Under it,** that a Lens that later reads more than its range is checked again ([FR-LE-10](../requirements/functional/09-lenses.md#fr-le-10)).
- The prototype shows the three outcomes as scenarios, with a switch at the bottom. It shows an author in the Owner Unit; where the Lens of a colleague outside it goes is open ([OP-LE-04](../requirements/functional/09-lenses.md#op-le-04)), and so is how the rest of the story of a Lens is asked ([OP-LE-01](../requirements/functional/09-lenses.md#op-le-01)).

## Page of a Lens

Screen: [lens](screens/lens.html). Designed on 2026-10-23, to review. Where a Lens runs: its page in the section Lenses ([DEC-UX-26](#dec-ux-26), [FR-LE-11](../requirements/functional/09-lenses.md#fr-le-11)). It shows the basic flavour of a Lens, a query with Parameters and a table as its result; other flavours, such as filtered or aggregated, come later ([OP-LE-07](../requirements/functional/09-lenses.md#op-le-07)).

- **The panel** of the section Lenses lists the Lenses the User may use ([DEC-CO-16](../requirements/functional/03-collections.md#dec-co-16)), grouped by Collection in the same tree as the panel of Collections, with the icon of a Lens and its Level. A proposal ([OP-UX-18](#op-ux-18)).
- **Head:** the icon of a Lens, its name and what it shows in a sentence; a row with its Level, its type, its Collection with the colour bar, who made it and when, and its tags. For its Owner Unit only: "Edit" and "Open in Query", which starts a query from its SQL ([DEC-UX-27](#dec-ux-27)).
- **Two tabs:** Run, where it opens, and About.
- **Run, on top, the request:** its Parameters in a panel that folds open and shut. Folded, it is one line with each Parameter and its value; open, the Parameters stand side by side, each with the name Users see ([DEC-DH-11](../overview/data-hub.md#dec-dh-11)) and a dropdown, filled in with its default. The dropdown of a date offers a date, or a function with the function sign, worked out at every run: today, today minus a number of days, the start of this week, month or year, the end of the last complete week; each with the date it gives today ([FR-LE-13](../requirements/functional/09-lenses.md#fr-le-13)). A list offers its values. A Parameter that is changed is marked, shows its default under it, and "Default" puts that back. In the lower right corner of the panel, folded or not, "Run" with the Pre-flight in the button itself: "Run · 5.1 GB". Above the approval threshold it turns red and reads "Approve and run · 17.9 GB" ([FR-SR-37](../requirements/functional/04-stacks-and-resources.md#fr-sr-37), [DEC-UX-28](#dec-ux-28)); when the table is partitioned, a pop-out on the button then says how many partitions the run reads and which Parameter reads less ([FR-SR-40](../requirements/functional/04-stacks-and-resources.md#fr-sr-40)). The Pre-flight takes no room of its own. Parameters are not added here: that is editing, for the Owner Unit.
- **Run, below it, the result:** a table, with readable column names. Above it when and with which Parameters it ran and "Download CSV", within the row limit ([FR-CH-01](../requirements/functional/13-channels.md#fr-ch-01)); under it what was read and the Query ID with a copy button ([FR-LN-06](../requirements/functional/07-log-and-notifications.md#fr-ln-06)).
- **When a Parameter changes,** the result fades and says it is still for the old values, until the Lens runs again ([FR-LE-12](../requirements/functional/09-lenses.md#fr-le-12)).
- **Before the first run,** the result says so. A Lens does not run by itself when it is opened: every run is a query, with its Pre-flight. A proposal ([OP-LE-06](../requirements/functional/09-lenses.md#op-le-06)).
- **About:** tiles with the question it answers and what it shows; what it does step by step ([FR-LE-03](../requirements/functional/09-lenses.md#fr-le-03)); what it is built on, each Resource with its Collection and Level, and why the Lens has its Level; its Parameters with their type and default; and its history: who made it from which query, and how often it runs.
- **No SQL** on this page, on either tab: a colleague never sees the SQL of a Lens; its Owner Unit sees it when editing ([DEC-UX-27](#dec-ux-27), [FR-LE-14](../requirements/functional/09-lenses.md#fr-le-14)).
- The prototype shows the result up to date, after a change, before the first run and while choosing the value of To, with a switch at the bottom, and the page as the Owner Unit or a colleague.

## Messages

Screens: [messages](screens/messages.html), the Message Centre; and the Messages on an object in a slide-in, on [a Collection](screens/collection-messages.html), [a Resource](screens/resource-messages.html) and [a Lens](screens/lens-messages.html). Designed on 2026-10-23, to review ([DEC-UX-29](#dec-ux-29)).

- **What a Message is:** a Question, Remark, Signal or Request on an object, or a reply, to enrich the data and inform colleagues. Never private, never a chat with a person; it is about a whole object, never a part of it ([DEC-CV-04](../requirements/functional/14-conversations.md#dec-cv-04), [DEC-CV-05](../requirements/functional/14-conversations.md#dec-cv-05)).
- **The Message Centre** is in the rail, under the main items, with the number unread on its icon. Its panel filters: For you, the default; Unread; Written by you; Everything you may see; then by kind, Questions, Remarks, Signals, Requests and what Data Hub tells you; and by the kind of object, Collections, Resources, Lenses, Queries ([FR-CV-06](../requirements/functional/14-conversations.md#fr-cv-06)).
- **Its list:** each Message with its object (the icon of its kind, the kind, the name and its Collection), its kind and its state (open, answered), who and when, and its first lines; a dot when it is unread, the number of replies. Chips on top: all, open, answered.
- **The Message opened** shows on the right: its object with "Open the …", which goes to the object with its Messages open ([FR-CV-02](../requirements/functional/14-conversations.md#fr-cv-02)); the Message with its replies; a field to reply, with who gets a notification.
- **On every object,** a Collection, a Resource or a Lens, "Messages" with their number in the header opens the slide-in: on top a new Message, with its kind and who gets a notification; chips by kind; the Messages on this object with their replies; at the bottom that everyone who may see the object sees them, and the way to the Message Centre ([FR-CV-07](../requirements/functional/14-conversations.md#fr-cv-07)). On a Resource, "Ask a question" opens the same slide-in with Question chosen.
- **A Collection** takes a Question or a Remark; a Resource and a Lens also a Signal. The Messages on the Resources and Lenses of a Collection stay on those.
- **A Request** asks the Data Team for a decision on its object; the first is accepting a very large Lens, sent with "Send to the data team" when it is made ([DEC-CV-06](../requirements/functional/14-conversations.md#dec-cv-06), [FR-CV-08](../requirements/functional/14-conversations.md#fr-cv-08)). Opened, it shows what it asks to decide on, such as what one run reads, its range, the partitions and what a default would read. The Data Team has a field for its reason, "Refuse" and "Accept"; its author sees that it waits, and that only they see the Lens until then. The state shows in the list: waiting, accepted, refused.

## Sheets

- A **sheet** slides in from the right over the page, for a task that belongs to the page but is not the page, such as adding Resources to a Collection. The page stays visible behind it, dimmed; a click beside it or "Close" closes it.

## Background and motion

- Motion in the background is **very slow** (`--background-cycle`), felt rather than seen.
- Only in the background: reading surfaces never move.
- **"Reduce motion"** in the system turns all animation off. A switch in the settings can do so too.
- Light for the computer: CSS, no video.
- An alternative we tried: three blurred blobs of colour that move slowly. The gradient is the current choice.

## Decisions

All decided on 2026-10-22, in the design session.

- <a id="dec-ux-01"></a>**DEC-UX-01** · No Figma for Data Hub: an internal tool, the design lives in code next to the requirements.
- <a id="dec-ux-02"></a>**DEC-UX-02** · Navigation on the left with a slide-out panel, instead of navigation at the top.
- <a id="dec-ux-03"></a>**DEC-UX-03** · Each section opens on a start screen; the panel is the index. No separate overview screen that repeats the panel.
- <a id="dec-ux-04"></a>**DEC-UX-04** · The "Promoted" feature on the start screen is not built yet.
- <a id="dec-ux-05"></a>**DEC-UX-05** · Background: a gradient of three colours instead of blobs of colour.

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
- <a id="dec-ux-26"></a>**DEC-UX-26** · A Lens runs on a page of its own in the section Lenses, with two tabs. Run: the request on top, its Parameters in a panel that folds open and shut, the Pre-flight and "Run"; below it the result, a table. About: what it answers, what it does, what it is built on, its Parameters and its history. This is the basic flavour, a query with Parameters and a table.
- <a id="dec-ux-27"></a>**DEC-UX-27** · The page of a Lens shows no SQL and adds no Parameters. A colleague never sees the SQL of a Lens; its Owner Unit sees it, and adds Parameters, when editing. "Open in Query" is for the Owner Unit only.
- <a id="dec-ux-28"></a>**DEC-UX-28** · On the page of a Lens the Pre-flight is in the "Run" button, in the lower right corner of the Parameters, with what the run reads; it takes no room of its own. Above the approval threshold the button turns red and asks to approve, and when the table is partitioned a pop-out on the button says how to read less.
- <a id="dec-ux-29"></a>**DEC-UX-29** · Messages have a Message Centre of their own, in the rail with the number unread, and every object with Messages, a Collection, a Resource or a Lens, opens its own Messages in a slide-in, which is the Message Centre filtered on that object, with a field to start one.

## Open points

- [ ] <a id="op-ux-01"></a>**OP-UX-01** · **Popular:** which measure? Views, the number of colleagues, or use in Lenses.
- [ ] <a id="op-ux-02"></a>**OP-UX-02** · **Shared resources** in the panel: align with the model of Publication (visibility hangs on Publication, ownership runs through the Collection).
- [ ] <a id="op-ux-03"></a>**OP-UX-03** · **Start screens** for Lenses and Reports.
- [ ] <a id="op-ux-04"></a>**OP-UX-04** · **Tabs** Lineage, EDA, History, Conversations and Preview. *Note of 2026-10-22: Conversations is designed ([resource-conversations](screens/resource-conversations.html)); Lineage, EDA, History and Preview remain.* *Note of 2026-10-23: Preview and Queries are designed ([resource-preview](screens/resource-preview.html), [resource-queries](screens/resource-queries.html)), to review; SQL went to its own section ([DEC-UX-17](#dec-ux-17)).*
- [ ] <a id="op-ux-05"></a>**OP-UX-05** · **Collection palette:** align the three additional colours with the chart language.
- [ ] <a id="op-ux-06"></a>**OP-UX-06** · **Screens on mobile** or in narrow windows.

Raised while the design was taken into this repository, on 2026-10-22; not in the design session:

- [ ] <a id="op-ux-07"></a>**OP-UX-07** · **Icons:** this design takes Phosphor as the one family, with its line icons for the icon of a Collection. [DEC-CO-13](../requirements/functional/03-collections.md#dec-co-13) and [DEC-CO-14](../requirements/functional/03-collections.md#dec-co-14) take Tabler Icons, and catalogue and the web app already offer every outline icon of Tabler but the logos of brands. Decide which family Data Hub uses. Moving the icons of existing Collections to Phosphor means mapping their names, as the two sets name their icons differently.
- [ ] <a id="op-ux-08"></a>**OP-UX-08** · **Collection palette:** this design has six colours (magenta, bordeaux, teal, ochre, slate blue, olive). [DEC-CO-07](../requirements/functional/03-collections.md#dec-co-07) and the app have the nine of the "muted" palette by Paul Tol, and catalogue stores those names. Decide which palette applies, and how the colours of existing Collections move over. Together with [OP-UX-05](#op-ux-05) and [OP-CO-02](../requirements/functional/03-collections.md#op-co-02).
- [ ] <a id="op-ux-09"></a>**OP-UX-09** · **Look:** [DEC-PF-22](../requirements/technical/00-platform.md#dec-pf-22) asks for the colours of the brandbook, with teal on larger areas, and one light look without a dark mode. This design has warm greys, colour only on content, and a light and a dark theme. Decide whether this design replaces those parts of DEC-PF-22.
- [ ] <a id="op-ux-10"></a>**OP-UX-10** · **Stack:** decide what builds this design: React with Mantine, as [DEC-PF-06](../requirements/technical/00-platform.md#dec-pf-06) and DEC-PF-22 decide, or Svelte, as other repositories of Immoscoop use (raised on 2026-10-20). The design itself does not depend on it: its values are CSS variables and its prototypes plain HTML and CSS.
- [ ] <a id="op-ux-11"></a>**OP-UX-11** · **Sections:** the navigation holds Collections, Lenses and Reports. The web app today also has Charts, the gallery of the Chart Server, and for the Data Team the search through the dbt projects. Decide where they go. *Note of 2026-10-23: Query joins them as a main section ([DEC-UX-17](#dec-ux-17)).*
- [ ] <a id="op-ux-12"></a>**OP-UX-12** · **Capitals in the interface:** the documentation writes Defined Terms with capitals, and so does the interface of the web app today ("New Collection", "Owner Unit"). The prototypes write the interface in sentence case ("New collection", "Your collections", "Owner: Credit team"). Decide which applies to the interface.
- [ ] <a id="op-ux-13"></a>**OP-UX-13** · **Settings of a User:** the state of the panel and the dismissed intros, per section and with their version, are kept per User in the settings, and the theme is remembered. Data Hub has no settings of a User yet, and no requirement for them; the prototypes keep them in the browser. Decide where they are kept: in the browser, or in Data Hub, so that they follow the User to another device.

Raised on 2026-10-22, with the panel of [DEC-UX-10](#dec-ux-10):

- [x] <a id="op-ux-14"></a>**OP-UX-14** · **A page of a Collection:** clicking a Collection in the panel only unfolds it, as no page of a Collection is designed. Decide whether it also opens a page of the Collection on the right, and what that page shows. Until then, several Collections can be unfolded at once and they fold only when clicked. *Decided on 2026-10-23: clicking a Collection opens its page ([DEC-UX-13](#dec-ux-13)).*
- [ ] <a id="op-ux-15"></a>**OP-UX-15** · **Lenses and Reports in the panel:** they are to join the list of a Collection later, each with the icon of its kind ([DEC-UX-11](#dec-ux-11)). [DEC-DH-64](../overview/data-hub.md#dec-dh-64) has a Collection group Resources only. Decide whether a Collection holds Lenses and Reports too, and if so, whether its list is one mixed list or a small group per kind. Proposal: a group per kind, as a long mixed list is hard to scan. *Note of 2026-10-23: the page of a Collection lists the Lenses built on its Resources ([DEC-UX-14](#dec-ux-14)); the panel does not yet.*
Raised on 2026-10-23:

- [x] <a id="op-ux-16"></a>**OP-UX-16** · **The icon of a Collection:** the tinted circle behind it is busy (Max, 2026-10-23). An exploration page showed six treatments side by side, in the panel and in the head of the page: A today, B only the icon, C a grey icon with a colour dot, D a thin ring, E the colour on the edge of the card, F a neutral tile. Choose one; it then moves into `base.css` and the screens. *Decided on 2026-10-23: E, the colour on the edge, for real Collections only ([DEC-UX-15](#dec-ux-15)); the exploration page is removed.*
- [x] <a id="op-ux-17"></a>**OP-UX-17** · **A strong colour for "Without a collection":** Max asked on 2026-10-23 for red or another strong colour, as it is for the Data Team only and needs solving quickly. The signal colour today is ochre, which is also a colour of the Collection palette. Proposal: a new token for what needs the Data Team now, a warm red (`#C4432F`, in dark `#E2725E`), with the number waiting in a small red badge; the exploration page showed it. Decide the colour, and whether it becomes a rule beyond this list. *Decided on 2026-10-23: the red, for "Without a collection" only, without a colour bar as it is no Collection ([DEC-UX-16](#dec-ux-16)).*
- [ ] <a id="op-ux-18"></a>**OP-UX-18** · **The panel of Lenses:** the section Lenses has no panel yet. Proposal, as [designed](screens/lens.html): the Lenses the User may use, grouped by Collection in the same tree as the panel of Collections, each with the icon of a Lens and its Level. Decide whether this is it, and how it relates to Lenses in the panel of Collections ([OP-UX-15](#op-ux-15)). *Raised on 2026-10-23.*
- [ ] <a id="op-ux-19"></a>**OP-UX-19** · **The Conversations tab of a Resource:** the slide-in shows the Messages on every object, a Resource among them ([DEC-UX-29](#dec-ux-29)). Decide whether the tab Conversations of a Resource goes, so that all objects work the same, or stays next to the slide-in. Proposal: it goes. *Raised on 2026-10-23.*
