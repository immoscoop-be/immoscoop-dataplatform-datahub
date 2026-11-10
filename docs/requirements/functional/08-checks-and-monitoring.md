# Checks and monitoring

| | |
| --- | --- |
| Domain | 8 of Data Hub · code `CM` |
| Status | Specified on 2026-11-07, from the brainstorm of Max; the screens are still to design, then it is built as the next part after the launch ([DEC-CM-13](#dec-cm-13)) |
| Source of truth | This file |
| Origin | Listed in the domain overview on Confluence (Confluence name: Checks en monitoring); worked out in the [brainstorm of 2026-11-07](../../workshops/2026-11-07-monitoring-and-alerting.md) |

**In one sentence:** the Owner of a Resource sets up and tunes, without the Data Team building it, what Data Hub watches on that Resource, from a few cheap aggregation queries, and hears what they asked to hear, in the tone they chose.

*Functional domain 8 of Data Hub. Overview of all domains: [Functional domains](README.md).*

Monitoring here is the monitoring of the data of a Resource. The monitoring of Data Hub itself, its services and their health, is not part of this domain ([OP-DH-53](../../overview/backlog.md#op-dh-53)). The automatic checks that follow from an EDA after every Change ([DEC-DH-29](../../overview/data-hub.md#dec-dh-29)) are not worked out yet either; they belong with the [EDA](15-eda.md).

## Decisions

*Decided on 2026-11-07: the key decisions of the brainstorm of Max ([§0](../../workshops/2026-11-07-monitoring-and-alerting.md#0-key-decisions-summary)), with the answers he gave in its review the same day.*

- <a id="dec-cm-01"></a>**DEC-CM-01** · The Owner of a Resource sets up its monitoring themselves, not the Data Team: an absolute requirement. The Data Team coaches, sets sensible defaults and adds SQL Metrics, but does not build. Who may is a Permission of its own: `monitors.manage`, on the Resources of their Owner Units or on every Resource, and `monitors.sql` for SQL Metrics ([The Permissions](12-permissions-and-library-cards.md#monitoring)). *Decided on 2026-11-07, by Max: a new Permission.*
- <a id="dec-cm-02"></a>**DEC-CM-02** · A Resource has one Monitor, set up by its Owner, and every Rule on it falls under that Owner. There is no monitoring per team: different business follow-ups are more Breakdowns and Rules of the same Monitor. There are no Monitors on Lenses, now or later. *Decided on 2026-11-07, by Max: "no monitor on lenses, never".*
- <a id="dec-cm-03"></a>**DEC-CM-03** · A Monitor is a chain, each link holding one or more of the next: a Resource has one Monitor; a Monitor has one or more Breakdowns; a Breakdown, one or more Metrics; a Metric, one or more Rules; a Rule, one or more Actions, which happen when it fires. The Breakdown comes first because it bounds both what its query reads, the period on its time column, and what it groups by, its bucket and its Segments; everything after it works on its result. A Metric can be kept without a Rule, to look at and to draw ([FR-CM-05](#fr-cm-05)). *Decided on 2026-11-07, by Max, in the review of the screens; this replaces the chain in four steps, Resource, Segments, Metrics and Rules, recorded earlier that day. The name Breakdown, for what Max called "aggregation and segmentation", is proposed in the review and still to confirm ([OP-CM-09](#op-cm-09)).*
- <a id="dec-cm-04"></a>**DEC-CM-04** · Every Breakdown runs one aggregation query on the Resource, and its Metrics and Rules work on its result, its Aggregate Table. A Rule or a derived Metric costs nothing in BigQuery; a base Metric on a field the query does not read yet adds only that field; another time column, bucket or set of Segments is another Breakdown, with a query of its own. *Changed on 2026-11-07, by Max, with [DEC-CM-03](#dec-cm-03): one query per Breakdown, no longer one per Monitor.*
- <a id="dec-cm-05"></a>**DEC-CM-05** · A Metric and its evaluation are separate. A count is the simplest Metric; the value lies in the evaluation, such as a z-score, a moving average or a comparison with the same period. The classic checks of data quality are Metrics with a comparison, not kinds of check of their own. Freshness of the content is no kind of its own either: it is a count of zero in the latest bucket, and Data Hub derives how old the newest row is as soon as a Monitor has a time column.
- <a id="dec-cm-06"></a>**DEC-CM-06** · Data Hub does not compute the freshness of the pipeline: it learns from dbt Cloud whether and how a run failed. The webhook Data Hub already receives also takes in runs that did not succeed, and Data Hub reads the outcome of every model from their `run_results.json`, for every job that builds the table, not only the Source Job. Nothing changes in the dbt projects. An Artifact Set stays the Artifacts of a successful run of a Source Job. *Decided on 2026-11-07, by Max.*
- <a id="dec-cm-07"></a>**DEC-CM-07** · Segmentation belongs to the Breakdown, not to one kind of Metric. A Rule is written once and holds for every value of its Segments, future ones included: the Segment is a grouping in the Rule, not a list of things to set up. Its baseline is computed within each value, not across them.
- <a id="dec-cm-08"></a>**DEC-CM-08** · A Rule that fires gives a Finding, and its Actions happen. A Finding is not bad news by definition: monitoring is "tell me when this happens", and whether that is good or bad, the Owner says with the Tone of the Rule. Only Quarantine is a problem in itself. A Signal keeps its meaning, a User reporting that the data of a Resource seems wrong. *Decided on 2026-11-07, by Max: the term Finding, as Signal is taken; the brainstorm called it a signal.*
- <a id="dec-cm-09"></a>**DEC-CM-09** · Who hears a Finding, and how far it goes, are the Actions of its Rule, a setting apart from its Tone: tell the Owner, tell the Consumers, gather it in a digest, or Quarantine. An Action has no condition of its own: when a Rule fires, all its Actions happen. The ladder of the brainstorm, three thresholds bounding four zones on one Metric, is several Rules on that Metric with growing thresholds, each with Actions that reach further, drawn as one ladder ([FR-CM-24](#fr-cm-24)). *Decided on 2026-11-07, by Max, in the review of the screens: a Rule has one or more Actions. This replaces the Escalation, the term chosen earlier that day for the four zones, as "bereik", the word of the brainstorm, is the range of a Pre-flight in the Dutch texts of the app.*
- <a id="dec-cm-10"></a>**DEC-CM-10** · Quarantine always holds the whole Resource, never one Segment, and only its Owner lifts it, by an explicit act, never by itself when the figure recovers: a recovery can itself be the bug.
- <a id="dec-cm-11"></a>**DEC-CM-11** · The Operational Status is an axis of its own, next to the Level and the confidentiality: healthy, a Finding in its Tone, or Quarantine. Neither a Finding nor Quarantine lowers the Level ([DEC-MR-04](06-maturity-and-release.md#dec-mr-04)): being able to quarantine is a mark of very mature data, and must not punish the Owner for good behaviour.
- <a id="dec-cm-12"></a>**DEC-CM-12** · A Resource is 5 · Monitored as soon as its Monitor has at least one active Rule, and drops to 4 · Explored when the last one is switched off. This is what "an active check" of [DEC-MR-03](06-maturity-and-release.md#dec-mr-03) means. The working session with the Data Team for the first Monitor is the way of working, not a gate in the software ([FR-CM-31](#fr-cm-31)). *Decided on 2026-11-07, by Max.*
- <a id="dec-cm-13"></a>**DEC-CM-13** · Monitoring is built as the next part after the launch of Data Hub in prod, after its screens are designed: 5 · Monitored becomes reachable. This replaces [DEC-MR-13](06-maturity-and-release.md#dec-mr-13). *Decided on 2026-11-07, by Max: "specify, design, build next".*
- <a id="dec-cm-14"></a>**DEC-CM-14** · The first version stays small: the Actions that tell the Owner and the Consumers, and three comparisons: absolute, z-score and the same period. Quarantine, the comparisons relative to a window and persistence, changepoints, seasonal baselines, reconciliation and referential integrity come after; each is marked *Could, not in v1* below.
- <a id="dec-cm-15"></a>**DEC-CM-15** · The Owner chooses when each Breakdown evaluates, by default after each of its buckets: daily for a day, hourly for an hour; the timing of dbt is a given they need not follow. A bucket is never judged before the Stability of its Resource allows, without the Owner setting it. So Stability, left out of version 1 ([FR-RC-06](05-resource-card.md#fr-rc-06)), comes in with monitoring.
- <a id="dec-cm-16"></a>**DEC-CM-16** · The aggregation query of a Breakdown runs as Data Hub on a schedule, not as a User, and keeps to the free range: up to 100 MB per run it runs; above that, the Data Team accepts the Breakdown once, as a Request, and again when its query grows past what was accepted. *Decided on 2026-11-07, by Max.*
- <a id="dec-cm-17"></a>**DEC-CM-17** · Referential integrity, the orphans compared with a related Resource, reads a second Resource, as reconciliation does: neither can come from the aggregation query of a Breakdown. Both compare Metrics of two Monitors, and both come after the first version. *Decided on 2026-11-07, by Max. Raised in the review: the brainstorm named reconciliation as the only check that needs a second Monitor.*
- <a id="dec-cm-18"></a>**DEC-CM-18** · The Aggregate Table of a Breakdown is a Resource of its own, so that Lenses, charts and Claude can use it as any other. How it enters the catalogue, now that a table becomes a Resource only through its dbt project ([DEC-SR-22](04-stacks-and-resources.md#dec-sr-22)), is still open ([OP-CM-01](#op-cm-01)). *Decided on 2026-11-07, by Max.*
- <a id="dec-cm-19"></a>**DEC-CM-19** · The way in for an Owner is the guided flow in Data Hub, starting from the Monitor Data Hub proposes; Claude, through the MCP, can draft a Monitor, or a Breakdown to add to it, from one sentence and open that flow filled in, and the Owner saves it in Data Hub. The aim: "I want to keep an eye on the number of credit leads per day per partner, and hear when it drops unusually" is enough as input. *Decided on 2026-11-07, by Max.*
- <a id="dec-cm-20"></a>**DEC-CM-20** · The screens do not hide the statistics, they teach them: the Owner must understand what "two standard deviations" is, as that is the knob they will turn for months.
- <a id="dec-cm-21"></a>**DEC-CM-21** · Tuning a Monitor is a loop, not a one-off setup: the history of every Rule, feedback on every Finding, and a periodic review with the Data Team, supported by Data Hub and by Claude. It is the librarian's role of the Data Team: coaching, not building.
- <a id="dec-cm-22"></a>**DEC-CM-22** · Monitoring serves two aims with the same machinery: guarding the data, and following the running business through it, such as "which estate agents grow strongly". A Rule can therefore give a list, gathered in a digest by its Action, as well as a Finding.
- <a id="dec-cm-23"></a>**DEC-CM-23** · A business User builds a Monitor in seven steps of one question each: Resource, How often, Period, Per, Measure, Boundaries and Reactions. Monitoring is always time-based: every check runs at a moment, looks at a period, and its results form a line over time; for a Resource without a time to count by, that line is made of the moments Data Hub measured, without history at the start. The Owner never builds a Breakdown as such: Data Hub derives it, its bucket from how often and the period, its Segments from the per, and reuses one that matches. The time a Resource is counted by is set by the Data Team in Data Hub, its partition column by default; the Owner sees it, and does not choose it. *Decided on 2026-11-07, by Max, in the brainstorm on the screens: "I tend to think in different steps, the build-up is mentally easier". This refines how [DEC-CM-03](#dec-cm-03) reaches the Owner; the chain itself stays.*
- <a id="dec-cm-24"></a>**DEC-CM-24** · Every boundary says what it is compared with: a fixed number, its own past (the periods before it, or a usual weekday), all values together, or everything before. The words follow the comparison: against a fixed number it is higher or lower than; against the past it rises or drops. The kinds of boundary are a fixed limit; a change in %, with a minimum in units so that 3 becoming 1 is no −66%; unusual, by rank, such as "the lowest in 12 weeks", or in standard deviations; something new, a value that appears; something silent, a value that stops longer than it ever did; and the top N. For a check of one day, a usual weekday, the same weekday over the 4 weeks before, is the proposed comparison. *Decided on 2026-11-07, by Max, in the brainstorm on the screens. Which kinds come in the first version is [OP-CM-10](#op-cm-10).*
- <a id="dec-cm-25"></a>**DEC-CM-25** · Defaults of the brainstorm on the screens. For an amount, the typical value, the median, is proposed before the average, as one very large value does not move it. A measure across several fields is a condition built in the monitor, such as "email is empty and phone is empty"; what a condition cannot say is a SQL measure the Data Team writes in the monitor, in Data Hub ([DEC-CM-26](#dec-cm-26)). Something new and something silent judge a value at once, without the warm-up of [FR-CM-08](#fr-cm-08). The screens say "per" for a Segment, "per lead source", and "only" for a filter, "only KBC"; the filter is in the first version. *Decided on 2026-11-07, by Max, in the brainstorm on the screens. Changed the same day, by Max: a measure across fields no longer goes to the dbt project ([DEC-CM-26](#dec-cm-26)).*
- <a id="dec-cm-26"></a>**DEC-CM-26** · Monitoring and alerting are part of Data Hub, not of dbt. A monitor, its measures, boundaries and reactions are made and kept in Data Hub, and never need a change in a dbt project: no field, model, test or exposure is asked of it for a monitor. Data Hub reads what dbt gives, its Artifacts and the outcome of its runs ([DEC-CM-06](#dec-cm-06)), and writes nothing back. *Decided on 2026-11-07, by Max: "I do not like the idea that Data Hub is managing dbt. I would like the monitor and alert to be part of the hub, not dbt."*
- <a id="dec-cm-27"></a>**DEC-CM-27** · A monitor counts in days or in weeks, not in months. It checks every day, on weekdays only, or once a week on a day of the Owner's choice, at a time. It looks at yesterday or the last 7, 14, 21 or 28 days, or at last week or the last 2, 3 or 4 weeks; over more than one, day by day, week by week or as one period. *Decided by Max, in the review of the picture of a monitor, recorded on 2026-11-09: "periodicity: day, day of the week; window: 7, 14, 21, 28 days", and "I don't think that months are useful". Whether it also checks every hour is [OP-CM-12](#op-cm-12); whether a week is a calendar week is [OP-CM-13](#op-cm-13).*
- <a id="dec-cm-28"></a>**DEC-CM-28** · The times a monitor checks at are one list for every monitor, kept in Terraform, each with a scheduled job of its own: the Owner chooses one of them, never any time. *Decided on 2026-11-10, by Max: "because we will be adding cron jobs to it, we define a list in Terraform, and these are the options that somebody can select". Which times is [OP-CM-14](#op-cm-14).*

## Terms

The Defined Terms of this domain are in the [definitions](../../definitions.md): [Monitor](../../definitions.md#monitor), [Breakdown](../../definitions.md#breakdown), [Segment](../../definitions.md#segment), [Metric](../../definitions.md#metric), [Aggregate Table](../../definitions.md#aggregate-table), [Rule](../../definitions.md#rule), [Action](../../definitions.md#action), [Finding](../../definitions.md#finding), [Tone](../../definitions.md#tone), [Quarantine](../../definitions.md#quarantine), [Operational Status](../../definitions.md#operational-status), [Health Overview](../../definitions.md#health-overview) and [Run Status](../../definitions.md#run-status).

| Word | Meaning here |
| --- | --- |
| bucket | One period of the time column of a Breakdown: an hour, a day or a week; a day is the norm |
| base Metric | An aggregate of the aggregation query, per Segment value per bucket: count, sum, count distinct, average, minimum, maximum, null rate |
| derived Metric | A Metric computed from base Metrics, without touching the Resource: composed (the ratio of two) or windowed (a moving average, a z-score, the same weekday 1 or 4 weeks earlier) |
| warm-up | The history a new Segment value needs before its Rules evaluate it |
| backfill | The one run of a Breakdown that reads its history, when it is saved or its Metrics change; every other run reads only the buckets that are new or still settling |
| ladder | Several Rules on one Metric with the same comparison and growing thresholds, drawn as one |
| digest | The Findings of a Rule that gives a list, delivered together, daily or weekly |

## Flow

1. **The Owner builds a Monitor**, one Breakdown at a time, in six steps, starting from what Data Hub proposes or from a draft of Claude ([FR-CM-20](#fr-cm-20)).
2. **On its schedule**, each Breakdown runs its aggregation query over the buckets that are new or still settling, and keeps the result in its Aggregate Table ([FR-CM-04](#fr-cm-04), [FR-CM-39](#fr-cm-39)).
3. **Every Rule is evaluated** on the Aggregate Table of its Breakdown, per Segment value, for the buckets the Stability allows ([FR-CM-07](#fr-cm-07), [FR-CM-11](#fr-cm-11)).
4. **A Rule that fires gives a Finding**, in its Tone, in the Log of the Resource, and its Actions happen: those it tells hear it ([FR-CM-19](#fr-cm-19), [FR-CM-34](#fr-cm-34)).
5. **The Owner marks each Finding** useful or noise, and tunes the Rules, with the Data Team and Claude ([FR-CM-17](#fr-cm-17), [FR-CM-18](#fr-cm-18)).

## Requirements

### Run Status

<a id="fr-cm-01"></a>
### FR-CM-01 · The Run Status of a Resource, from dbt Cloud

**Status:** Specified · **Source:** [REQ-DH-MON-RUN](../../workshops/2026-11-07-monitoring-and-alerting.md#req-dh-mon-run) · **Screens:** [monitor](../../design/screens/monitor.html)

For every run of a job that builds a Resource, Data Hub keeps its outcome for that Resource: succeeded, failed with an error, or skipped because an upstream model failed ([DEC-CM-06](#dec-cm-06)). On a failure, it keeps the error message, the failing model and the run ID. Data Hub writes it in plain language in the Log of the Resource, with a link to the run in dbt Cloud for the Data Team. On "skipped", it follows the lineage upstream and names the model that actually broke, so that the Owner does not have to search for it. This changes what [FR-AR-19](01-artifact-registry.md#fr-ar-19) says of a run that did not succeed: it is no longer only ignored.

### The Monitor

<a id="fr-cm-02"></a>
### FR-CM-02 · The Owner builds the Monitor

**Status:** Specified · **Source:** [REQ-DH-MON-OWNER](../../workshops/2026-11-07-monitoring-and-alerting.md#req-dh-mon-owner)

A User with the Permission `monitors.manage` builds and changes the Monitor of a Resource, its Breakdowns, Metrics, Rules and Actions, on the Resources of their Owner Units, or on every Resource if their Permission goes that far ([DEC-CM-01](#dec-cm-01)). A User with `monitors.sql` adds SQL Metrics. A Resource has one Monitor ([DEC-CM-02](#dec-cm-02)).

<a id="fr-cm-03"></a>
### FR-CM-03 · A Monitor, from Breakdown to Action

**Status:** Specified · **Source:** [REQ-DH-MON-CHAIN](../../workshops/2026-11-07-monitoring-and-alerting.md#req-dh-mon-chain) · **Screens:** [monitor](../../design/screens/monitor.html), [monitor-build](../../design/screens/monitor-build.html)

A Monitor holds, each link one or more of the next ([DEC-CM-03](#dec-cm-03)):

1. **The Resource** it watches, which has this one Monitor.
2. **Its Breakdowns:** each a time column, the size of a bucket, an hour, a day or a week, a day by default, and the Segments it cuts along, such as partner, source, region or property type, at most three ([OP-CM-06](#op-cm-06)). A Breakdown is named after them, such as "daily, by lead source and partner", which the Owner can change.
3. **Per Breakdown, its Metrics:** per field, the aggregates it computes ([FR-CM-05](#fr-cm-05)).
4. **Per Metric, its Rules:** the conditions that give a Finding ([FR-CM-12](#fr-cm-12)).
5. **Per Rule, its Actions:** what happens when it fires ([FR-CM-13](#fr-cm-13)).

The same Resource watched per hour and per day, or by partner and by region, is two Breakdowns of its one Monitor.

<a id="fr-cm-04"></a>
### FR-CM-04 · One aggregation query and one Aggregate Table per Breakdown

**Status:** Specified · **Source:** [REQ-DH-MON-AGG](../../workshops/2026-11-07-monitoring-and-alerting.md#req-dh-mon-agg)

On its schedule, a Breakdown runs one query on its Resource, grouped by its time bucket and its Segments, and computes in it the base Metrics of its fields. The result is its Aggregate Table: one row per Segment value per bucket ([DEC-CM-04](#dec-cm-04)). It is the only part that reads the Resource; everything after it works on the Aggregate Table. So one Breakdown feeds several follow-ups at once, such as the average asking price, the average price per m² and the volume, from the same Breakdown of listings. The query gets a Query ID in the Query Log, as every query does ([FR-LN-05](07-log-and-notifications.md#fr-ln-05)).

<a id="fr-cm-05"></a>
### FR-CM-05 · Metrics in two layers

**Status:** Specified · **Source:** [REQ-DH-MON-METRIC](../../workshops/2026-11-07-monitoring-and-alerting.md#req-dh-mon-metric) · **Screens:** [monitor](../../design/screens/monitor.html), [monitor-build](../../design/screens/monitor-build.html)

A Metric belongs to one Breakdown. It is a base Metric, an aggregate of its query per Segment value per bucket, or a derived Metric, computed from base Metrics of the same Breakdown without reading the Resource again: composed, the ratio of two, such as leads per visitor or price per m², or windowed, a moving average over N buckets, a z-score against the rolling average and standard deviation over N buckets, or the same weekday 1 or 4 weeks earlier. An Owner builds them from templates, without SQL, chosen per field in the words of its type ([DEC-CM-25](#dec-cm-25), [OP-CM-03](#op-cm-03)): for every row, how many; for a number, typical (the median), average, total, smallest, largest and how often empty; for text or a category, how often empty, how many different and how often a given value; for a date, how often empty and how old the newest is; for yes or no, the share of yes; a condition on one or more fields, such as "email is empty and phone is empty", built from a field, a comparison (is empty, is not empty, is, is not, higher than, lower than) and all or any of them, giving the share of rows that meet it; and the ratio of two. A count, a total and a share add up across buckets, so a longer period comes from the same query; a median and a number of different values do not, and Data Hub computes them over the period itself. The Data Team adds SQL Metrics for the rest, in the monitor, in Data Hub; nothing is added to the dbt project for it ([DEC-CM-26](#dec-cm-26)). A Metric exists without a Rule: it is visible in Data Hub and can be drawn as a chart of semgraph.

<a id="fr-cm-06"></a>
### FR-CM-06 · The classic checks are Metrics

**Status:** Specified · **Source:** [REQ-DH-MON-TYPES](../../workshops/2026-11-07-monitoring-and-alerting.md#req-dh-mon-types)

The classic checks of data quality are a Metric with a comparison, not kinds of check of their own ([DEC-CM-05](#dec-cm-05)):

- **completeness:** the null rate, or the share of empty values, of a field;
- **uniqueness:** the number of duplicates of an identifier, or of a combination of fields;
- **validity:** the share of rows outside an allowed set, pattern or range;
- **drift:** a Metric of the distribution, such as the average, the median or the shares of categories, evaluated by z-score;
- **a custom SQL assertion:** a number the Data Team defines, evaluated as any other Metric.

Referential integrity and reconciliation read a second Resource and come after the first version ([FR-CM-35](#fr-cm-35), [FR-CM-36](#fr-cm-36)).

<a id="fr-cm-07"></a>
### FR-CM-07 · A Rule holds for every Segment value

**Status:** Specified · **Source:** [REQ-DH-MON-SEGMENT](../../workshops/2026-11-07-monitoring-and-alerting.md#req-dh-mon-segment) · **Screens:** [monitor-build](../../design/screens/monitor-build.html)

Every Metric and Rule of a Breakdown is computed per value of its Segments. A Rule is written once, against each value's own history, and evaluated for every value, future ones included: "the number of properties per estate agent per day may not deviate more than 2.5 standard deviations from that agent's rolling average" covers a new estate agent without the Owner changing anything ([DEC-CM-07](#dec-cm-07)). The baseline is computed within each value, so a small estate agent is not judged against a large one. A Rule can be limited to some values; by default it holds for all.

<a id="fr-cm-08"></a>
### FR-CM-08 · A new Segment value warms up first

**Status:** Specified · **Source:** [REQ-DH-MON-SEGMENT](../../workshops/2026-11-07-monitoring-and-alerting.md#req-dh-mon-segment) · **Screens:** [monitoring-start](../../design/screens/monitoring-start.html), [monitor-build](../../design/screens/monitor-build.html)

A new Segment value is only evaluated once it has the history its Breakdown asks, four weeks of buckets by default, which the Owner can change. Until then it is in warm-up, and the section Monitoring shows what is ([FR-CM-29](#fr-cm-29)).

<a id="fr-cm-09"></a>
### FR-CM-09 · An exception for one Segment value

**Status:** Specified · **Source:** [REQ-DH-MON-SEGMENT](../../workshops/2026-11-07-monitoring-and-alerting.md#req-dh-mon-segment) · **Screens:** [monitor-build](../../design/screens/monitor-build.html)

An Owner can give one Segment value another threshold, as an exception on top of the Rule, shown as such: never the norm.

<a id="fr-cm-10"></a>
### FR-CM-10 · The level above and the total, in the same pass

**Status:** Specified · **Source:** [REQ-DH-MON-LEVELS](../../workshops/2026-11-07-monitoring-and-alerting.md#req-dh-mon-levels) · **Screens:** [monitor-build](../../design/screens/monitor-build.html)

The aggregation query of a Breakdown computes, besides each Segment value, the level above it and the total, in the same pass ([OP-CM-06](#op-cm-06)). A Rule can combine them: the share of an estate agent in the total, or its growth compared with the total growth. So "this estate agent dropped" becomes "this estate agent dropped while the market did not".

<a id="fr-cm-11"></a>
### FR-CM-11 · No judgement before the data is stable

**Status:** Specified · **Source:** [REQ-DH-MON-DELAY](../../workshops/2026-11-07-monitoring-and-alerting.md#req-dh-mon-delay) · **Screens:** [monitor-build](../../design/screens/monitor-build.html)

For data that is still settling, a bucket is only judged once the Stability of its Resource says it is final, for example "stable = D-3" ([FR-RC-06](05-resource-card.md#fr-rc-06)). This follows from the Stability by itself; the Owner does not set it ([DEC-CM-15](#dec-cm-15)). So no Finding comes from data that is still coming in.

### Rules and Findings

<a id="fr-cm-12"></a>
### FR-CM-12 · A Rule: a comparison and a threshold on its Metric, a Tone and its Actions

**Status:** Specified · **Source:** [REQ-DH-MON-RULE](../../workshops/2026-11-07-monitoring-and-alerting.md#req-dh-mon-rule) · **Screens:** [monitor-build](../../design/screens/monitor-build.html)

A Rule belongs to one Metric. It is one expression: a comparison and a threshold on that Metric, with the Segment values it holds for, a Tone, and one or more Actions ([FR-CM-13](#fr-cm-13)). The screens call it a boundary, and write it as a sentence: "when it drops 30% compared with the 4 weeks before" ([OP-CM-11](#op-cm-11)). It is compared with ([DEC-CM-24](#dec-cm-24)):

- **a fixed number:** higher or lower than a value;
- **its own past:** the periods before it, such as the 4 weeks before, or a usual weekday, the same weekday over the 4 weeks before; it rises or drops by a percentage, with a minimum in units;
- **all values together:** its share of the total, or its change against the change of the total ([FR-CM-10](#fr-cm-10));
- **everything before:** a value that appears for the first time.

Its kinds: a fixed limit; a change; unusual, by rank, such as "the lowest in 12 weeks", or as a z-score, more than N standard deviations from its rolling average; something new; something silent, a value that stops for longer than ever in N weeks; and the top N, the values that rose most, which gives a list ([FR-CM-14](#fr-cm-14)). Two more come later:

- **relative to a window:** the Metric deviates more than X% from its own moving average over N buckets;
- **persistence:** one of the above holds for N buckets in a row, which turns a noisy daily check into a trend.

Which kinds the first version has is [OP-CM-10](#op-cm-10); [DEC-CM-14](#dec-cm-14) named absolute, z-score and the same period.

*Could, not in v1 for the comparisons relative to a window and persistence: set on 2026-11-07, by Max ([DEC-CM-14](#dec-cm-14)).*

<a id="fr-cm-13"></a>
### FR-CM-13 · The Actions and the Tone, two settings

**Status:** Specified · **Source:** [REQ-DH-MON-TONE](../../workshops/2026-11-07-monitoring-and-alerting.md#req-dh-mon-tone) · **Screens:** [monitor-build](../../design/screens/monitor-build.html)

What the brainstorm first called severity is two settings of a Rule. Its Actions say who hears a Finding and how far it goes ([DEC-CM-09](#dec-cm-09)); a Rule has one or more, and when it fires, all of them happen:

- **Tell the Owner:** the Owner Unit of the Resource hears it ([FR-CM-34](#fr-cm-34)).
- **Tell the Consumers:** every Consumer of the Resource hears it too, through the lineage of Lenses and Reports ([FR-LN-03](07-log-and-notifications.md#fr-ln-03)), and the Resource, and everything built on it, carries a visible mark in the Tone of the Rule while the Finding is open ([FR-CM-27](#fr-cm-27)).
- **Gather in a digest:** the Findings of the Rule come together, daily or weekly, rather than one by one ([FR-CM-14](#fr-cm-14)).
- **Quarantine:** the Resource is no longer served ([FR-CM-25](#fr-cm-25)).

The screens call them reactions, and name them for the Owner: message me, in my list, tell the Consumers, block it ([OP-CM-11](#op-cm-11)). Every Finding is kept in the Log, whatever its Actions ([FR-CM-19](#fr-cm-19)). The Tone is a label the Owner gives the Rule, which sets the icon and colour of its Findings in a Message, on the Resource page and in a digest: **opportunity**, **informative**, **attention** or **problem** ([DEC-CM-08](#dec-cm-08)). The same Rule, estate agents growing more than 20%, can be an opportunity to an Owner in sales and attention to an Owner of capacity. A Rule with the Action Quarantine has the Tone problem.

<a id="fr-cm-14"></a>
### FR-CM-14 · A Rule can give a list

**Status:** Specified · **Source:** [REQ-DH-MON-LIST](../../workshops/2026-11-07-monitoring-and-alerting.md#req-dh-mon-list) · **Screens:** [monitoring-start](../../design/screens/monitoring-start.html), [monitor-build](../../design/screens/monitor-build.html)

A Rule that evaluates per Segment value can give the set of values it holds for, such as "the estate agents that grew more than 20% compared with their average over four weeks". With the Action "gather in a digest", its Findings come together, daily or weekly, rather than one by one: a list to read, not a problem to solve ([DEC-CM-22](#dec-cm-22), [OP-CM-02](#op-cm-02)).

<a id="fr-cm-15"></a>
### FR-CM-15 · The statistics shown and explained

**Status:** Specified · **Source:** [REQ-DH-MON-SENSITIVITY](../../workshops/2026-11-07-monitoring-and-alerting.md#req-dh-mon-sensitivity) · **Screens:** [monitor-build](../../design/screens/monitor-build.html)

The screens explain every comparison in words, and show a z-score and its window as they are, behind "unusual", with an explanation, not only as "low, normal, high", and link in context to the Learning Cards on them ([DEC-CM-20](#dec-cm-20), [FR-CM-32](#fr-cm-32)). The Data Team sets the defaults: a z-score of 2 and a window of 28 days.

<a id="fr-cm-16"></a>
### FR-CM-16 · Every Rule shows its history and its band

**Status:** Specified · **Source:** [REQ-DH-MON-HISTORY](../../workshops/2026-11-07-monitoring-and-alerting.md#req-dh-mon-history) · **Screens:** [monitor-build](../../design/screens/monitor-build.html)

While a Rule is made or edited, Data Hub shows its Metric over the past 12 weeks, the band the Rule draws around it, and the days the Rule would have fired. Changing a threshold redraws the band at once: a band around a line is how a standard deviation becomes intuitive.

<a id="fr-cm-17"></a>
### FR-CM-17 · Useful or noise, for every Finding

**Status:** Specified · **Source:** [REQ-DH-MON-FEEDBACK](../../workshops/2026-11-07-monitoring-and-alerting.md#req-dh-mon-feedback) · **Screens:** [monitoring-start](../../design/screens/monitoring-start.html), [monitor](../../design/screens/monitor.html)

The Owner marks a Finding useful or noise. From those marks Data Hub proposes adjustments to the Rule, such as "this Rule fired 9 times, 7 times noise; consider widening the threshold to 2.5".

<a id="fr-cm-18"></a>
### FR-CM-18 · The Health Overview of a Monitor

**Status:** Specified · **Source:** [REQ-DH-MON-REVIEW](../../workshops/2026-11-07-monitoring-and-alerting.md#req-dh-mon-review) · **Screens:** [monitor](../../design/screens/monitor.html)

Every Monitor has a Health Overview, across its Breakdowns: Rules that never fire, Rules that fire constantly, Findings marked noise, Segment values with too little data to mean anything, and what each Breakdown reads. The Data Team reviews it with the Owner, for example after the first month ([OP-CM-04](#op-cm-04)). Claude reads the same overview through the MCP and proposes adjustments in plain language, which the Owner accepts or changes ([DEC-CM-21](#dec-cm-21)).

<a id="fr-cm-19"></a>
### FR-CM-19 · Every Finding in the Log

**Status:** Specified · **Source:** [REQ-DH-MON-LOG](../../workshops/2026-11-07-monitoring-and-alerting.md#req-dh-mon-log) · **Screens:** [monitor](../../design/screens/monitor.html)

Every Finding is written to the Log of its Resource, in order of time, readable by people and by Claude, with the Query ID of the aggregation query of the Breakdown it came from, and the Actions that happened. A Finding with the Tone problem is an incident in the sense of [DEC-MR-04](06-maturity-and-release.md#dec-mr-04).

### The way in

<a id="fr-cm-20"></a>
### FR-CM-20 · Seven steps to build a Monitor, over its picture

**Status:** Specified · **Source:** [REQ-DH-MON-FLOW](../../workshops/2026-11-07-monitoring-and-alerting.md#req-dh-mon-flow) · **Screens:** [monitor-build](../../design/screens/monitor-build.html)

An Owner builds a Monitor in seven steps, one question each ([DEC-CM-23](#dec-cm-23)):

1. **Resource.** Data Hub says whether it has a Monitor already, so that the Owner adds to it rather than starting another, and which time it counts by, as the Data Team set it ([FR-CM-39](#fr-cm-39)).
2. **How often:** every day, weekdays only, or once a week on a day, at what time ([FR-CM-21](#fr-cm-21), [DEC-CM-27](#dec-cm-27)).
3. **Period:** yesterday or the last 7, 14, 21 or 28 days, or last week or the last 2, 3 or 4 weeks; over more than one, day by day, week by week or as one period ([FR-CM-11](#fr-cm-11)).
4. **Per:** all together, or for each value of a field, and only some values if the Owner wants ([FR-CM-07](#fr-cm-07)).
5. **Measure:** one or more, each a field and how to measure it ([FR-CM-05](#fr-cm-05)).
6. **Boundaries:** per measure, what it is compared with, and one or more boundaries, with a minimum to be judged ([EC-CM-02](#ec-cm-02)), and how often they would have warned in the past 12 weeks ([FR-CM-12](#fr-cm-12), [FR-CM-16](#fr-cm-16), [FR-CM-24](#fr-cm-24)).
7. **Reactions:** per boundary its Actions and its Tone ([FR-CM-13](#fr-cm-13)), and what a check reads ([FR-CM-33](#fr-cm-33)).

Above the steps stands the picture of the monitor: a strip of tiles, conceptual and not the data, that ends with today and gains one layer per step, with a row per measure and its boundaries under it, and under that the sentence that reads the monitor back, such as "Every day at 08:00, look at the number of leads in Credit lead creations, per lead source, over the last 7 days, day by day. When it drops 30% compared with the 4 weeks before: message me." Each part of the picture and of the sentence opens its step ([DEC-UX-195](../../design/principles.md#dec-ux-195)). The page of a Monitor shows the same picture whole, and a part of it clicked opens its choices in a floating window ([DEC-UX-196](../../design/principles.md#dec-ux-196)).

<a id="fr-cm-21"></a>
### FR-CM-21 · The Owner chooses when it evaluates

**Status:** Specified · **Source:** [REQ-DH-MON-SCHEDULE](../../workshops/2026-11-07-monitoring-and-alerting.md#req-dh-mon-schedule) · **Screens:** [monitor-build](../../design/screens/monitor-build.html)

The Owner chooses when each Breakdown evaluates, such as daily at 08:00, without aligning with the runs of dbt ([DEC-CM-15](#dec-cm-15)); by default after each of its buckets. The times to choose from are those of the list in Terraform ([DEC-CM-28](#dec-cm-28)). If the Resource has not been refreshed since the last evaluation, Data Hub evaluates the data of the previous run and says so, rather than seeing a false drop. The delay from the Stability still holds ([FR-CM-11](#fr-cm-11)).

<a id="fr-cm-22"></a>
### FR-CM-22 · Starting from a proposal, not from an empty screen

**Status:** Specified · **Source:** [REQ-DH-MON-PROPOSAL](../../workshops/2026-11-07-monitoring-and-alerting.md#req-dh-mon-proposal) · **Screens:** [monitor-build](../../design/screens/monitor-build.html)

From what it knows of the Resource, its EDA, Stability, Entity and identifier ([FR-RC-08](05-resource-card.md#fr-rc-08)) and the types of its fields, Data Hub proposes a Monitor with one Breakdown: by day on its partition column, by its most obvious Segment, with the count, the null rate of its key fields and the count distinct of its identifier, and a Rule by z-score that tells the Owner. The Owner reviews and prunes rather than builds.

<a id="fr-cm-23"></a>
### FR-CM-23 · Claude drafts a Monitor from one sentence

**Status:** Specified · **Source:** Max, 2026-11-07, in the review of the brainstorm ([DEC-CM-19](#dec-cm-19)) · **Screens:** [monitor-build](../../design/screens/monitor-build.html)

From a sentence such as "I want to keep an eye on the number of credit leads per day per partner, and hear when it drops unusually", Claude, through the MCP, drafts the Monitor of that Resource, or a Breakdown or Rule to add to its Monitor, and opens the flow of [FR-CM-20](#fr-cm-20) filled in. The Owner checks it and saves it in Data Hub; Claude saves nothing.

<a id="fr-cm-24"></a>
### FR-CM-24 · Several Rules on one Metric, drawn as a ladder

**Status:** Specified · **Source:** [REQ-DH-MON-LADDER](../../workshops/2026-11-07-monitoring-and-alerting.md#req-dh-mon-ladder) · **Screens:** [monitor-build](../../design/screens/monitor-build.html)

An Owner can give one Metric several Rules with the same comparison and growing thresholds, each with Actions that reach further ([DEC-CM-09](#dec-cm-09)), such as leads per partner per day:

- **within 2 standard deviations:** no Rule fires; nothing is told;
- **beyond 2:** a Rule that tells the Owner;
- **beyond 3:** a Rule that tells the Owner and the Consumers;
- **beyond 4:** a Rule that quarantines the Resource.

Data Hub shows them together: in the picture of the monitor as boundaries beside the measure, each with its reactions, and on the chart of the past 12 weeks as bands, so the Owner sets them against each other; adding one further out is one step from there. A day beyond 3 fires both the Rules of 2 and of 3: it gives one Finding, of the Rule furthest out and in its Tone, and the Actions of both happen. Each Rule keeps its own Tone and the Segment values it holds for; a Rule that quarantines holds for all ([DEC-CM-10](#dec-cm-10)).

<a id="fr-cm-25"></a>
### FR-CM-25 · Quarantine holds the whole Resource

**Status:** Specified · **Source:** [REQ-DH-MON-QUARANTINE](../../workshops/2026-11-07-monitoring-and-alerting.md#req-dh-mon-quarantine)

The Action Quarantine holds the whole Resource, never one Segment value ([DEC-CM-10](#dec-cm-10)). In Quarantine, a Resource is not served: a query or Preview of it, in Data Hub and through the MCP, gives a clear message naming its Owner instead of data, and the Lenses on it do not run. Only its Owner lifts it, with an explanation. If the problem is limited to one Segment value, lifting it is a matter of documenting: a Known Gap, an Anomaly, the Rules of that value adjusted. The Log records both the start and the lifting, with the Owner's explanation.

*Could, not in v1: set on 2026-11-07, by Max ([DEC-CM-14](#dec-cm-14)).*

<a id="fr-cm-26"></a>
### FR-CM-26 · The Operational Status of a Resource

**Status:** Specified · **Source:** [REQ-DH-MON-STATUS](../../workshops/2026-11-07-monitoring-and-alerting.md#req-dh-mon-status) · **Screens:** [monitor](../../design/screens/monitor.html)

Every Monitored Resource has an Operational Status: healthy, a Finding in its Tone, or Quarantine. It moves with the Findings and leaves the Level alone ([DEC-CM-11](#dec-cm-11)).

<a id="fr-cm-27"></a>
### FR-CM-27 · What a Consumer sees

**Status:** Specified · **Source:** [REQ-DH-MON-INHERIT](../../workshops/2026-11-07-monitoring-and-alerting.md#req-dh-mon-inherit)

Everything built on a Resource takes over its Operational Status: the card of a Lens, the page of a Report and a chart of semgraph show its open Findings of the Rules that tell the Consumers, in their Tone, next to the Query ID, with a link to the Log Entry. In Quarantine the Lens does not run, and says which Owner to ask ([OP-CM-07](#op-cm-07)).

### The place in Data Hub

<a id="fr-cm-28"></a>
### FR-CM-28 · The Resource page shows the status, not the setup

**Status:** Specified · **Source:** [REQ-DH-MON-CARD](../../workshops/2026-11-07-monitoring-and-alerting.md#req-dh-mon-card) · **Screens:** [resource-overview](../../design/screens/resource-overview.html)

The page of a Resource shows what a reader needs to know whether to trust it now: its Operational Status, its Level, a compact strip of its Findings of the last 30 days, and a link to its Log, with one button that opens its Monitor in the section Monitoring. Setting up the Monitor is not on that page. This is how the page shows the checks and incidents of [FR-RC-14](05-resource-card.md#fr-rc-14).

<a id="fr-cm-29"></a>
### FR-CM-29 · The section Monitoring, the Owner's cockpit

**Status:** Specified · **Source:** [REQ-DH-MON-COCKPIT](../../workshops/2026-11-07-monitoring-and-alerting.md#req-dh-mon-cockpit) · **Screens:** [monitoring-start](../../design/screens/monitoring-start.html)

A section Monitoring gives a User the Monitors of the Resources they may manage, across Resources: what gave a Finding today, what is open, the lists and digests ([FR-CM-14](#fr-cm-14)), the Rules to adjust, the Segment values in warm-up, the Health Overviews ([FR-CM-18](#fr-cm-18)), and the place to build or edit a Monitor. Every Finding links back to the page of its Resource: the same things, two ways in.

<a id="fr-cm-30"></a>
### FR-CM-30 · Suggestions to the Owner

**Status:** Specified · **Source:** [REQ-DH-MON-NUDGE](../../workshops/2026-11-07-monitoring-and-alerting.md#req-dh-mon-nudge) · **Screens:** [monitoring-start](../../design/screens/monitoring-start.html)

The section Monitoring crosses the Query Log, the lineage of Lenses and Reports and the Monitors, and suggests to the Owner:

- **coverage:** Resources used a lot without a Monitor, by how much they are used, such as "queried 140 times last month, feeds three public Lenses, no Monitor";
- **the quality of the monitoring:** Rules that never fire, Rules that always fire, Findings marked noise;
- **drift of the data:** Segment values that appeared or disappeared since the Monitor was built, such as a new partner in warm-up.

It speaks as the Owner's creed does, "people rely on this", not "you forgot this". A suggestion the Owner dismisses stays quiet for a while.

### Adoption

<a id="fr-cm-31"></a>
### FR-CM-31 · The first Monitor with the Data Team

**Status:** Specified · **Source:** [REQ-DH-MON-ONBOARD](../../workshops/2026-11-07-monitoring-and-alerting.md#req-dh-mon-onboard)

The first Monitor on a Resource is set up in a working session of its Owner with the Data Team, as the step towards 5 · Monitored: coaching, not building. It is the way of working; Data Hub does not ask for it ([DEC-CM-12](#dec-cm-12)).

<a id="fr-cm-32"></a>
### FR-CM-32 · Reading your own figures, in the Learning Centre

**Status:** Specified · **Source:** [REQ-DH-MON-LEARN](../../workshops/2026-11-07-monitoring-and-alerting.md#req-dh-mon-learn)

The [Learning Centre](16-learning.md) gets a short, practical topic on reading your own figures: what a moving average does, what a standard deviation looks like on a chart of leads per day, why Monday differs from Sunday, and when a drop is noise and when it is a Finding. It is given on the Owner's own Resource, not on toy data, ideally in the session of [FR-CM-31](#fr-cm-31); the history with its band is the exercise ([FR-CM-16](#fr-cm-16)). Claude tutors on request, such as "why did this Rule fire" or "what would a z-score of 2.5 have caught last month", answered from the Aggregate Table.

### Cost and notification

<a id="fr-cm-33"></a>
### FR-CM-33 · The aggregation query keeps to the free range

**Status:** Specified · **Source:** Max, 2026-11-07, in the review of the brainstorm ([DEC-CM-16](#dec-cm-16)) · **Screens:** [monitor](../../design/screens/monitor.html), [monitor-build](../../design/screens/monitor-build.html)

While building a Breakdown, the Owner sees the Pre-flight of its aggregation query: how much one run reads, its backfill, and per month at its schedule ([FR-CM-39](#fr-cm-39)). Up to 100 MB per run, the Breakdown runs. Above that, saving it sends a Request to the Data Team, and it runs once accepted; its other Breakdowns run meanwhile. The backfill is read once and counts as a run of its own. When the query grows past what was accepted, it stops, its Owner hears, and a new Request goes to the Data Team.

<a id="fr-cm-39"></a>
### FR-CM-39 · A Breakdown reads only what is new

**Status:** Specified · **Source:** Max, 2026-11-07, in the review of the screens ([DEC-CM-03](#dec-cm-03)) · **Screens:** [monitor-build](../../design/screens/monitor-build.html)

The time column of a Breakdown bounds what its query reads, besides what it groups by. A run reads only the buckets that are new since the last run, and those its Stability still holds open ([FR-CM-11](#fr-cm-11)), and writes them into the Aggregate Table; the windows and z-scores of its Metrics and Rules are computed on the Aggregate Table, not on the Resource. Once, when a Breakdown is saved or its Metrics change, a backfill reads its history: the window of its longest Metric and its warm-up, 12 weeks by default.

The Data Team sets the time column of a Resource once, its partition column by default, from how it is stored ([FR-CO-34](03-collections.md#fr-co-34)); the Owner sees it in the first step and does not choose it ([DEC-CM-23](#dec-cm-23)). On another column, BigQuery cannot leave out the partitions outside the period, so every run reads the whole table: Data Hub says so to the Data Team when they set it, with what one run reads on either column.

<a id="fr-cm-34"></a>
### FR-CM-34 · Notifications follow the Actions

**Status:** Specified · **Source:** [§8 of the brainstorm](../../workshops/2026-11-07-monitoring-and-alerting.md#8-notification-not-yet-worked-out)

A Finding is told to whom the Actions of its Rule name, as a notification of Data Hub ([DEC-LN-02](07-log-and-notifications.md#dec-ln-02)), in the Tone of its Rule; to the Owner, it reaches the whole Owner Unit ([FR-LN-01](07-log-and-notifications.md#fr-ln-01)). Someone named by several Rules that fire on the same bucket hears it once. With the Action "gather in a digest", the Findings come together ([FR-CM-14](#fr-cm-14)). The channels and the rhythm of the digests are [OP-CM-02](#op-cm-02).

### After the first version

<a id="fr-cm-35"></a>
### FR-CM-35 · Reconciliation across two Monitors

**Status:** Specified · **Source:** [REQ-DH-MON-RECON](../../workshops/2026-11-07-monitoring-and-alerting.md#req-dh-mon-recon)

A Rule can compare a Metric of the Monitor of one Resource with a Metric of the Monitor of another, so that two independent sources give the same number, such as the credit leads in BigQuery and those delivered to KBC ([DEC-CM-17](#dec-cm-17)).

*Could, not in v1: set on 2026-11-07, by Max ([DEC-CM-14](#dec-cm-14)).*

<a id="fr-cm-36"></a>
### FR-CM-36 · Referential integrity across two Monitors

**Status:** Specified · **Source:** [REQ-DH-MON-TYPES](../../workshops/2026-11-07-monitoring-and-alerting.md#req-dh-mon-types)

A Rule can count the orphans of a Resource compared with a related Resource, related through an Entity and its identifier ([FR-RC-08](05-resource-card.md#fr-rc-08)), from the Monitors of both ([DEC-CM-17](#dec-cm-17)).

*Could, not in v1: set on 2026-11-07, by Max ([DEC-CM-17](#dec-cm-17)).*

<a id="fr-cm-37"></a>
### FR-CM-37 · The Aggregate Table is a Resource

**Status:** Specified · **Source:** Max, 2026-11-07, in the review of the brainstorm ([DEC-CM-18](#dec-cm-18)) · **Screens:** [monitor](../../design/screens/monitor.html)

The Aggregate Table of every Breakdown is a Resource of its own, which Lenses, charts and Claude use as any other Resource. How it enters the catalogue, in which Collection and with which Level, is [OP-CM-01](#op-cm-01).

<a id="fr-cm-38"></a>
### FR-CM-38 · Changepoints and seasonal baselines

**Status:** Specified · **Source:** [REQ-DH-MON-RULE](../../workshops/2026-11-07-monitoring-and-alerting.md#req-dh-mon-rule)

A Rule can detect a sudden shift in level, a changepoint, and compare with a seasonal baseline rather than a rolling one.

*Could, not in v1: set on 2026-11-07, by Max ([DEC-CM-14](#dec-cm-14)).*

## Edge cases

*Proposed on 2026-11-07, in the review of the brainstorm; not in the brainstorm itself.*

<a id="ec-cm-01"></a>
### EC-CM-01 · A field a Metric uses disappears

**Status:** Proposed · **Screens:** [monitor](../../design/screens/monitor.html)

When a field a Breakdown reads, in a Metric or as a Segment, is removed or renamed in the Resource, its aggregation query fails. The Breakdown stops as a whole, its other Breakdowns go on, as a Lens that reads a field that went is Broken ([FR-SR-52](04-stacks-and-resources.md#fr-sr-52)); its Owner hears, and the Operational Status says that a Breakdown stopped, not that the Resource is healthy. Its Rules are not evaluated until the Owner adjusts it.

<a id="ec-cm-02"></a>
### EC-CM-02 · A Segment value with too little data

**Status:** Proposed · **Screens:** [monitor-build](../../design/screens/monitor-build.html)

Small values swing wildly: 3 leads becoming 1 is −66%, and a typical amount over 9 leads is noise. Every measure therefore has a minimum to be judged, "only a lead source with at least 10 leads in the period", which Data Hub proposes from its history and the Owner can change. A Segment value below it gives no Finding of a change or of unusual, and shows in the Health Overview as not judged ([FR-CM-18](#fr-cm-18)), so the Owner can choose a fixed limit for it, or leave it out. Something new and something silent still judge it.

<a id="ec-cm-03"></a>
### EC-CM-03 · The Resource of a Monitor is withdrawn or deprecated

**Status:** Proposed

When its Resource is withdrawn, a Monitor stops and is kept; it resumes when the Resource comes back. A deprecated Resource is still monitored: it still works, and its Consumers still rely on it.

<a id="ec-cm-04"></a>
### EC-CM-04 · The run that builds the Resource failed

**Status:** Proposed · **Screens:** [monitor](../../design/screens/monitor.html)

When the last run that builds a Resource failed or skipped it ([FR-CM-01](#fr-cm-01)), its Monitor still evaluates at its time, on the data of the last successful run, and says so with the Run Status, rather than see a false drop ([FR-CM-21](#fr-cm-21)).

## Out of scope

- The monitoring of Data Hub itself: its services, their health and their costs ([OP-DH-53](../../overview/backlog.md#op-dh-53)).
- Monitors on Lenses: never ([DEC-CM-02](#dec-cm-02)).
- The automatic checks after a Change that follow from an EDA ([DEC-DH-29](../../overview/data-hub.md#dec-dh-29), [OP-DH-19](../../overview/open-themes.md#op-dh-19)): with the domain [EDA](15-eda.md).
- How a Finding of the Owner relates to a Signal of a User, and whether a Finding can become an Anomaly as a Signal can: to settle when the screens are designed.

## Open points

*Raised on 2026-11-07, in the review of the brainstorm.*

- [ ] <a id="op-cm-01"></a>**OP-CM-01** · Decide how the Aggregate Table of a Breakdown enters the catalogue as a Resource ([DEC-CM-18](#dec-cm-18)), now that a table becomes a Resource only through an exposure in its dbt project ([DEC-SR-22](04-stacks-and-resources.md#dec-sr-22)), while an Owner builds a Monitor without dbt. Proposal: saving a Breakdown registers its Aggregate Table as a Resource in the Collection of the monitored Resource, with the same Owner, published when that one is, and at most the Level of the monitored Resource: a second way in beside dbt, for Aggregate Tables only, as an exception to [DEC-SR-22](04-stacks-and-resources.md#dec-sr-22). The alternative keeps one way in: the Data Team declares each Aggregate Table in dbt as a source with an exposure, so every new Breakdown waits on a pull request. *Raised on 2026-11-07, in the review; left open by Max.* *Since [DEC-CM-26](#dec-cm-26), the alternative of a pull request per monitor no longer fits; what stays open is whether the proposal is taken, and in which Collection and at which Level the Aggregate Table is registered.*
- [ ] <a id="op-cm-02"></a>**OP-CM-02** · Decide the channels and the rhythm of Findings and digests ([FR-CM-34](#fr-cm-34)), the brainstorm's "channel (Slack, Data Hub itself, both)". Proposal: as every notification of Data Hub ([DEC-LN-02](07-log-and-notifications.md#dec-ln-02)): at once, in Data Hub, by e-mail and in Slack, by the User's own settings; a Rule sets only its Actions and Tone. Digests daily at 08:00, or weekly on Monday, as the Rule says.
- [ ] <a id="op-cm-03"></a>**OP-CM-03** · Decide which Metric templates an Owner gets without SQL, and how the Data Team adds a SQL Metric (brainstorm, §9). Proposal: the templates of [FR-CM-05](#fr-cm-05); a SQL Metric is an aggregate expression over the rows of the Resource, typed by the Data Team in the Monitor and checked by a dry run, so that it stays part of the aggregation query of its Breakdown.
- [ ] <a id="op-cm-04"></a>**OP-CM-04** · Decide the rhythm and form of the review of a Monitor with the Data Team (brainstorm, §9). Proposal: after the first month, then every quarter, from its Health Overview, with Claude's proposals in hand.
- [ ] <a id="op-cm-05"></a>**OP-CM-05** · Decide how long an Aggregate Table keeps its history (brainstorm, §9). Proposal: 400 days, enough for the same weekday a year earlier, which a seasonal baseline needs later ([FR-CM-38](#fr-cm-38)).
- [ ] <a id="op-cm-06"></a>**OP-CM-06** · Decide what "the level above" a Segment value is when a Breakdown has several Segments ([FR-CM-10](#fr-cm-10)). Proposal: the Segments in the order the Owner sets, each level the one before it, as a rollup, plus the total; at most three Segments per Breakdown.
- [ ] <a id="op-cm-07"></a>**OP-CM-07** · Decide whether a chart of semgraph shows a stamp "data up to" next to its Query ID ([FR-CM-27](#fr-cm-27)); the brainstorm left it to confirm.
- [ ] <a id="op-cm-08"></a>**OP-CM-08** · Decide which jobs Data Hub follows for the Run Status ([FR-CM-01](#fr-cm-01)), now that it reads only the Source Job of each dbt project ([DEC-AR-09](01-artifact-registry.md#dec-ar-09)). Proposal: every job of a dbt project Data Hub follows that builds its tables, CI jobs excepted; the webhook in dbt Cloud names them too, and the page Webhooks shows them apart from the Source Job.
- [ ] <a id="op-cm-09"></a>**OP-CM-09** · Confirm the name of what Max called "aggregation and segmentation" ([DEC-CM-03](#dec-cm-03)): one time column, one bucket and its Segments, which is one query and one Aggregate Table. Proposal: **Breakdown** (Dutch: uitsplitsing), as an Owner reads it, "credit leads, daily, by partner". Considered: Aggregation, which is also what a Metric does; Grain, which a Resource already has ([FR-CO-33](03-collections.md#fr-co-33)); Slice and Cut, which say the segmenting but not the period. *Raised on 2026-11-07, in the review of the screens.* Less pressing since [DEC-CM-23](#dec-cm-23): an Owner does not see a Breakdown as such; the screens name one by its period and what it is per.
- [ ] <a id="op-cm-10"></a>**OP-CM-10** · Decide which kinds of boundary the first version has ([DEC-CM-24](#dec-cm-24)); [DEC-CM-14](#dec-cm-14) named absolute, z-score and the same period. Proposal: a fixed limit, a change against the past or a usual weekday with its minimum in units, unusual by rank, something new and something silent; the top N, unusual in standard deviations, relative to a window and persistence after it. *Raised on 2026-11-07, in the brainstorm on the screens.*
- [ ] <a id="op-cm-11"></a>**OP-CM-11** · Decide the names of the steps as Defined Terms. The screens, in Max's words of the brainstorm, say boundary for a Rule and reaction for an Action. Proposal: rename the Defined Terms Rule to Boundary and Action to Reaction, so the screens and the documents speak the same words; the alternative keeps Rule and Action and lets the screens say rule and action. *Raised on 2026-11-07, in the brainstorm on the screens.*
- [ ] <a id="op-cm-12"></a>**OP-CM-12** · Decide whether a monitor can check every hour. [DEC-CM-15](#dec-cm-15) and the bucket name an hour; the variants Max listed name a day and a day of the week ([DEC-CM-27](#dec-cm-27)). Proposal: not in the first version, as few Resources are refreshed more than once a day and an hour of data is seldom stable; the screens show "every hour" greyed, as later. *Raised on 2026-11-09, in the review of the picture.*
- [ ] <a id="op-cm-13"></a>**OP-CM-13** · Decide what a week is. Proposal: a calendar week, Monday to Sunday, so that a weekly check on any day looks at the last complete week, week by week lines up with the weeks of the strip, and the picture can group the weeks by month, as Max asked; the alternative is a block of 7 days back from each check, which a daily check of the last 7 days already is. *Raised on 2026-11-09, in the review of the picture.*
- [ ] <a id="op-cm-14"></a>**OP-CM-14** · Decide the times of the list in Terraform ([DEC-CM-28](#dec-cm-28)). Proposal: 06:00, 08:00, 12:00 and 17:00, in Belgian time: early enough to know before the working day, after the night runs of dbt, at noon, and before the end of the day; each is one scheduled job, which checks every monitor set to it. *Raised on 2026-11-10, with DEC-CM-28.*
- [ ] <a id="op-cm-15"></a>**OP-CM-15** · Decide what a check judges over a window of more than one day or week, such as the last 7 days, day by day, with the measure "average". Proposal: a measure is always computed over the rows of what is judged, as if it were one bucket, never as an average of averages. Day by day, the last 7 days give seven values, one per day, such as the average requested amount of the leads of that day; as one, one value over every lead of the 7 days, so a busy day weighs more than a quiet one. What it is compared with has the same shape: a day against the days before it, the 7 days as one against the periods of 7 days before them. Day by day, each check judges only the days it has not judged yet, the newest complete day for a daily check and the seven days of last week for a weekly one, so that one dip gives one Finding and not seven; the other days of the window are drawn and count for a boundary over several days, such as three days in a row, which comes after the first version. As one, a daily check judges a window that moves one day each morning, so one bad day weighs on seven checks in a row: a Finding then stays one Finding, open while the boundary still holds, rather than a new one each morning. Either way, a day without rows counts as zero, from a calendar, so that a value that goes silent is never left out. *Raised on 2026-11-10, by a question of Max on the window: "what will be evaluated at that point?"*

## Builds on

- [Data Hub overview](../../overview/data-hub.md)
- [Maturity and release](06-maturity-and-release.md): the Levels, 5 · Monitored among them
- [Resource card](05-resource-card.md): the Stability, the Log and the Known Behaviour
- [Log and notifications](07-log-and-notifications.md): the Consumers, the Query ID and the channels
- [Permissions](12-permissions-and-library-cards.md): who may manage a Monitor
- [Brainstorm of 2026-11-07](../../workshops/2026-11-07-monitoring-and-alerting.md): where every requirement above comes from
