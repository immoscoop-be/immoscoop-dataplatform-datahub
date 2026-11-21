# EDA

| | |
| --- | --- |
| Domain | 15 of Data Hub · code `ED` |
| Status | First build implemented ([DEC-ED-26](#dec-ed-26)): the section EDA, the start of an EDA, its tab Steps, the detail of an EDA-Probe and four EDA-Probes. The other EDA-Probes, the list to add one, the tabs Overview and Profile, the EDA-Rerun, the EDA-Revalidation and Claude are still to work out |
| Source of truth | This file |
| Origin | Proposed as a new domain in [OP-MR-01](06-maturity-and-release.md#op-mr-01). Framed by Max on 2026-11-15, in the review of an EDA proposal by Marc of 2026-11-10. It started from the [EDA framework](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1352237168) on Confluence (Dutch); where the two differ, this file holds. |

**In one sentence:** the Owner of a Resource takes it, in Data Hub, through a predefined set of steps that explore the data itself, its gaps, its weight and its correctness, so that business understands the data before it decides what to monitor.

*Functional domain 15 of Data Hub. Overview of all domains: [Functional domains](README.md).*

## What the EDA is

The EDA is a function of Data Hub that lets business explore a Resource. The Resource is already in Data Hub (1 · Available), described by the Data Team (2 · Described), and described and published by business (3 · Confirmed). When an EDA is applied, its Owner takes the Resource through a predefined set of EDA-Steps in Data Hub. The EDA-Steps may differ with the kind of data, and each EDA-Step validates a part of the Resource. The EDA-Steps, their queries and their results all live in Data Hub. There is no pull request, no dbt and no separate tooling. Completing the EDA-Steps makes the Resource 4 · Explored.

**Why.** Levels 2 and 3 settle the form of the data: what a Resource is and what it stands for ([DEC-MR-07](06-maturity-and-release.md#dec-mr-07)). The EDA is about the data itself: understanding and documenting it, where its gaps are, where its weight lies, such as many large properties, and how correct it is. That understanding is a prerequisite for monitoring: only once the data is understood is it known what to monitor.

## Decisions

- <a id="dec-ed-01"></a>**DEC-ED-01** · The EDA is a function of Data Hub. Its Owner applies it to a Resource from 3 · Confirmed and takes the Resource through a predefined set of EDA-Steps, which may differ with the kind of data; each EDA-Step validates a part of the Resource. Completing the EDA-Steps makes the Resource 4 · Explored. *Decided on 2026-11-15, by Max.*
- <a id="dec-ed-02"></a>**DEC-ED-02** · The EDA explores the data itself, not its form: its gaps, where its weight lies and how correct it is. It is a prerequisite for monitoring a Resource, because only an understood Resource tells what to monitor. *Decided on 2026-11-15, by Max.*
- <a id="dec-ed-03"></a>**DEC-ED-03** · Everything of an EDA lives in Data Hub: its queries, its EDA-Profiles, its EDA-Setup, what triggers an EDA-Rerun or an EDA-Revalidation, and all communication about it. The queries run on BigQuery as reads; Data Hub writes nothing to BigQuery. An EDA never needs a change in a dbt project: no pull request, model, test or `meta`. *Decided on 2026-11-14 and 2026-11-15, by Max.*
- <a id="dec-ed-04"></a>**DEC-ED-04** · Claude is a conversational interface to the EDA, not a process of its own. Through the MCP it guides the Owner through the steps Data Hub defines, and explains, validates and registers alongside the Owner, as it drafts a Monitor ([DEC-CM-19](08-checks-and-monitoring.md#dec-cm-19)). Claude comes in version 2 ([DEC-CH-02](13-channels.md#dec-ch-02)). *Decided on 2026-11-15, by Max.*
- <a id="dec-ed-05"></a>**DEC-ED-05** · An EDA has three phases: EDA-Setup, EDA-Rerun and EDA-Revalidation ([Flow](#flow)). *Decided on 2026-11-15, by Max.*
- <a id="dec-ed-06"></a>**DEC-ED-06** · An EDA does not go out of date. Its EDA-Probes can run again at any time; an EDA-Rerun registers a new EDA-Profile, and that is the whole re-evaluation: the Owner signs off nothing new. Data Hub shows when the EDA last ran. Only an EDA-Revalidation reconsiders the EDA-Setup. *Decided on 2026-11-14, by Max.*
- <a id="dec-ed-07"></a>**DEC-ED-07** · An EDA covers at least the Key Fields of its Resource ([DEC-SR-19](04-stacks-and-resources.md#dec-sr-19)), and a Rule of a Monitor can use only a field its EDA covers. A field added later is no Key Field until it is marked one, so it lowers nothing. When a Key Field is not covered, the Level stays at 4 · Explored with a warning that names it; Data Hub leads the Owner to an EDA-Revalidation, and then to monitoring the field. *Decided on 2026-11-14, by Max.*
- <a id="dec-ed-08"></a>**DEC-ED-08** · Personal data is out of the scope of the EDA for now. An EDA has no rules of its own for personal data and follows what its User may see, as every query does. It comes back with confidentiality ([OP-PL-01](12-permissions-and-library-cards.md#op-pl-01)). *Decided on 2026-11-14, by Max.*
- <a id="dec-ed-09"></a>**DEC-ED-09** · An EDA is made of EDA-Steps, and an EDA-Step of EDA-Probes. An EDA-Step validates one part of the Resource, such as its gaps; an EDA-Probe is one query that measures one aspect of its data, such as the nulls of a Key Field. *Decided on 2026-11-15, by Max.* Refined by [DEC-ED-17](#dec-ed-17).
- <a id="dec-ed-10"></a>**DEC-ED-10** · The kinds of table of an EDA are the model types of its Resource, with the fields their roles name ([FR-CO-44](03-collections.md#fr-co-44)): an EDA-Probe reads the field a role names, such as when an `event` happened, rather than guessing a column. A Resource of type `other` gets only the EDA-Probes that apply to every Resource. *Decided on 2026-11-16, by Max.* ([OP-ED-03](#op-ed-03)) Refined by [DEC-ED-13](#dec-ed-13).
- <a id="dec-ed-11"></a>**DEC-ED-11** · An EDA offers the EDA-Steps Basis, Gaps, Weight, Correctness and Relations between fields, each with the EDA-Probes of [the table below](#eda-steps-and-eda-probes). An EDA-Probe that reads another Resource points to it ([DEC-DH-68](../../overview/data-hub.md#dec-dh-68)). *Decided on 2026-11-16, by Max.* ([OP-ED-01](#op-ed-01))
- <a id="dec-ed-12"></a>**DEC-ED-12** · Per model type an EDA-Probe is Must, Should or Could, as [the table below](#eda-steps-and-eda-probes) says. Must: without it the EDA-Setup is not complete, so the Resource does not reach 4 · Explored. Should: on by default; the Owner may switch it off. Could: on request. An EDA-Probe that does not apply to a model type is not offered. *Decided on 2026-11-16, by Max.* ([OP-ED-02](#op-ed-02))
- <a id="dec-ed-13"></a>**DEC-ED-13** · An EDA-Probe is chosen and then configured when it is added. A field that a role of the model type names is filled in ahead ([DEC-ED-10](#dec-ed-10)); the Owner chooses every field still missing. Dates in order, for example, asks for when a `state` was created and when it was last updated, which are optional roles ([FR-CO-44](03-collections.md#fr-co-44)). An EDA-Probe is offered whether or not its roles are mapped, and it is added only once its fields are chosen. *Decided on 2026-11-16, by Max.*
- <a id="dec-ed-14"></a>**DEC-ED-14** · Three EDA-Probes join [the table](#eda-steps-and-eda-probes): the mode, the value that comes most often and its share, since a mode far ahead of the rest is often a default nobody chose; spread, the range, interquartile range, variance and standard deviation, which a band of a Monitor is built on; and chance, per segment, how often something happens and whether that depends on another field. Distribution of numbers shows its mean and median, so that a gap between them shows the data is skewed. Every comparison, Differences between segments, Correlations between Key Fields and Chance, per segment, says whether what it found is real or could be chance, with its margin: a hypothesis test and a confidence interval, which Data Hub computes from the aggregates of the query. Regression is not part of the EDA for now: it predicts rather than explores. *Decided on 2026-11-16, by Max.*
- <a id="dec-ed-15"></a>**DEC-ED-15** · The EDA has a section of its own in Data Hub, beside Monitoring and built like it. Its panel lists the Resources by Collection, with those at 3 · Confirmed without an EDA as ready for one. The page of the EDA of a Resource shows the health of its EDA and the best next step on top, then a row per EDA-Step: the EDA-Probes added, as cards with their results; the ones Data Hub suggests, as empty cards that say why they help; and a way to add more. Adding an EDA-Probe opens its own page, which shows what it does and asks for its configuration. The design is [EDA](../../design/principles.md#eda). *Decided on 2026-11-16, by Max.*
- <a id="dec-ed-16"></a>**DEC-ED-16** · The health of an EDA is what it covers of its Resource, in four places: its rows; its columns, at least its Key Fields ([DEC-ED-07](#dec-ed-07)); two columns together; and the Resources it points to. With it come how many needed EDA-Probes are still to add before 4 · Explored, and how its results read. The best next step is the EDA-Probe that covers most of what is missing, needed ones first. *Decided on 2026-11-16, by Max.*
- <a id="dec-ed-17"></a>**DEC-ED-17** · An EDA-Probe is added once to an EDA and set on its fields: one field, a pair or group of fields, or none, for an EDA-Probe on the table as a whole such as the row count. It gives a result per field, or per pair or group: Nulls per Key Field is one EDA-Probe, with a result for each Key Field it is set on. What an EDA covers counts by field ([DEC-ED-16](#dec-ed-16)), the Owner reads each result on its own, and a Must EDA-Probe is complete only once it is set on every Key Field it applies to ([DEC-ED-07](#dec-ed-07), [DEC-ED-12](#dec-ed-12)). *Decided on 2026-11-21, by Max.*
- <a id="dec-ed-18"></a>**DEC-ED-18** · Settling between EDA-Reruns is set on its date role and on the Key Fields: for each recent period it compares the row count and the share empty of each field it is set on, so that it shows after how long the rows settle and after how long each field does, such as a channel a partner sends a day later. A comparison between runs reads the stored results of their EDA-Profiles, never the table as it was in BigQuery, so an EDA-Profile keeps those results per period. Settling therefore shows from the first EDA-Rerun on, not in the EDA-Setup. Nulls per period within one EDA-Profile stay Where gaps cluster. *Decided on 2026-11-21, by Max.*
- <a id="dec-ed-19"></a>**DEC-ED-19** · A relationship of a Resource matters when the field that carries it is a Key Field: a field mapped to an Entity and identifier ([FR-RC-08](05-resource-card.md#fr-rc-08)) and marked a Key Field. There is no separate mark for a relationship. Relationships hold and Values without a match are complete once they are set on every mapped Key Field, and may be set on other mapped fields too; what an EDA covers of the Resources it points to counts the mapped Key Fields ([DEC-ED-16](#dec-ed-16), [DEC-ED-17](#dec-ed-17)). A relationship carried by more than one field together is left until it comes up. *Decided on 2026-11-21, by Max.*
- <a id="dec-ed-20"></a>**DEC-ED-20** · Its Owner starts the EDA of a Resource, mostly from the Resource itself, which creates the EDA. An EDA is In progress until its EDA-Setup is complete, then Explored, as its Resource is 4 · Explored ([DEC-MR-21](06-maturity-and-release.md#dec-mr-21)). Its runs and their EDA-Profiles are shown once the EDA-Setup is complete. The design is [EDA](../../design/principles.md#eda). *Decided on 2026-11-21, by Max.*
- <a id="dec-ed-21"></a>**DEC-ED-21** · An EDA-Probe is complete for the EDA-Setup once it has run, set on every Key Field it applies to ([DEC-ED-17](#dec-ed-17)). The Owner is asked to read each result, but the EDA-Setup does not wait for that reading. *Decided on 2026-11-21, by Max.*
- <a id="dec-ed-22"></a>**DEC-ED-22** · Nulls per Key Field is set on every Key Field, mapped ones too, and has no parameters of its own. Data Hub reads a field with no empty value as expected and one with empty values as for you to judge: it invents no share that is too much. A field that holds a role of its model type cannot be empty ([FR-CO-44](03-collections.md#fr-co-44)), so there an empty value reads look at this. What looks filled but is empty is left to Disguised nulls, and where the gaps sit to Where gaps cluster. *Decided on 2026-11-21, by Max.*
- <a id="dec-ed-23"></a>**DEC-ED-23** · Volume over time, with empty periods is set on the date its role names, which it needs, and any other date the Owner adds, each with its own result ([DEC-ED-17](#dec-ed-17)); how long after one date another comes is for Settling. It counts per the unit of its date: the period of an aggregate, a day for when an event happened. The blocks of 7, 14, 21 and 28 days, from a Monday, so that each holds the same weekdays and as monitoring judges over ([DEC-CM-29](08-checks-and-monitoring.md#dec-cm-29)), are part of its result, not a parameter; never a month, whose days and weekends differ. It counts the rows per period, and for an aggregate or a fact also the sum of the field that adds up, the volume business means. Its result shows, per date, the volume over the whole history, drawn per the unit chosen on the chart, and how calm each unit is: against its own average, the lowest to the highest, P25 to P75, the median, and the standard deviation, also as a share of the average. A field that does not add up, such as a unique count, is given only in the unit of the table itself, as its weeks cannot be added up to more days. Data Hub flags only a period without any row between the first and the last, as look at this; a dip is for the Owner to judge, as Data Hub invents no level that is too low. A period without rows and the current period, not complete yet, never count in its numbers, and the current one never counts as empty. Optional: periods that may be empty, such as weekends for a count per day. *Decided on 2026-11-21, by Max.*
- <a id="dec-ed-24"></a>**DEC-ED-24** · Distribution of numbers is set on the numbers among the Key Fields, which it needs, and any other number the Owner adds, each with its own result. Data Hub chooses a round width for its bins, about twelve of them, and puts everything from about P95 in one open bin, the tail; the Owner may change both. Its result names the shape in a sentence, draws the rows per bin with the middle half from P25 to P75, the median and the mean, and gives the lowest, P25, median, P75, highest and mean. Data Hub reads every distribution as for you to judge, as a shape is neither right nor wrong. How far values lie from the average is left to Spread, values far from the rest to Outliers, and the value that comes most to The mode. *Decided on 2026-11-21, by Max.*
- <a id="dec-ed-25"></a>**DEC-ED-25** · The EDA is a Permission of its own, Explore Resources (`eda.use`), and only Admin has it to start: the Data Admins try the EDA before business works with it. With it a User sees the section EDA and works on the EDA of any Resource they see at 3 · Confirmed or above; without it they see neither, and the Levels as before. Who else gets it, the Owners among them, follows when it is opened up. *Decided on 2026-11-21, by Max.*
- <a id="dec-ed-26"></a>**DEC-ED-26** · The EDA is built now, before version 2, in a service of its own, `eda`, with its own schema. It reads no data itself: query runs the queries of its EDA-Probes, as the User who runs them, so that the Pre-flight and the Query Log apply as to every query ([DEC-SR-32](04-stacks-and-resources.md#dec-sr-32)). catalogue only hears whether the EDA-Setup of a Resource is complete. *Decided on 2026-11-21, by Max.*
- <a id="dec-ed-27"></a>**DEC-ED-27** · While Data Hub does not run every needed EDA-Probe yet, those it does not run still count: they show as Coming, and no Resource reaches 4 · Explored before its model type can be explored in full. Explored keeps its meaning ([DEC-ED-12](#dec-ed-12)). *Decided on 2026-11-21, by Max ([OP-ED-09](#op-ed-09)).*
- <a id="dec-ed-28"></a>**DEC-ED-28** · Impossible values never invents a highest number or a first date: Data Hub proposes only the rules it knows from the type and the role of a field, such as a count that is not negative or a week that starts on a Monday; a highest number or a first date only the Owner gives. *Decided on 2026-11-21, by Max ([OP-UX-119](../../design/principles.md#op-ux-119)).*
- <a id="dec-ed-29"></a>**DEC-ED-29** · The EDA comes to Claude now, for a User with Explore Resources: Claude shows the EDA of a Resource, with what to look at first, and runs an EDA-Probe as the User, through Data Hub, as the web app does. What reads more than runs freely, the User approves in the frame Claude shows; the reading of a result is always the User's, given in the frame or in Data Hub, never by Claude. *Decided on 2026-11-21, by Max.*

## Terms

| Term | Meaning |
| --- | --- |
| EDA-Setup | The first phase of an EDA: applying it to a Resource, choosing which EDA, for which kind of table and which fields matter. It gives its EDA-Probes and their first run, the first EDA-Profile, and sets how often the EDA-Probes run again. |
| EDA-Rerun | Running the EDA-Probes of an EDA again. It gives a new EDA-Profile. |
| EDA-Revalidation | Reconsidering the EDA-Setup of a Resource, triggered by a change to its table, by heavy use of fields the EDA does not include, or by other triggers still to decide. |
| EDA-Profile | The registered results of one run of the EDA-Probes of an EDA: a picture of the data of a Resource at that moment. The EDA-Setup gives the first; each EDA-Rerun gives a new one. |
| EDA-Step | One part of the Resource that an EDA validates, such as its gaps or its weight. It holds EDA-Probes. |
| EDA-Probe | One query of an EDA-Step that measures one aspect of the data of a Resource, on the fields it is set on: one field, a pair or group of fields, or the table as a whole. It gives a result per field, or per pair or group, such as the nulls of each Key Field. |
| Key Field | A field of a Resource that matters, marked on its Resource Card. An EDA covers at least the Key Fields of its Resource. |

## Flow

1. **EDA-Setup.** The Owner applies an EDA to a Resource at 3 · Confirmed: which EDA, for which kind of table, and which fields matter. Data Hub suggests the EDA-Probes for its model type; the Owner adds them, configures each ([DEC-ED-13](#dec-ed-13)), and runs them. The result is the first EDA-Profile: a static picture of the Resource at that moment. The EDA-Setup also sets how often the EDA-Probes run again. Completing it makes the Resource 4 · Explored.
2. **EDA-Rerun.** The EDA-Probes run again and register a new EDA-Profile ([DEC-ED-06](#dec-ed-06)). How an EDA-Rerun starts, and what follows, is [OP-ED-05](#op-ed-05).
3. **EDA-Revalidation.** The EDA-Setup itself is reconsidered, triggered by a change to the table, by heavy use of fields the EDA does not include, or by other triggers ([OP-ED-04](#op-ed-04)). It leads back into the EDA-Setup.

## EDA-Steps and EDA-Probes

What each EDA-Probe reads, and per model type whether it is Must (M), Should (S) or Could (C), or not offered (–) ([DEC-ED-11](#dec-ed-11), [DEC-ED-12](#dec-ed-12)). The roles are those of [FR-CO-44](03-collections.md#fr-co-44).

| EDA-Step | EDA-Probe | Reads | `event` | `state` | `fact` | `dimension` | `aggregate` | `other` |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Basis | The grain holds | The grain | M | M | M | M | M | M |
| Basis | Row count | – | M | M | M | M | M | M |
| Basis | Date range | When it happened; created and updated at; when it occurred; the period | M | M | M | – | M | – |
| Basis | Volume over time, with empty periods | The same date, or as of when for a state | M | C ¹ | M | – | M | – |
| Basis | Settling between EDA-Reruns, of the rows and of the Key Fields ([DEC-ED-18](#dec-ed-18)) | When it happened; when it occurred; the Key Fields | S | – | S | – | C | – |
| Basis | How often things change | Updated at | – | C | – | – | – | – |
| Gaps | Nulls per Key Field | The Key Fields | M | M | M | M | M | M |
| Gaps | Disguised nulls, such as empty strings, "N/A" or 1900-01-01 | The Key Fields | M | M | M | M | M | M |
| Gaps | Where gaps cluster, by period or segment | A date of a role, or a segment | S | S | S | C | S | C |
| Gaps | Values without a match | The mapped fields, at least the mapped Key Fields ([DEC-ED-19](#dec-ed-19)) | S | S | S | S | S | S |
| Weight | Distribution of numbers, with its mean and median ² | Measures, counts and sums | M | M | M | M | M | M |
| Weight | Distribution of categories | The Key Fields | M | M | M | M | M | M |
| Weight | Share per segment | The segment fields | S | S | S | S | S | C |
| Weight | Outliers, outside Q1 − 1.5 × IQR and Q3 + 1.5 × IQR | Measures, counts and sums | S | S | S | C | S | C |
| Weight | The mode: the value that comes most often, and its share ² | The Key Fields | S | S | S | S | S | S |
| Weight | Spread: range, interquartile range, variance and standard deviation ² | Measures, counts and sums | S | S | M | S | M | S |
| Correctness | Impossible values, such as a surface of 0 or a date in the future | Every field | M | M | M | M | M | M |
| Correctness | Numbers or dates stored as text | The text fields | S | S | S | S | S | S |
| Correctness | Variants of one category in case, spacing or spelling | The categories | S | S | S | M | C | S |
| Correctness | Relationships hold through an Entity and identifier ([FR-RC-08](05-resource-card.md#fr-rc-08)) | The mapped fields, at least the mapped Key Fields ([DEC-ED-19](#dec-ed-19)) | M | M | M | S | C | S |
| Correctness | Dates in order: created before updated, none in the future | Created and updated at | – | M | – | – | – | – |
| Correctness | The aggregate adds up to its source | Counts and sums | – | – | – | – | S | – |
| Relations between fields | Derived values agree, such as price per m² | Fields of the domain | C | C | C | C | C | C |
| Relations between fields | Differences between segments ³ | The segment fields | S | C | S | C | S | C |
| Relations between fields | Correlations between Key Fields ³ | The numbers among them | C | C | C | C | C | C |
| Relations between fields | Chance, per segment: how often something happens, and whether it depends on another field ² ³ | A condition and the segment fields | C | C | C | C | C | C |

¹ For a state that keeps its history: as of when is chosen.

² Added or extended on 2026-11-16 ([DEC-ED-14](#dec-ed-14)).

³ Says whether what it found is real or could be chance, with its margin ([DEC-ED-14](#dec-ed-14)).

## Requirements

The first build ([DEC-ED-26](#dec-ed-26)) holds the section EDA, the start of an EDA, its tab Steps, the detail of an EDA-Probe, and four EDA-Probes: The grain holds, Nulls per Key Field, Volume over time, with empty periods, and Distribution of numbers. The tabs Overview and Profile and the EDA-Rerun ([OP-ED-05](#op-ed-05)) come later. The list to add an EDA-Probe, the guide of an EDA in the Flow Box, and the EDA in Claude follow it ([FR-ED-13](#fr-ed-13) to [FR-ED-16](#fr-ed-16)).

<a id="fr-ed-01"></a>
### FR-ED-01 · Only who may explore Resources works on an EDA

**Status:** Implemented · **Source:** Max, 2026-11-21 ([DEC-ED-25](#dec-ed-25)) · **Screens:** [eda](../../design/screens/eda.html)

The section EDA, Start the EDA on a Resource, and every change and run on an EDA need the Permission Explore Resources (`eda.use`). Only the Permission group Admin has it to start. A User without it sees neither the section nor Start the EDA; the Level of a Resource, Explored included, everyone sees as before.

**Makes easy:** trying the EDA with the Data Admins before business works with it. **Makes hard:** an EDA started by someone who may not explore Resources.

<a id="fr-ed-02"></a>
### FR-ED-02 · Start the EDA of a Resource from its maturity ladder

**Status:** Implemented · **Source:** Max, 2026-11-21 ([DEC-ED-20](#dec-ed-20)) · **Screens:** [resource-overview](../../design/screens/resource-overview.html), [eda](../../design/screens/eda.html)

On the Maturity part of the Overview of a Resource at 3 · Confirmed without an EDA, a User with `eda.use` sees Start the EDA at 4 · Explored. It creates the EDA of the Resource, In progress, and opens it in the section EDA. A Resource has at most one EDA. While its EDA is in progress, the ladder says how many of its needed EDA-Probes are complete, with a bar, and offers Open its EDA ([DEC-UX-320](../../design/principles.md#dec-ux-320)).

**Makes easy:** starting the EDA where the next Level is read. **Makes hard:** a second EDA on the same Resource, or an EDA on a Resource that is not confirmed yet.

<a id="fr-ed-03"></a>
### FR-ED-03 · The section EDA lists the EDAs and the Resources ready for one

**Status:** Implemented · **Source:** Max, 2026-11-21 ([DEC-ED-15](#dec-ed-15)) · **Screens:** [eda](../../design/screens/eda.html)

The section EDA stands in the rail after Charts, with the binoculars icon, for a User with `eda.use`. Its panel lists, by Collection, the Resources the User sees with an EDA, each with its status, In progress or Explored, and how many needed EDA-Probes it still has to go; under them, as Ready for an EDA, the Resources at 3 · Confirmed or above without one. A Resource opens its EDA; one ready for an EDA opens its Maturity, where Start the EDA is.

**Makes easy:** seeing where each EDA stands, and which Resources are ready for one. **Makes hard:** losing an EDA that was started and not finished.

<a id="fr-ed-04"></a>
### FR-ED-04 · The tab Steps shows the EDA-Setup per EDA-Step and its state

**Status:** Implemented · **Source:** Max, 2026-11-21 ([DEC-ED-16](#dec-ed-16)) · **Screens:** [eda](../../design/screens/eda.html)

The page of an EDA has the tabs Overview, Steps and Profile; Overview, filled in later, and Profile, greyed while the EDA-Setup is not complete, say what will come there ([DEC-UX-321](../../design/principles.md#dec-ux-321)). Steps shows on the left a row per EDA-Step ([DEC-ED-11](#dec-ed-11)), each with how many of its needed EDA-Probes are complete, a card per EDA-Probe added, with its result in a sentence, Data Hub's reading and the fields it is set on, and, while the EDA-Step has EDA-Probes not added yet, one empty tile, Add probe, which opens the list to add an EDA-Probe at that EDA-Step ([FR-ED-13](#fr-ed-13)). On the right: the needed EDA-Probes complete, as a number and a bar; what the EDA covers in its four places; the best next step; the EDA-Probes on the table as a whole; and per field, in the order of the Resource Card, what covers it per EDA-Step, the Key Fields marked ([DEC-UX-322](../../design/principles.md#dec-ux-322), [DEC-UX-323](../../design/principles.md#dec-ux-323)).

**Makes easy:** seeing what the EDA-Setup still needs, and where. **Makes hard:** taking an EDA for done while a Key Field is not covered.

<a id="fr-ed-05"></a>
### FR-ED-05 · Data Hub knows which EDA-Probes each model type needs

**Status:** Implemented · **Source:** Max, 2026-11-21 ([DEC-ED-12](#dec-ed-12)) · **Screens:** [eda](../../design/screens/eda.html)

For every model type Data Hub keeps the EDA-Probes of [the table](#eda-steps-and-eda-probes): needed, suggested or on request, or not offered, each with its EDA-Step and what it reads. An EDA counts its needed EDA-Probes from it, and a needed EDA-Probe is complete once it has run, set on every Key Field it applies to ([DEC-ED-17](#dec-ed-17), [DEC-ED-21](#dec-ed-21)). An EDA-Probe Data Hub cannot run yet is shown as coming; it still counts as needed ([OP-ED-09](#op-ed-09)).

**Makes easy:** knowing, for any Resource, which EDA-Probes its kind of table needs. **Makes hard:** an EDA-Setup that skips an EDA-Probe its model type needs.

<a id="fr-ed-06"></a>
### FR-ED-06 · The detail of an EDA-Probe adds it and runs it

**Status:** Implemented · **Source:** Max, 2026-11-21 ([DEC-ED-13](#dec-ed-13), [DEC-ED-21](#dec-ed-21)) · **Screens:** [eda-probe](../../design/screens/eda-probe.html), [eda-probe-nulls](../../design/screens/eda-probe-nulls.html), [eda-probe-volume](../../design/screens/eda-probe-volume.html), [eda-probe-distribution](../../design/screens/eda-probe-distribution.html)

The detail of an EDA-Probe opens in the tab Steps, in two columns ([DEC-UX-324](../../design/principles.md#dec-ux-324)): on the left what it does, with its drawing, animated once, with Replay, why it matters, its parameters, the fields it is set on among them, and Run; on the right its result, the conclusion on top. Run adds the EDA-Probe to the EDA and runs it now; then it offers Run again. A run reads through query as the User who runs it: up to what their Permission group lets run freely it runs, above that up to what they may approve they approve it, and above that it does not run, saying so. Every run is in the Query Log. Its result is kept with the EDA, each run with who ran it and when.

**Makes easy:** seeing what an EDA-Probe does before it runs, and its result where it was asked. **Makes hard:** an EDA-Probe that reads more than its User may, or a result without who ran it.

<a id="fr-ed-07"></a>
### FR-ED-07 · The grain holds

**Status:** Implemented · **Source:** Max, 2026-11-21 · **Screens:** [eda-probe](../../design/screens/eda-probe.html)

The grain holds is set on the fields of the grain of the Resource, as the Data Team recorded it, and has no parameters of its own. A Resource without recorded grain fields cannot run it: it says that the Data Team records its grain first. Its result: the rows, the grain values, how many grain values are on more than one row and how many rows they cover, the rows with an empty grain field, and up to 5 grain values on more than one row with their rows; drawn as how many grain values are on one row, two, three, or more, the wrong side shaded. Data Hub reads it as expected when no grain value is on more than one row and none is empty, and look at this otherwise.

**Makes easy:** knowing that every row is one thing before reading any other result. **Makes hard:** counts and sums that double up unseen.

<a id="fr-ed-08"></a>
### FR-ED-08 · Nulls per Key Field

**Status:** Implemented · **Source:** Max, 2026-11-21 ([DEC-ED-22](#dec-ed-22)) · **Screens:** [eda-probe-nulls](../../design/screens/eda-probe-nulls.html)

Nulls per Key Field is set on every Key Field, mapped ones too, and has no parameters of its own. Its result is a row per field, in the order of the Resource Card ([DEC-UX-326](../../design/principles.md#dec-ux-326)): filled and empty as a bar, the share empty and how many rows, and Data Hub's reading with why: as expected without empty values, for you to judge with some, and look at this when the field holds a role of its model type.

**Makes easy:** seeing how much is missing in the fields that matter. **Makes hard:** an empty field that a count or average silently leaves out.

<a id="fr-ed-09"></a>
### FR-ED-09 · Volume over time, with empty periods

**Status:** Implemented · **Source:** Max, 2026-11-21 ([DEC-ED-23](#dec-ed-23)) · **Screens:** [eda-probe-volume](../../design/screens/eda-probe-volume.html)

Volume over time is set on the date its role names, which it needs, and on any other date added, each with its own result. It counts per the unit of its date, the rows, and for an aggregate or a fact also the sum of the field that adds up. Its result per date: a sentence; the volume over the whole history, drawn per 7, 14, 21 or 28 days as chosen on the chart, the periods without rows hatched, the current one dotted; and how calm each unit is, against its own average: lowest to highest, P25 to P75, the median, and the standard deviation, also as a share of the average. Data Hub reads a period without rows between the first and the last as look at this, and as expected otherwise.

**Makes easy:** finding a break in the data, and the unit in which its volume is calm. **Makes hard:** a quiet week that is a break, taken for a quiet week.

<a id="fr-ed-10"></a>
### FR-ED-10 · Distribution of numbers

**Status:** Implemented · **Source:** Max, 2026-11-21 ([DEC-ED-24](#dec-ed-24)) · **Screens:** [eda-probe-distribution](../../design/screens/eda-probe-distribution.html)

Distribution of numbers is set on the numbers among the Key Fields, which it needs, and on any other number added, each with its own result. Its bins have a round width chosen by Data Hub, about twelve of them, and everything from about P95 in one open bin, the tail; the User may change both. Its result per field: a sentence naming the shape, the rows per bin with the middle half from P25 to P75, the median and the mean drawn, the tail apart, and the lowest, P25, median, P75, highest and mean. Data Hub reads it as for you to judge.

**Makes easy:** seeing where the weight of a number lies. **Makes hard:** reporting an average that describes almost no row.

<a id="fr-ed-11"></a>
### FR-ED-11 · Each result is read, by Data Hub and by who works on the EDA

**Status:** Implemented · **Source:** Max, 2026-11-16 · **Screens:** [eda-probe](../../design/screens/eda-probe.html), [eda-probe-nulls](../../design/screens/eda-probe-nulls.html), [eda-probe-volume](../../design/screens/eda-probe-volume.html), [eda-probe-distribution](../../design/screens/eda-probe-distribution.html)

Every result of an EDA-Probe, per field where it is set on several, carries Data Hub's reading: as expected, look at this, or for you to judge. Who works on the EDA reads each result with something to read as Expected, Known or A problem; the reading is kept with who gave it and when, and can be changed. The EDA-Setup does not wait for it ([DEC-ED-21](#dec-ed-21)). Turning Known into Known Behaviour and A problem into a Signal comes later.

**Makes easy:** keeping what business made of each result. **Makes hard:** a result that looks wrong and that nobody read.

<a id="fr-ed-12"></a>
### FR-ED-12 · The EDA-Setup complete makes the Resource 4 · Explored

**Status:** Implemented · **Source:** Max, 2026-11-21 ([DEC-MR-21](06-maturity-and-release.md#dec-mr-21)) · **Screens:** [eda](../../design/screens/eda.html), [resource-overview](../../design/screens/resource-overview.html)

Once every needed EDA-Probe of an EDA is complete, the EDA is Explored and its Resource 4 · Explored ([FR-MR-22](06-maturity-and-release.md#fr-mr-22)); its Log says so. An EDA-Rerun, a result that reads badly or a Key Field marked later lowers nothing; a Key Field the EDA does not cover gives a warning that names it ([DEC-ED-07](#dec-ed-07)).

**Makes easy:** a Level that says the data was explored, with the EDA behind it. **Makes hard:** Explored without its needed EDA-Probes.

<a id="fr-ed-13"></a>
### FR-ED-13 · The list to add an EDA-Probe

**Status:** Implemented · **Source:** Max, 2026-11-21 ([DEC-UX-328](../../design/principles.md#dec-ux-328)) · **Screens:** [eda](../../design/screens/eda.html)

Add probe opens a sheet with every EDA-Probe the model type of the Resource is offered ([DEC-ED-12](#dec-ed-12)), per EDA-Step in their order, opened at the EDA-Step of its tile, with a search that has the focus at once. Each EDA-Probe shows its name, the question it asks of this Resource, whether it is Needed, Suggested or On request, and its state: added, with Data Hub's reading; set on part of what it needs; ready to add; or Coming, while Data Hub does not run it ([DEC-ED-27](#dec-ed-27)). Filters show all, the needed ones, those Data Hub runs, or those added. A click opens its detail, where Run adds it ([FR-ED-06](#fr-ed-06)); a Coming one opens nothing. An EDA-Probe not offered for its model type is not listed.

**Makes easy:** finding the EDA-Probe that asks the question one has about the data. **Makes hard:** adding an EDA-Probe that does not fit the kind of table.

<a id="fr-ed-14"></a>
### FR-ED-14 · The guide of an EDA, in the Flow Box

**Status:** Implemented · **Source:** Max, 2026-11-21 ([DEC-UX-327](../../design/principles.md#dec-ux-327)) · **Screens:** [eda](../../design/screens/eda.html), [eda-probe](../../design/screens/eda-probe.html)

Starting an EDA opens its guide: the [Flow Box](../../design/principles.md#flow-box) with the flow Set up its EDA, one step per needed EDA-Probe, in the order of the EDA-Steps and grouped under them. A step is done once its EDA-Probe is complete, with Data Hub's reading and its result in a few words; open with what it misses; or Coming while Data Hub does not run it, and still counted. The step to do now is the best next step of the EDA, as its page proposes; it unfolds What, Why and How, its Learning Card where one is written, and Open the EDA-Probe, which opens its detail. On the tab Steps of its EDA the Flow Box is folded to its strip, as the page shows the same; on the detail of an EDA-Probe and on every other page of Data Hub it is open, until it is closed. Guide me, beside the title of the page of the EDA, brings it back. It is there for a User with Explore Resources while the EDA is in progress, and it is one Flow Box at a time ([DEC-UX-308](../../design/principles.md#dec-ux-308)).

**Makes easy:** keeping the next EDA-Probe in view while looking at the data elsewhere. **Makes hard:** losing track of what the EDA-Setup still needs.

<a id="fr-ed-15"></a>
### FR-ED-15 · Claude shows the EDA of a Resource

**Status:** Implemented · **Source:** Max, 2026-11-21 ([DEC-ED-29](#dec-ed-29)) · **Screens:** [mcp-eda](../../design/screens/mcp-eda.html)

For a User with Explore Resources, Claude reads the EDA of a Resource (`get_eda`) and shows it as an MCP App (`show_eda`): the Resource, the status of its EDA, its Level and how many needed EDA-Probes are complete, with the bar of the EDA-Setup; then how many results Data Hub reads as look at this or for you to judge, and whether the User read them; then per EDA-Step each EDA-Probe added, with its reading, its result in a sentence and what it is set on; and the needed ones Coming, named once. The charts stay in Data Hub, where Open in Data Hub leads. Without Explore Resources Claude has no EDA tools ([DEC-ED-25](#dec-ed-25)).

**Makes easy:** asking Claude where an EDA stands and what to look at first. **Makes hard:** taking an EDA for done because a few of its results read well.

<a id="fr-ed-16"></a>
### FR-ED-16 · Claude runs an EDA-Probe as the User

**Status:** Implemented · **Source:** Max, 2026-11-21 ([DEC-ED-29](#dec-ed-29)) · **Screens:** [mcp-eda](../../design/screens/mcp-eda.html)

Claude runs an EDA-Probe Data Hub runs (`run_eda_probe`), on the fields it is set on or those the User names, through the same service as the web app and as the User ([FR-ED-06](#fr-ed-06)). Within what runs freely it runs, the EDA-Probe is added when it was not, and the frame shows its conclusion and its result per field. From there up to what the User may approve, the frame asks the User to approve it, which Claude cannot do; above that it does not run. The User gives the reading of a result with the buttons in the frame, or in Data Hub; Claude never gives it. Starting an EDA stays in Data Hub.

**Makes easy:** running an EDA-Probe again from a conversation, after a fix. **Makes hard:** Claude reading a result for the User, or running past what the User may run.

## Out of scope

- Personal data, for now ([DEC-ED-08](#dec-ed-08)).
- Monitoring itself: [Checks and monitoring](08-checks-and-monitoring.md). The EDA comes before it ([DEC-ED-02](#dec-ed-02)).

## Open points

Raised on 2026-11-15, in the review of the EDA proposal:

- [x] <a id="op-ed-01"></a>**OP-ED-01** · Decide which EDA-Steps and EDA-Probes an EDA offers. Proposal: the first cut of 2026-11-15. An EDA-Probe that reads another Resource points to it ([DEC-DH-68](../../overview/data-hub.md#dec-dh-68)). *Decided on 2026-11-16, by Max ([DEC-ED-11](#dec-ed-11)).*
- [x] <a id="op-ed-02"></a>**OP-ED-02** · Decide which EDA-Probes are required in which context: Must, Should or Could, per kind of table and per kind of field. *Decided on 2026-11-16, by Max ([DEC-ED-12](#dec-ed-12)).*
- [x] <a id="op-ed-03"></a>**OP-ED-03** · Decide whether an EDA needs table types, and whether they change what is required. Starting point: the model types a Resource already has, set by the Data Admin ([DEC-RC-10](05-resource-card.md#dec-rc-10)). The EDA proposal already asks volume over time only of event and fact tables. *Decided on 2026-11-16, by Max ([DEC-ED-10](#dec-ed-10)).*
- [ ] <a id="op-ed-04"></a>**OP-ED-04** · Decide what triggers an EDA-Revalidation, how it starts and what happens. Candidates: a field added, removed or retyped ([FR-MR-12](06-maturity-and-release.md#fr-mr-12)); a logic Change ([DEC-DH-27](../../overview/data-hub.md#dec-dh-27)); heavy use of fields the EDA does not include, from a meta-analysis of usage at a later stage; a field newly marked a Key Field. Part of it: how Data Hub asks whether a new field is a Key Field. Proposal: the Message on a changed schema asks the Owner, field by field ([MSG-RES-03](message-catalogue.md#msg-res-03)). *Note of 2026-11-16, by Max: a change of model type triggers one ([DEC-RC-22](05-resource-card.md#dec-rc-22)); an EDA-Setup starts only when the model type has every field it asks for ([DEC-CO-27](03-collections.md#dec-co-27)).*
- [ ] <a id="op-ed-05"></a>**OP-ED-05** · Decide how an EDA-Rerun starts and what follows. Candidates: on the schedule set in the EDA-Setup, and on demand by the Owner. Monitoring already runs its queries as Data Hub on a schedule ([DEC-CM-16](08-checks-and-monitoring.md#dec-cm-16), [DEC-CM-28](08-checks-and-monitoring.md#dec-cm-28)). *Note of 2026-11-21: what an EDA-Rerun is compared with is the stored EDA-Profile of an earlier run, never the table as it was in BigQuery ([DEC-ED-18](#dec-ed-18)).*
- [ ] <a id="op-ed-06"></a>**OP-ED-06** · Decide whether EDA and monitoring need a service in Python, for methods SQL does not offer, such as changepoints and seasonal baselines ([FR-CM-38](08-checks-and-monitoring.md#fr-cm-38)). Proposal: not now. An EDA computes in BigQuery SQL, which returns only aggregates, and Data Hub works on those in TypeScript; this is revisited with FR-CM-38, as one service for both. *Note of 2026-11-16: the hypothesis tests and confidence intervals of [DEC-ED-14](#dec-ed-14) need no Python either: Data Hub computes them in TypeScript from the counts, means and variances the query returns.*
- [ ] <a id="op-ed-07"></a>**OP-ED-07** · Decide what happens to the Monitor of a Resource whose EDA goes, so that it drops to 3 · Confirmed ([FR-MR-07](06-maturity-and-release.md#fr-mr-07)).
- [ ] <a id="op-ed-08"></a>**OP-ED-08** · Align the other domains with this frame: Explored as "an EDA document is linked" ([DEC-MR-02](06-maturity-and-release.md#dec-mr-02), [FR-MR-03](06-maturity-and-release.md#fr-mr-03), [FR-MR-07](06-maturity-and-release.md#fr-mr-07), [DEC-MR-14](06-maturity-and-release.md#dec-mr-14), the Levels in the [definitions](../../definitions.md#maturity-levels), Learning Card K5.2, the Message catalogue, the screens and the texts of the app); 5 · Monitored only from 4 · Explored, with no Monitor on a Resource without an EDA ([DEC-CM-12](08-checks-and-monitoring.md#dec-cm-12)); and Data Hub writing nothing to BigQuery, also for the Aggregate Table of a Breakdown ([DEC-CM-18](08-checks-and-monitoring.md#dec-cm-18)). *Note of 2026-11-21: Explored is aligned: it means a complete EDA-Setup, in the definitions, [Maturity and release](06-maturity-and-release.md#dec-mr-21), Learning Card K5.2, the Message catalogue, the screens and the texts of the app. Monitored only from Explored, and the Aggregate Table, remain.*
- [x] <a id="op-ed-09"></a>**OP-ED-09** · Decide whether, while Data Hub cannot run every needed EDA-Probe yet, an EDA-Setup counts only those it can run. Proposal: no, Explored keeps its meaning ([DEC-ED-12](#dec-ed-12)): a needed EDA-Probe that is not built shows as coming and still counts, so that no Resource reaches 4 · Explored before its model type can be fully explored. *Raised on 2026-11-21, while writing the first build.* *Decided on 2026-11-21, by Max: as proposed ([DEC-ED-27](#dec-ed-27)).*
- [ ] <a id="op-ed-10"></a>**OP-ED-10** · Decide two points of Impossible values, drawn as a proposal in [eda-probe-impossible](../../design/screens/eda-probe-impossible.html). First: a Key Field Data Hub knows no rule for, such as a text like `lead_channel`, stays not covered under Correctness until someone gives it a rule; running Impossible values does not cover it. Second: a field mapped to an Entity, such as `lead_source` to Lead sources, is left out of Impossible values, as its possible values are those of the Entity, which Values without a match checks; so the same list of allowed values is not asked twice. *Raised on 2026-11-21, during review: the third point of the proposal is decided ([DEC-ED-28](#dec-ed-28)), and Max asked what these two mean.*

## Builds on

- [Data Hub overview](../../overview/data-hub.md), its [three forms of documentation](../../overview/data-hub.md#three-forms-of-documentation)
- [Maturity and release](06-maturity-and-release.md)
- [Resource card](05-resource-card.md): Key Fields and Known Behaviour
- [Checks and monitoring](08-checks-and-monitoring.md)
- [Claude](17-claude.md)
