# Brainstorm monitoring and alerting on Resources, 2026-11-07

| | |
| --- | --- |
| Type | Source: the requirements for monitoring and alerting on Resources, from a brainstorm |
| Date | 2026-11-07 |
| Status | Proposal by Max, refined on 2026-11-07 in a review with Claude Code; recorded as the domain [Checks and monitoring](../requirements/functional/08-checks-and-monitoring.md) |
| Origin | Brainstorm Max × Claude, 7 November 2026 (claude.ai, project ptditt) |
| Taken in | 2026-11-07, translated from Dutch |

**In one sentence:** what "Monitored" concretely asks of Data Hub, as Max proposed it after a brainstorm, and where each item is recorded in this repository.

*It builds on the requirements of the [workshop of 2026-10-22](2026-10-22-data-agents-and-governance.md) (REQ-DH-META, REQ-DH-OWNERS, REQ-DH-NOTIFY-\*, REQ-DH-SQLLOG, REQ-DH-DOCS). Each item is translated faithfully, followed by the requirements it became. Where the review of 2026-11-07 changed an item, that is said under it; nothing is silently fixed.*

*Two words of the brainstorm became other terms, because Data Hub already uses them ([definitions](../definitions.md)): "signaal", for a rule that fires, became **Finding**, as a Signal is a Message from a User that data seems wrong ([DEC-CM-08](../requirements/functional/08-checks-and-monitoring.md#dec-cm-08)); "bereik", who hears it, became the **Actions** of a Rule, as "bereik" is the range of a Pre-flight in the Dutch texts of the app ([DEC-CM-09](../requirements/functional/08-checks-and-monitoring.md#dec-cm-09)). The review of the screens, the same day, changed the chain of the brainstorm: what it called the segments became a **Breakdown**, of which a Monitor can have several, each with its own Metrics, Rules and Actions ([DEC-CM-03](../requirements/functional/08-checks-and-monitoring.md#dec-cm-03)). The translation below keeps "signal" and "reach" in lower case, as the brainstorm wrote them.*

Context: on the maturity ladder, Explored (EDA) comes before Monitored. Monitoring therefore always assumes an EDA on the Resource. These requirements describe what "Monitored" concretely asks of Data Hub.

## 0. Key decisions (summary)

1. **Business owners configure monitoring themselves**, not the Data Team. An absolute requirement.
2. **One owner per Resource** sets up everything that is monitored on that Resource. No monitoring per team; different business follow-ups are simply several rules of the same owner.
3. The architecture is a chain in four steps: **Resource → segments → metrics → rules**.
4. **One monitor per Resource** runs one cheap aggregation query; every metric and rule works on that aggregate. Owners can add metrics and rules without extra BigQuery cost.
5. **Metric and evaluation are separate.** A count is the simplest metric; the value lies in the evaluation (z-score, moving average, comparison with the same period).
6. **Pipeline freshness comes from the dbt hooks** and is not computed by Data Hub. What Data Hub needs is whether and how a run failed.
7. **Content freshness is not a type of its own**: it is the degenerate form of a volume metric (zero in the most recent bucket). Data Hub derives "how old is the newest record" as soon as a monitor has a time column.
8. **Segmentation is a general feature** of the monitor, not of one type of metric.
9. **Tuning is a fixed loop**, not a one-off setup: history per rule, feedback per alert, a periodic review with the Data Team, supported by software and Claude.
10. The interface does not hide the statistics but **teaches them**: the owner must understand what "two standard deviations" is, because that is the knob they will be turning for months.
11. **A rule is written once and holds for every segment value**, future ones included. The segment is a grouping variable in the rule, not a list of things to configure.
12. **A signal is not negative by definition.** Monitoring is "tell me when this happens"; whether that is good or bad news, the owner decides through a tone on the rule. Only quarantine is a problem in itself. In the glossary: *signal* for the general case, *alert* only for the tone "attention".
13. Monitoring serves two aims at once: **guarding the data** and **following the running business** through the data (for example "which estate agents grow strongly"). A strong owner does both with the same machinery.

**Recorded as:** [DEC-CM-01](../requirements/functional/08-checks-and-monitoring.md#dec-cm-01) (1), [DEC-CM-02](../requirements/functional/08-checks-and-monitoring.md#dec-cm-02) (2), [DEC-CM-03](../requirements/functional/08-checks-and-monitoring.md#dec-cm-03) (3, changed in the review of the screens), [DEC-CM-04](../requirements/functional/08-checks-and-monitoring.md#dec-cm-04) (4, one query per Breakdown), [DEC-CM-05](../requirements/functional/08-checks-and-monitoring.md#dec-cm-05) (5, 7), [DEC-CM-06](../requirements/functional/08-checks-and-monitoring.md#dec-cm-06) (6), [DEC-CM-07](../requirements/functional/08-checks-and-monitoring.md#dec-cm-07) (8, 11), [DEC-CM-21](../requirements/functional/08-checks-and-monitoring.md#dec-cm-21) (9), [DEC-CM-20](../requirements/functional/08-checks-and-monitoring.md#dec-cm-20) (10), [DEC-CM-08](../requirements/functional/08-checks-and-monitoring.md#dec-cm-08) (12, with the term Finding instead of signal), [DEC-CM-22](../requirements/functional/08-checks-and-monitoring.md#dec-cm-22) (13).

## 1. Pipeline freshness and run status

<a id="req-dh-mon-run"></a>
### REQ-DH-MON-RUN · Run status per Resource from dbt hooks

Data Hub does not compute pipeline freshness itself but consumes the dbt hooks. Per run, Data Hub stores the outcome in three states: **succeeded**, **failed with an error**, and **skipped** because an upstream model failed. On failure, the hook passes on the error message, the failing model and the run ID. Data Hub writes this in plain language to the log of changes and Anomalies of the Resource (REQ-DH-META), with a link to the dbt run for the Data Team. Through the lineage, Data Hub points, on "skipped", to the model that actually broke, so that the owner does not have to search upstream themselves.

**Recorded as:** [FR-CM-01](../requirements/functional/08-checks-and-monitoring.md#fr-cm-01). "The dbt hooks" became the webhook of dbt Cloud that Data Hub already receives, extended to runs that did not succeed, with the outcome of every model read from `run_results.json`, for every job that builds the table ([DEC-CM-06](../requirements/functional/08-checks-and-monitoring.md#dec-cm-06), decided in the review); which jobs exactly is [OP-CM-08](../requirements/functional/08-checks-and-monitoring.md#op-cm-08).

## 2. The monitor

<a id="req-dh-mon-owner"></a>
### REQ-DH-MON-OWNER · The owner configures the monitoring

The owner of a Resource (a Google Workspace group, REQ-DH-OWNERS) configures the monitor, the segments, the metrics and the rules themselves. The Data Team coaches and adds SQL-defined metrics where wanted, but is not the builder. There is one monitor configuration per Resource; all rules on that Resource fall under the same owner.

**Recorded as:** [FR-CM-02](../requirements/functional/08-checks-and-monitoring.md#fr-cm-02), with who may as a Permission of its own ([DEC-CM-01](../requirements/functional/08-checks-and-monitoring.md#dec-cm-01), decided in the review).

<a id="req-dh-mon-chain"></a>
### REQ-DH-MON-CHAIN · Four steps: Resource, segments, metrics, rules

A monitor is built in this order:

1. **Resource**: the mart view (later also a Lens) that is monitored.
2. **Segments**: the dimensions along which it is cut (for example partner, source, region, property type), plus the time column and the bucket size (hour, day, week; day is the norm).
3. **Metrics**: per field, the aggregates that are computed (see REQ-DH-MON-METRIC).
4. **Rules**: conditions on metrics that give a warning or an alert (see REQ-DH-MON-RULE).

**Recorded as:** [FR-CM-03](../requirements/functional/08-checks-and-monitoring.md#fr-cm-03). Changed in the review of the screens, by Max: a Monitor has one or more Breakdowns, each a time column, a bucket and its segments; a Breakdown has one or more Metrics, a Metric one or more Rules, and a Rule one or more Actions ([DEC-CM-03](../requirements/functional/08-checks-and-monitoring.md#dec-cm-03)). "Later also a Lens" was decided against in the review: there are never monitors on Lenses ([DEC-CM-02](../requirements/functional/08-checks-and-monitoring.md#dec-cm-02)).

<a id="req-dh-mon-agg"></a>
### REQ-DH-MON-AGG · One aggregation query per monitor

The monitor runs one aggregation query on the Resource, grouped by the segment dimensions and the time bucket, and computes the **base aggregates** in it (count, sum, count distinct, average, min/max per field). The result is a small aggregate table per Resource: one row per segment per bucket. That is the only expensive part, and it runs once per schedule. Everything after it works on the aggregate table and no longer touches the source.

Consequence: one monitor feeds several business follow-ups at once (for example the average asking price, the average price per m² and the volume from the same listings monitor). The aggregate table is itself a legitimate asset that can be shown as a Lens or a semgraph.

**Recorded as:** [FR-CM-04](../requirements/functional/08-checks-and-monitoring.md#fr-cm-04), one query per Breakdown since the review of the screens; a run reads only what is new, after one backfill ([FR-CM-39](../requirements/functional/08-checks-and-monitoring.md#fr-cm-39)); its cost is kept in the free range ([FR-CM-33](../requirements/functional/08-checks-and-monitoring.md#fr-cm-33)), and the aggregate table becomes a Resource of its own ([FR-CM-37](../requirements/functional/08-checks-and-monitoring.md#fr-cm-37)), both decided in the review.

<a id="req-dh-mon-metric"></a>
### REQ-DH-MON-METRIC · Metrics in layers

Metrics exist in two layers on the aggregate table:

- **Base metrics**: the aggregates of REQ-DH-MON-AGG, per segment per bucket.
- **Derived metrics**: computed from base metrics without touching the source. Two kinds: *composed* (the ratio of two aggregates, for example leads per visitor, price per m²) and *windowed* (moving average over N buckets, z-score compared with the rolling average and the standard deviation over N buckets, comparison with the same weekday 1 or 4 weeks before).

Data Hub offers business a set of metric templates without SQL: count, null rate on a field, count distinct, sum, average, the ratio of two of these. The Data Team can add SQL-defined metrics for the rest.

Metrics exist independently of rules: they are visible in Data Hub also without a rule, and can be drawn through semgraph.

**Recorded as:** [FR-CM-05](../requirements/functional/08-checks-and-monitoring.md#fr-cm-05); the templates and how the Data Team adds a SQL Metric are [OP-CM-03](../requirements/functional/08-checks-and-monitoring.md#op-cm-03).

<a id="req-dh-mon-types"></a>
### REQ-DH-MON-TYPES · The classic kinds of check are metrics

The classic data quality checks are not built as types of their own but as a metric plus an evaluator:

- completeness → the null rate or share of empty values on a field;
- uniqueness → the number of duplicates on an identifier (combination);
- validity → the share of rows outside an allowed set, pattern or range;
- referential integrity → the number of orphans compared with the related Resource (through Entity and identifier, REQ-DH-RELATIES);
- drift → a distribution metric (average, median, category shares) with z-score evaluation;
- reconciliation → the difference between two totals (for example credit leads in BigQuery compared with the KBC export);
- custom SQL assertion → a number the Data Team defines, then evaluated like any other metric.

**Recorded as:** [FR-CM-06](../requirements/functional/08-checks-and-monitoring.md#fr-cm-06), without referential integrity and reconciliation: both read a second Resource, so they cannot come from the aggregation query of a Breakdown. They compare Metrics of two Monitors and come after the first version ([DEC-CM-17](../requirements/functional/08-checks-and-monitoring.md#dec-cm-17), [FR-CM-35](../requirements/functional/08-checks-and-monitoring.md#fr-cm-35), [FR-CM-36](../requirements/functional/08-checks-and-monitoring.md#fr-cm-36)). Raised in the review: REQ-DH-MON-RECON names reconciliation as the only check that needs a second monitor, while referential integrity needs one too.

<a id="req-dh-mon-segment"></a>
### REQ-DH-MON-SEGMENT · Segmentation as a general feature, rules hold per segment value

Segmentation belongs to the monitor and holds for every metric and rule on it. A rule is written **once**, in terms of the segment's own history, and is evaluated per segment value: "the number of properties per estate agent per day may not deviate more than 2.5 standard deviations from that agent's rolling average". A new estate agent is covered as soon as they have enough history; the owner does not have to change their monitoring when new data comes in. By default the baseline is computed within the segment value, not across it (a small estate agent is not judged against the large one).

- **Warm-up**: a new segment value is only evaluated after a configurable history (for example four weeks of buckets). The cockpit shows what is in warm-up.
- **Override**: if the owner wants another threshold for one segment value, that is an exception on top of the general rule, never the norm.
- **Scope**: a rule can be limited to certain segment values, but the default is "all".

**Recorded as:** [FR-CM-07](../requirements/functional/08-checks-and-monitoring.md#fr-cm-07), [FR-CM-08](../requirements/functional/08-checks-and-monitoring.md#fr-cm-08) and [FR-CM-09](../requirements/functional/08-checks-and-monitoring.md#fr-cm-09).

<a id="req-dh-mon-levels"></a>
### REQ-DH-MON-LEVELS · Metrics on several levels in the same aggregation

Besides the segment level, the aggregation also produces the level above and the total, in the same pass. A rule can combine them: the share of an estate agent in the total, or the growth of an estate agent compared with the total growth. So "this estate agent dropped" becomes the more relevant "this estate agent dropped while the market did not".

**Recorded as:** [FR-CM-10](../requirements/functional/08-checks-and-monitoring.md#fr-cm-10); what "the level above" is when a Monitor has several Segments is [OP-CM-06](../requirements/functional/08-checks-and-monitoring.md#op-cm-06).

<a id="req-dh-mon-delay"></a>
### REQ-DH-MON-DELAY · Evaluation delay from the Stability

For data that is still settling, a bucket is only judged after the Stability horizon of the Resource (for example "stable = D-3", REQ-DH-META). This follows automatically from the metadata; the owner does not have to set it separately. So we do not alert on data that is still coming in.

**Recorded as:** [FR-CM-11](../requirements/functional/08-checks-and-monitoring.md#fr-cm-11). Stability was left out of version 1 ([FR-RC-06](../requirements/functional/05-resource-card.md#fr-rc-06)); it comes in with monitoring ([DEC-CM-15](../requirements/functional/08-checks-and-monitoring.md#dec-cm-15)).

## 3. Rules and evaluation

<a id="req-dh-mon-rule"></a>
### REQ-DH-MON-RULE · A rule is metric + comparison + threshold + reach + tone

Every rule is one expression: a metric, a comparison, a threshold, a reach and a tone (REQ-DH-MON-TONE). Available comparisons:

- **absolute**: the metric above or below a fixed value;
- **relative to a window**: the metric deviates more than X% from its own moving average over N buckets;
- **z-score**: the metric lies more than N standard deviations from its rolling average; this is the default suggestion for fluctuating series (for example leads per day);
- **same period**: the metric deviates more than X% from the same weekday 1 or 4 weeks earlier;
- **persistence**: one of the conditions above holds for N consecutive buckets (it turns a noisy daily check into a trend alert).

Shared settings per rule: scope (all or specific segment values), reach, tone, and notification (channel).

Later: changepoint detection (a sudden shift in level) and seasonal baselines.

**Recorded as:** [FR-CM-12](../requirements/functional/08-checks-and-monitoring.md#fr-cm-12), with reach as the Actions of a Rule; the first version has three of the comparisons ([DEC-CM-14](../requirements/functional/08-checks-and-monitoring.md#dec-cm-14)); changepoint and seasonal baselines are [FR-CM-38](../requirements/functional/08-checks-and-monitoring.md#fr-cm-38).

<a id="req-dh-mon-tone"></a>
### REQ-DH-MON-TONE · Reach and tone are two separate settings

What was called "severity" before splits in two:

- **Reach**: who hears it and how far it goes: the owner alone, the owner and the Consumers, or blocking the Resource (quarantine). See REQ-DH-MON-LADDER.
- **Tone**: a label the owner gives the rule, which sets the icon and colour in the message, on the card and in the digest: **opportunity**, **informative**, **attention**, **problem**. Quarantine is the only state with a tone of its own (problem).

The same rule (estate agents growing more than 20%) can be labelled an opportunity by a sales owner and attention by a capacity owner; the machinery is the same, the meaning lies with the person.

**Recorded as:** [FR-CM-13](../requirements/functional/08-checks-and-monitoring.md#fr-cm-13), with reach as the Actions of a Rule ([DEC-CM-09](../requirements/functional/08-checks-and-monitoring.md#dec-cm-09)) and the Tone ([DEC-CM-08](../requirements/functional/08-checks-and-monitoring.md#dec-cm-08)).

<a id="req-dh-mon-list"></a>
### REQ-DH-MON-LIST · A rule can give a list, not only a signal

The outcome of a rule that evaluates per segment value can be a **set of segment values**: "which estate agents grew more than 20% compared with their average over four weeks". Such a rule gives a list, delivered as a daily or weekly digest instead of an alarm. It is the same mechanism as a threshold signal, with the difference that the result is read rather than solved.

**Recorded as:** [FR-CM-14](../requirements/functional/08-checks-and-monitoring.md#fr-cm-14).

<a id="req-dh-mon-sensitivity"></a>
### REQ-DH-MON-SENSITIVITY · Teach the statistics, do not hide them

The owner must learn to understand the z-score and the window, because they will adjust them for months (first too strict, then too loose). So the interface does not only translate into "low/normal/high", but shows the statistics with an explanation and links in context to the learning material (REQ-DH-DOCS, Competences). The Data Team sets sensible defaults (for example z-score 2, window 28 days).

**Recorded as:** [FR-CM-15](../requirements/functional/08-checks-and-monitoring.md#fr-cm-15), [DEC-CM-20](../requirements/functional/08-checks-and-monitoring.md#dec-cm-20).

<a id="req-dh-mon-history"></a>
### REQ-DH-MON-HISTORY · Every rule shows its history and band

When a rule is made and edited, Data Hub shows the metric over the past period (for example 12 weeks), the band the rule defines, and the days on which the rule would have fired. Changing a threshold redraws the band at once. This is the primary way to make a standard deviation intuitive: a band around a line.

**Recorded as:** [FR-CM-16](../requirements/functional/08-checks-and-monitoring.md#fr-cm-16).

<a id="req-dh-mon-feedback"></a>
### REQ-DH-MON-FEEDBACK · Feedback per signal

Every signal can be marked by the owner as **useful** or **noise**. Data Hub uses that feedback to propose adjustments (for example "this rule fired 9 times, 7 times noise; consider widening the threshold to 2.5").

**Recorded as:** [FR-CM-17](../requirements/functional/08-checks-and-monitoring.md#fr-cm-17), per Finding.

<a id="req-dh-mon-review"></a>
### REQ-DH-MON-REVIEW · A health overview of the monitoring for a periodic review

Per Resource, Data Hub makes a health overview of the monitoring: rules that never fire, rules that fire constantly, alerts marked as noise, segments with too little data to be statistically meaningful. The Data Team uses it for a periodic review with the owner (for example after the first month). Claude reads the same overview through the MCP (REQ-DH-MCP-SCOPE) and proposes adjustments in plain language, which the owner accepts or adjusts. This is the concrete form of the librarian role of the Data Team: coaching, not building.

**Recorded as:** [FR-CM-18](../requirements/functional/08-checks-and-monitoring.md#fr-cm-18); the rhythm and form of the review are [OP-CM-04](../requirements/functional/08-checks-and-monitoring.md#op-cm-04).

<a id="req-dh-mon-log"></a>
### REQ-DH-MON-LOG · Results in the log of Anomalies

Every rule evaluation that gives a warning or an alert is written, in chronological order, to the log of changes and Anomalies of the Resource (REQ-DH-META), readable by people and by Claude, with a reference to the Query ID of the monitor query (REQ-DH-SQLLOG).

**Recorded as:** [FR-CM-19](../requirements/functional/08-checks-and-monitoring.md#fr-cm-19), as every Finding.

<a id="req-dh-mon-recon"></a>
### REQ-DH-MON-RECON · Reconciliation across two monitors (roadmap)

Reconciliation (two independent sources must give the same number, for example credit leads in BigQuery compared with the delivery to KBC) asks for a rule that compares a metric of the monitor of Resource A with a metric of the monitor of Resource B. This is the only check that needs a cross-monitor reference; on the roadmap for the first version.

**Recorded as:** [FR-CM-35](../requirements/functional/08-checks-and-monitoring.md#fr-cm-35), with referential integrity next to it ([FR-CM-36](../requirements/functional/08-checks-and-monitoring.md#fr-cm-36), [DEC-CM-17](../requirements/functional/08-checks-and-monitoring.md#dec-cm-17)).

## 4. The flow on screen for the owner

<a id="req-dh-mon-flow"></a>
### REQ-DH-MON-FLOW · Six steps

1. **Choose the Resource.** Data Hub shows whether a monitor already exists on this Resource, so that you extend rather than duplicate.
2. **Segmentation.** Dimensions, time column, bucket size.
3. **Metrics.** Per field the base aggregates (count, average, distinct, sum, null rate, …) and per metric, optionally, one or more windows (moving average over N, z-score over N, the same weekday 1/4 weeks back). This gives the complete list of metrics.
4. **Preview.** The aggregates as a chart (semgraph) over the past period, before a rule is written. Here learning "a band around a line" begins.
5. **Rules.** Per metric the bounds and the severity (see REQ-DH-MON-LADDER), with the history and the band drawn live (REQ-DH-MON-HISTORY).
6. **Schedule.** Cadence, time, every day or only weekdays.

**Recorded as:** [FR-CM-20](../requirements/functional/08-checks-and-monitoring.md#fr-cm-20). Changed in the brainstorm on the screens, the same day, by Max: seven steps of one question each, Resource, How often, Period, Per, Measure, Boundaries and Reactions, over a picture of the monitor that builds up per step ([DEC-CM-23](../requirements/functional/08-checks-and-monitoring.md#dec-cm-23)).

<a id="req-dh-mon-schedule"></a>
### REQ-DH-MON-SCHEDULE · The owner chooses the time, the timing of dbt is a given

The owner chooses when the monitor evaluates (for example daily at 08:00). They do not have to align with the dbt run. Data Hub does protect against a silent mismatch: if the Resource has not been refreshed yet at the moment of evaluation, Data Hub evaluates on the previous run and says so explicitly, instead of computing a false drop. The evaluation delay from the Stability (REQ-DH-MON-DELAY) still applies automatically.

**Recorded as:** [FR-CM-21](../requirements/functional/08-checks-and-monitoring.md#fr-cm-21).

<a id="req-dh-mon-proposal"></a>
### REQ-DH-MON-PROPOSAL · Start from a proposal, not from an empty screen

Data Hub knows the EDA, the Stability, the Entity and identifier, and the field types of the Resource. From those it proposes a standard monitor: count per day, null rate on the key fields, count distinct on the identifier, segmented by the most obvious dimension, with z-score defaults. The owner reviews and prunes instead of building.

**Recorded as:** [FR-CM-22](../requirements/functional/08-checks-and-monitoring.md#fr-cm-22).

## 5. Escalation ladder and quarantine

<a id="req-dh-mon-ladder"></a>
### REQ-DH-MON-LADDER · Four zones of reach on the same metric

On a metric, an owner draws three thresholds that bound four zones of **reach**, not three separate rules:

- **Within the bounds**: nothing happens, but it is logged.
- **Owner**: only the owner gets the signal (Data Hub, optionally Slack).
- **Owner and Consumers**: all Consumers of the Resource are notified (through the lineage of Lenses and Reports, REQ-DH-NOTIFY-SCHEMA); the Resource gets a visible mark, in the tone of the rule, on its card and on everything built on it.
- **Quarantine**: the Resource is no longer served (see REQ-DH-MON-QUARANTINE).

The first three zones carry the tone of the rule (REQ-DH-MON-TONE) and can have a scope (all or specific segment values). Quarantine has no scope and is always a problem.

**Recorded as:** [FR-CM-24](../requirements/functional/08-checks-and-monitoring.md#fr-cm-24): since the review of the screens, the levels of the ladder are several Rules on one Metric, each with Actions that reach further ([DEC-CM-09](../requirements/functional/08-checks-and-monitoring.md#dec-cm-09)).

<a id="req-dh-mon-quarantine"></a>
### REQ-DH-MON-QUARANTINE · Quarantine is always the whole Resource

- Quarantine holds for the **whole Resource**, never per segment. No partial serving.
- In quarantine, queries through Data Hub and the MCP give a clear message instead of data; Lenses on it do not run; the message names the owner.
- Quarantine is **only lifted by an explicit act of the owner**, never automatically when the number recovers (a recovery can itself be the bug).
- If the problem is limited to one segment, the owner's follow-up is a documentation decision: record a Known Gap (REQ-DH-META), complete the log of Anomalies, adjust the rules of that segment if needed, and then lift the quarantine.
- The log of Anomalies records both the start and the lifting of the quarantine, with the owner's explanation.

**Recorded as:** [FR-CM-25](../requirements/functional/08-checks-and-monitoring.md#fr-cm-25) and [DEC-CM-10](../requirements/functional/08-checks-and-monitoring.md#dec-cm-10), after the first version ([DEC-CM-14](../requirements/functional/08-checks-and-monitoring.md#dec-cm-14)).

<a id="req-dh-mon-status"></a>
### REQ-DH-MON-STATUS · Operational status is a separate axis, not a drop in maturity

Being able to use quarantine is a property of **very mature** data; it must not punish the owner for good behaviour. So the Resource stays at Level Monitored and gets, next to maturity and confidentiality, a third axis: **operational status** (healthy, signal with tone, quarantine). Maturity only moves on structural events (for example a schema change), as already recorded.

**Recorded as:** [FR-CM-26](../requirements/functional/08-checks-and-monitoring.md#fr-cm-26) and [DEC-CM-11](../requirements/functional/08-checks-and-monitoring.md#dec-cm-11). Recorded already: a change to the schema does not lower the Level ([DEC-MR-08](../requirements/functional/06-maturity-and-release.md#dec-mr-08)); what still lowers it is a trace that goes, such as the last Rule switched off ([FR-MR-07](../requirements/functional/06-maturity-and-release.md#fr-mr-07)).

<a id="req-dh-mon-inherit"></a>
### REQ-DH-MON-INHERIT · What a Consumer sees

Everything built on a Resource inherits the operational status: Lens cards, Report pages and semgraph output show the active signals, in their tone, next to the Query ID, with a link to the Log Entry. In quarantine the Lens does not run and the message names the owner. For semgraph: a "data up to" stamp next to the Query ID (still to confirm).

**Recorded as:** [FR-CM-27](../requirements/functional/08-checks-and-monitoring.md#fr-cm-27); the stamp on semgraph output is [OP-CM-07](../requirements/functional/08-checks-and-monitoring.md#op-cm-07).

## 6. The place in the interface: the Resource Card and the cockpit

<a id="req-dh-mon-card"></a>
### REQ-DH-MON-CARD · The Resource Card shows status, not configuration

The card of a Resource in the Collection shows what you need to know whether you can trust it now: the operational status, the maturity, a compact health strip (for example the signals of the last 30 days) and a link to the log of Anomalies. Plus one button "open monitoring" to the cockpit. The configuration flow is **not** on the card; it would make it too heavy.

**Recorded as:** [FR-CM-28](../requirements/functional/08-checks-and-monitoring.md#fr-cm-28).

<a id="req-dh-mon-cockpit"></a>
### REQ-DH-MON-COCKPIT · A separate section Monitoring as the owner's cockpit

A separate section Monitoring is the owner's overview across Resources: what signalled today, what is open, the lists and digests of REQ-DH-MON-LIST, rules that need adjusting, the review overview (REQ-DH-MON-REVIEW), and the place to build or edit a monitor. Every signal links back to the Resource Card; the same objects, two ways in.

**Recorded as:** [FR-CM-29](../requirements/functional/08-checks-and-monitoring.md#fr-cm-29).

<a id="req-dh-mon-nudge"></a>
### REQ-DH-MON-NUDGE · Suggestions to the owner

The cockpit crosses the Query Log, the lineage of Lenses and Reports and the configuration of the monitors, and proposes suggestions to the owner of three kinds:

- **Coverage**: Resources that are used a lot but have no monitor, ranked by use ("queried 140 times last month, feeds three public Lenses, no monitor").
- **Quality of the monitoring**: rules that never fire, rules that always fire, signals marked as noise.
- **Drift of the data**: segment values that appeared or disappeared since the monitor was built (for example a new partner still in warm-up).

The tone is that of the owner's creed: "people rely on this", not "you forgot this". A suggestion that was dismissed stays quiet for a while.

**Recorded as:** [FR-CM-30](../requirements/functional/08-checks-and-monitoring.md#fr-cm-30).

## 7. Adoption and competences

<a id="req-dh-mon-onboard"></a>
### REQ-DH-MON-ONBOARD · The first monitor together with the Data Team

The first monitor on a Resource is set up in a working session owner × Data Team, as a fixed step in the promotion to Monitored. The librarian role in practice: coaching, not building.

**Recorded as:** [FR-CM-31](../requirements/functional/08-checks-and-monitoring.md#fr-cm-31). Decided in the review: the session is the way of working, not a gate in the software; a Resource is Monitored with one active Rule ([DEC-CM-12](../requirements/functional/08-checks-and-monitoring.md#dec-cm-12)).

<a id="req-dh-mon-learn"></a>
### REQ-DH-MON-LEARN · A module "reading your own figures" (Competences)

Many series at Immoscoop are elastic; whoever only knows min/max gets either a flood of alerts or bounds that catch nothing. So Competences gets a short, practical module: what a moving average does, what a standard deviation looks like on a chart of leads per day, why Monday differs from Sunday, when a drop is noise and when it is a signal. Given on the owner's own Resource, not on toy data, ideally in the same session as REQ-DH-MON-ONBOARD; the history-with-band screen is the exercise. Claude, through the MCP, plays tutor on request ("why did this rule fire", "what would a z-score of 2.5 have caught last month"), answered from the aggregate table.

**Recorded as:** [FR-CM-32](../requirements/functional/08-checks-and-monitoring.md#fr-cm-32), in the [Learning Centre](../requirements/functional/16-learning.md).

<a id="req-dh-mon-mvp"></a>
### REQ-DH-MON-MVP · Keep the first version small

First version: only the reaches owner, and owner and Consumers (quarantine after), and three evaluators: absolute, z-score and same period. Reconciliation and changepoint on the roadmap.

**Recorded as:** [DEC-CM-14](../requirements/functional/08-checks-and-monitoring.md#dec-cm-14), with referential integrity also after the first version ([DEC-CM-17](../requirements/functional/08-checks-and-monitoring.md#dec-cm-17)).

## 8. Notification (not yet worked out)

- Notification follows the reach (REQ-DH-MON-LADDER) and carries the tone (REQ-DH-MON-TONE). Lists (REQ-DH-MON-LIST) go as a digest. It is a setting on the rule, not a matter of ownership.
- Channel (Slack, Data Hub itself, both) still to discuss.

**Recorded as:** [FR-CM-34](../requirements/functional/08-checks-and-monitoring.md#fr-cm-34), with the channel and the rhythm of digests as [OP-CM-02](../requirements/functional/08-checks-and-monitoring.md#op-cm-02).

## 9. Open questions

- The form of the way in: a guided interface in Data Hub, a Claude skill through the MCP, or both. Aim: "I want to keep an eye on the number of credit leads per day per partner and hear when it drops unusually" must be enough as input. **Decided in the review:** both; the guided flow in Data Hub, and Claude drafts the monitor from that sentence and opens the flow filled in ([DEC-CM-19](../requirements/functional/08-checks-and-monitoring.md#dec-cm-19), [FR-CM-23](../requirements/functional/08-checks-and-monitoring.md#fr-cm-23)).
- Which metric templates business gets without SQL, and how the Data Team registers SQL metrics. **Recorded as** [OP-CM-03](../requirements/functional/08-checks-and-monitoring.md#op-cm-03).
- Monitoring on Lenses (not only on Resources): the same mechanism, inheriting the maturity, confidentiality and operational status of what lies beneath. **Decided in the review:** never ([DEC-CM-02](../requirements/functional/08-checks-and-monitoring.md#dec-cm-02)).
- The rhythm and form of the review with the Data Team. **Recorded as** [OP-CM-04](../requirements/functional/08-checks-and-monitoring.md#op-cm-04).
- How the aggregate table is opened up as an asset (Lens, semgraph) and with which retention. **Decided in the review:** it becomes a Resource ([DEC-CM-18](../requirements/functional/08-checks-and-monitoring.md#dec-cm-18)); how it enters the catalogue is [OP-CM-01](../requirements/functional/08-checks-and-monitoring.md#op-cm-01), its retention [OP-CM-05](../requirements/functional/08-checks-and-monitoring.md#op-cm-05).
