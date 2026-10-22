# Workshop data agents and governance, 2026-10-22

| | |
| --- | --- |
| Type | Source: the requirements for Data Hub from a workshop |
| Date | 2026-10-22 |
| Status | Proposal by Max after the workshop, to be refined in this repository. The meeting notes are still to be validated by the participants. |
| Meeting notes | [ptditt - Meeting notes - 2026-10-22 Workshop data agents & governance](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1378746422) (Confluence, Dutch) |
| Taken in | 2026-10-22, translated from Dutch |

**In one sentence:** the requirements for Data Hub that came out of the workshop on data agents and governance, as Max proposed them afterwards, and where each one is recorded in this repository.

*The numbering refers to the post-its and themes in the meeting notes. Each item is translated faithfully, followed by the requirements it became. Those requirements have status Proposed, as the items are a proposal to be validated. Where an item differs from what was already decided, that is recorded as an open point rather than silently fixed.*

## 1. Assets and their metadata

<a id="req-dh-assets"></a>
### REQ-DH-ASSETS · Kinds of assets (post-it 2)

Data Hub manages five kinds of entities: **Resource** (a mart view that the Data Team offers), **Collection** (a group of Resources per functional domain, with an Owner), **Lens** (a typed query on Resources made by business: joining, filtering, aggregating), **semgraph** (a chart on a Lens or a Resource, through the Chart Server) and **Report** (one or more Lenses or charts around a question, with text). Every asset carries the maturity of the lowest Level beneath it.

**Recorded as:** [OP-DH-38](../overview/open-themes.md#op-dh-38). The overview has three kinds of assets ([From Stacks to Report](../overview/data-hub.md#from-stacks-to-report)); confirming the five, and what the Level of a Collection is, is open.

<a id="req-dh-meta"></a>
### REQ-DH-META · Metadata on a Resource (themes 1 and 2, post-its 8 and 10)

Every Resource has, as separate, visible metadata:

- A **definition** in business language (data dictionary).
- **Open questions** about the data.
- **Control figures** that were run to confirm the Resource.
- **Known gaps**: structural gaps in the data (for example, visitorId is missing for credit leads that come from MySQL rather than from website events).
- A **log of changes and anomalies**: errors, import problems and changes in the data, in chronological order, readable by people and by Claude (through the MCP).
- **Stability**: is the data still settling (late-arriving, for example event data that closes after a few days) or changeable by nature (for example an account name), and from when is it final (for example "stable = D-3").
- The **maturity Level** (existing) and the **confidentiality level** (new, see REQ-DH-CONF).

**Recorded as:** [FR-RC-01](../requirements/functional/05-resource-card.md#fr-rc-01) to [FR-RC-07](../requirements/functional/05-resource-card.md#fr-rc-07), with [OP-RC-01](../requirements/functional/05-resource-card.md#op-rc-01) to [OP-RC-04](../requirements/functional/05-resource-card.md#op-rc-04) on how they relate to the description, the Questions and the Known Behaviour, and on their terms.

<a id="req-dh-relaties"></a>
### REQ-DH-RELATIES · Relationships through Entity and identifier (theme 1, granularity)

With every Resource stands which other Resource you can join it to, and on which field. The relationship is expressed as an **Entity and an identifier** (as in the Domain Model), not as a table name. A new Resource only has to state "this Entity, this identifier" to be linked automatically to everything that carries the same Entity. Relationships can be visualised.

**Recorded as:** [FR-RC-08](../requirements/functional/05-resource-card.md#fr-rc-08) to [FR-RC-10](../requirements/functional/05-resource-card.md#fr-rc-10), with [OP-RC-05](../requirements/functional/05-resource-card.md#op-rc-05) on where the Entity and identifier are recorded.

<a id="req-dh-conf"></a>
### REQ-DH-CONF · Confidentiality levels (theme 4, BETA)

Next to its maturity, every Resource gets a confidentiality level. The level is set at dbt level (meta) and can only be **lowered, never raised** downstream (Lens, Report, export). A Lens or Report inherits the highest confidentiality level of what lies beneath it. There will be a matrix (levels × who may do what); the levels themselves are still to be determined.

**Recorded as:** [FR-PL-01](../requirements/functional/12-permissions-and-library-cards.md#fr-pl-01) to [FR-PL-03](../requirements/functional/12-permissions-and-library-cards.md#fr-pl-03), with [OP-PL-01](../requirements/functional/12-permissions-and-library-cards.md#op-pl-01) for the levels and the matrix, and [OP-PL-02](../requirements/functional/12-permissions-and-library-cards.md#op-pl-02) for how they relate to the access classification already on the Resource Card.

## 2. Collections and ownership

<a id="req-dh-coll"></a>
### REQ-DH-COLL · Collections private or public (theme 3, sandbox and access)

A Collection is per functional domain and is **private** or **public**. Private: only the owner(s) have access, nobody else sees it; it is the workspace. The owner decides to make a Collection public, and decides **per Resource** what is in the Collection and whether it is public.

**Recorded as:** already decided and built in [Collections](../requirements/functional/03-collections.md): private or public ([FR-CO-16](../requirements/functional/03-collections.md#fr-co-16), [FR-CO-17](../requirements/functional/03-collections.md#fr-co-17)), and Publication per Resource by the Owner ([FR-SR-16](../requirements/functional/04-stacks-and-resources.md#fr-sr-16)). Two differences are open points: the Data Team also sees private Collections ([OP-CO-09](../requirements/functional/03-collections.md#op-co-09)), and the Data Team, not the Owner, adds Resources to a Collection ([OP-CO-10](../requirements/functional/03-collections.md#op-co-10)).

<a id="req-dh-owners"></a>
### REQ-DH-OWNERS · Owners through a Google Workspace group (theme 4, validating together)

The owners of a Collection are determined by a Google Workspace group. A Collection therefore always potentially has several owners; access and notifications run through the group.

**Recorded as:** already decided and built: the Owner Unit is any Google group of the own Workspace domain ([DEC-CO-09](../requirements/functional/03-collections.md#dec-co-09), [DEC-UM-07](../requirements/functional/02-user-management.md#dec-um-07)). New: notifications reach every member of the Owner Unit ([FR-LN-01](../requirements/functional/07-log-and-notifications.md#fr-ln-01)).

<a id="req-dh-notify-schema"></a>
### REQ-DH-NOTIFY-SCHEMA · The Owner notifies Consumers of a schema change (theme 1)

On a structural Change to a Resource, it drops to Described and the Owner gets a notification (existing). New: the Owner can notify the **Consumers** of the Resource (the users of Lenses and Reports on it) from Data Hub; Data Hub knows those Consumers through the lineage of Lenses and Reports.

**Recorded as:** [FR-LN-02](../requirements/functional/07-log-and-notifications.md#fr-ln-02) and [FR-LN-03](../requirements/functional/07-log-and-notifications.md#fr-ln-03), next to the existing [FR-MR-05](../requirements/functional/06-maturity-and-release.md#fr-mr-05).

<a id="req-dh-notify-lens"></a>
### REQ-DH-NOTIFY-LENS · The Owner is notified when a Lens is made public (theme 3, assumption ≠ fact)

When a Lens that builds on a Resource is made **public**, the Owner of that Resource gets a notification. Before the Lens is published, there is no notification.

**Recorded as:** [FR-LN-04](../requirements/functional/07-log-and-notifications.md#fr-ln-04), with [OP-LN-02](../requirements/functional/07-log-and-notifications.md#op-ln-02): what making a Lens public means is not worked out yet.

## 3. Queries, Lenses and cost

<a id="req-dh-sqllog"></a>
### REQ-DH-SQLLOG · Every data fetch gets a query ID (post-it 11)

Every executed query (ad hoc, Lens, Report, export, MCP) is logged with a unique **query ID**, the SQL, who ran it, the time, the bytes processed and the underlying Resources. Every output (chart, report, PDF, export) visibly carries that ID, so that a screenshot can always be traced back to the SQL. semgraph already does this; Data Hub extends it to all assets.

**Recorded as:** [FR-LN-05](../requirements/functional/07-log-and-notifications.md#fr-ln-05) and [FR-LN-06](../requirements/functional/07-log-and-notifications.md#fr-ln-06). It differs from [DEC-SR-18](../requirements/functional/04-stacks-and-resources.md#dec-sr-18), which stores no queries in v1: [OP-LN-01](../requirements/functional/07-log-and-notifications.md#op-ln-01).

<a id="req-dh-preflight"></a>
### REQ-DH-PREFLIGHT · Pre-flight and thresholds on queries (post-it 14)

Before every query, Data Hub shows a pre-flight with the volume to be processed (MB/GB). Thresholds: above **X GB**, ask the user for explicit approval; above **Y GB**, block. X and Y are configurable.

**Recorded as:** [FR-SR-36](../requirements/functional/04-stacks-and-resources.md#fr-sr-36) and [FR-SR-37](../requirements/functional/04-stacks-and-resources.md#fr-sr-37), next to the byte limit of [FR-SR-27](../requirements/functional/04-stacks-and-resources.md#fr-sr-27); deciding X and Y joins [OP-SR-07](../requirements/functional/04-stacks-and-resources.md#op-sr-07).

<a id="req-dh-lensweight"></a>
### REQ-DH-LENSWEIGHT · Weight and creation limit of a Lens (post-it 14)

A Lens can only be created if the processing at its creation stays under a configurable number of GB. The weight of a Lens is visible to every user (light/heavy), so that a data user knows what they set in motion.

**Recorded as:** [FR-LE-01](../requirements/functional/09-lenses.md#fr-le-01) and [FR-LE-02](../requirements/functional/09-lenses.md#fr-le-02).

<a id="req-dh-export"></a>
### REQ-DH-EXPORT · No high-volume or frequent exports through Data Hub (post-it 12)

Large or frequent (structural) exports are not meant to run through Data Hub, nor through the Excel/ODBC connection on it, nor through Claude. Structural exports belong to data from maturity Level 2 (Described): if business wants to export a Lens (a new concept) structurally, that goes back to the Data Team, which sets up the export from dbt or the Domain Model. Data Hub supports this with a row limit per export and a clear message that points to the right route.

**Recorded as:** [FR-CH-01](../requirements/functional/13-channels.md#fr-ch-01) and [FR-CH-02](../requirements/functional/13-channels.md#fr-ch-02), in line with [DEC-DH-44](../overview/data-hub.md#dec-dh-44).

<a id="req-dh-lenstext"></a>
### REQ-DH-LENSTEXT · A Lens described in plain language (theme 3, show and read the SQL)

When a Lens is created, Data Hub generates (through a skill) a description in business language of the steps, queries and CTEs, so that business sees what happens in the Lens without reading SQL.

**Recorded as:** [FR-LE-03](../requirements/functional/09-lenses.md#fr-le-03).

<a id="req-dh-lensparams"></a>
### REQ-DH-LENSPARAMS · Adjustable Parameters in a Lens (theme 3)

Business can adjust certain Parameters in a Lens without touching the SQL, for example the bounds of a `WHERE ... BETWEEN`. Parameters are typed and named functionally (in line with the existing concept of a Lens).

**Recorded as:** [FR-LE-04](../requirements/functional/09-lenses.md#fr-le-04), in line with [DEC-DH-11](../overview/data-hub.md#dec-dh-11).

<a id="req-dh-story"></a>
### REQ-DH-STORY · First the story, then the data (post-it 3)

Whoever starts a Lens is asked to record the question and the story first (what do you want to know, what will you do with it) before the query is built. The form (skill, form, interface) is still to be decided; the story becomes metadata of the Lens.

**Recorded as:** [FR-LE-05](../requirements/functional/09-lenses.md#fr-le-05), with [OP-LE-01](../requirements/functional/09-lenses.md#op-le-01) for the form.

## 4. Sandbox, access and agent

<a id="req-dh-mcp-scope"></a>
### REQ-DH-MCP-SCOPE · The MCP sees only Data Hub (theme 3, Claude outside the sandbox)

Claude works through the Data Hub MCP, not through an open BigQuery connector. The MCP sees only the Resources, Collections and Lenses the user has access to, with the same pre-flights, thresholds and query log.

**Recorded as:** [FR-CH-03](../requirements/functional/13-channels.md#fr-ch-03), next to [FR-SR-26](../requirements/functional/04-stacks-and-resources.md#fr-sr-26).

<a id="req-dh-docs"></a>
### REQ-DH-DOCS · A built-in wiki as part of the development process (theme 4, validating together)

The Data Hub repository holds documentation that explains how everything works (assets, Levels, Collections, notifications). That documentation is part of the interface: both the graphical interface and the MCP server refer to it in context, so that you get to know the application by working with it. Updating the documentation is part of every feature.

**Recorded as:** [FR-CH-04](../requirements/functional/13-channels.md#fr-ch-04) and [FR-CH-05](../requirements/functional/13-channels.md#fr-ch-05), with [OP-CH-01](../requirements/functional/13-channels.md#op-ch-01) on where that documentation lives and how it is served.

## 5. Later (roadmap, not for now)

- **Semantics on semantics** (post-it 15): set the conditions under which business may derive a new concept from Resources (no derivation without EDA and monitoring on the source), and how a derived concept can inherit the EDA and monitoring of its source as a proxy. **Recorded as:** [OP-BP-01](../requirements/functional/11-beta-and-promotion.md#op-bp-01).
- **Data onboarding for new features** (post-it 6): the process IT → Data → business; it touches Data Hub through taking in new Resources. **Recorded as:** [OP-DH-39](../overview/open-themes.md#op-dh-39).
