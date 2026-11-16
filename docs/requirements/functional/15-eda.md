# EDA

| | |
| --- | --- |
| Domain | 15 of Data Hub · code `ED` |
| Status | To be specified: the frame, the phases and the first decisions were set on 2026-11-15, by Max; which EDA-Probes are offered and required, and the flows of the phases, are still open |
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
- <a id="dec-ed-09"></a>**DEC-ED-09** · An EDA is made of EDA-Steps, and an EDA-Step of EDA-Probes. An EDA-Step validates one part of the Resource, such as its gaps; an EDA-Probe is one query that measures one aspect of its data, such as the nulls of a Key Field. *Decided on 2026-11-15, by Max.*

## Terms

| Term | Meaning |
| --- | --- |
| EDA-Setup | The first phase of an EDA: applying it to a Resource, choosing which EDA, for which kind of table and which fields matter. It gives its EDA-Probes and their first run, the first EDA-Profile, and sets how often the EDA-Probes run again. |
| EDA-Rerun | Running the EDA-Probes of an EDA again. It gives a new EDA-Profile. |
| EDA-Revalidation | Reconsidering the EDA-Setup of a Resource, triggered by a change to its table, by heavy use of fields the EDA does not include, or by other triggers still to decide. |
| EDA-Profile | The registered results of one run of the EDA-Probes of an EDA: a picture of the data of a Resource at that moment. The EDA-Setup gives the first; each EDA-Rerun gives a new one. |
| EDA-Step | One part of the Resource that an EDA validates, such as its gaps or its weight. It holds EDA-Probes. |
| EDA-Probe | One query of an EDA-Step that measures one aspect of the data of a Resource, such as the nulls of a Key Field or the distribution of a field. |
| Key Field | A field of a Resource that matters, marked on its Resource Card. An EDA covers at least the Key Fields of its Resource. |

## Flow

1. **EDA-Setup.** The Owner applies an EDA to a Resource at 3 · Confirmed: which EDA, for which kind of table, and which fields matter. Data Hub turns that into a set of EDA-Probes and runs them. The result is the first EDA-Profile: a static picture of the Resource at that moment. The EDA-Setup also sets how often the EDA-Probes run again. Completing it makes the Resource 4 · Explored.
2. **EDA-Rerun.** The EDA-Probes run again and register a new EDA-Profile ([DEC-ED-06](#dec-ed-06)). How an EDA-Rerun starts, and what follows, is [OP-ED-05](#op-ed-05).
3. **EDA-Revalidation.** The EDA-Setup itself is reconsidered, triggered by a change to the table, by heavy use of fields the EDA does not include, or by other triggers ([OP-ED-04](#op-ed-04)). It leads back into the EDA-Setup.

## EDA-Steps and EDA-Probes, proposed

A first cut, proposed on 2026-11-15 from the checks of the EDA proposal and grouped by what the EDA explores ([DEC-ED-02](#dec-ed-02)). Which are offered is [OP-ED-01](#op-ed-01); which are required for which kind of table is [OP-ED-02](#op-ed-02) and [OP-ED-03](#op-ed-03).

| EDA-Step | Validates | EDA-Probes |
| --- | --- | --- |
| Basis | That the data matches what Data Hub records | The grain holds; row count and date range; volume over time, with empty periods |
| Gaps | What is missing | Nulls per Key Field; disguised nulls, such as empty strings, "N/A" or 1900-01-01; where gaps cluster, by period or segment; values without a match, such as municipalities without a region |
| Weight | Where the data lies | Distribution of numbers: percentiles, median, interquartile range, histogram; distribution of categories: top values and the rest, rare values; share per segment; outliers below Q1 − 1.5 × IQR or above Q3 + 1.5 × IQR |
| Correctness | How correct it is | Impossible values, such as a surface of 0 or a date in the future; numbers or dates stored as text; variants of one category in case, spacing or spelling; relationships that hold through an Entity and identifier ([FR-RC-08](05-resource-card.md#fr-rc-08)): rows without a match on either side, and rows that multiply |
| Relations between fields | How fields hang together | Derived values that agree, such as price per m²; differences between segments; correlations between Key Fields |

## Requirements

None yet. They follow once the open points below are decided.

## Out of scope

- Personal data, for now ([DEC-ED-08](#dec-ed-08)).
- Monitoring itself: [Checks and monitoring](08-checks-and-monitoring.md). The EDA comes before it ([DEC-ED-02](#dec-ed-02)).

## Open points

Raised on 2026-11-15, in the review of the EDA proposal:

- [ ] <a id="op-ed-01"></a>**OP-ED-01** · Decide which EDA-Steps and EDA-Probes an EDA offers. Proposal: the [first cut](#eda-steps-and-eda-probes-proposed) above. An EDA-Probe that reads another Resource points to it ([DEC-DH-68](../../overview/data-hub.md#dec-dh-68)).
- [ ] <a id="op-ed-02"></a>**OP-ED-02** · Decide which EDA-Probes are required in which context: Must, Should or Could, per kind of table and per kind of field.
- [ ] <a id="op-ed-03"></a>**OP-ED-03** · Decide whether an EDA needs table types, and whether they change what is required. Starting point: the model types a Resource already has, set by the Data Admin ([DEC-RC-10](05-resource-card.md#dec-rc-10)). The EDA proposal already asks volume over time only of event and fact tables.
- [ ] <a id="op-ed-04"></a>**OP-ED-04** · Decide what triggers an EDA-Revalidation, how it starts and what happens. Candidates: a field added, removed or retyped ([FR-MR-12](06-maturity-and-release.md#fr-mr-12)); a logic Change ([DEC-DH-27](../../overview/data-hub.md#dec-dh-27)); heavy use of fields the EDA does not include, from a meta-analysis of usage at a later stage; a field newly marked a Key Field. Part of it: how Data Hub asks whether a new field is a Key Field. Proposal: the Message on a changed schema asks the Owner, field by field ([MSG-RES-03](message-catalogue.md#msg-res-03)). *Note of 2026-11-16, by Max: a change of model type triggers one ([DEC-RC-22](05-resource-card.md#dec-rc-22)); an EDA-Setup starts only when the model type has every field it asks for ([DEC-CO-27](03-collections.md#dec-co-27)).*
- [ ] <a id="op-ed-05"></a>**OP-ED-05** · Decide how an EDA-Rerun starts and what follows. Candidates: on the schedule set in the EDA-Setup, and on demand by the Owner. Monitoring already runs its queries as Data Hub on a schedule ([DEC-CM-16](08-checks-and-monitoring.md#dec-cm-16), [DEC-CM-28](08-checks-and-monitoring.md#dec-cm-28)).
- [ ] <a id="op-ed-06"></a>**OP-ED-06** · Decide whether EDA and monitoring need a service in Python, for methods SQL does not offer, such as changepoints and seasonal baselines ([FR-CM-38](08-checks-and-monitoring.md#fr-cm-38)). Proposal: not now. An EDA computes in BigQuery SQL, which returns only aggregates, and Data Hub works on those in TypeScript; this is revisited with FR-CM-38, as one service for both.
- [ ] <a id="op-ed-07"></a>**OP-ED-07** · Decide what happens to the Monitor of a Resource whose EDA goes, so that it drops to 3 · Confirmed ([FR-MR-07](06-maturity-and-release.md#fr-mr-07)).
- [ ] <a id="op-ed-08"></a>**OP-ED-08** · Align the other domains with this frame: Explored as "an EDA document is linked" ([DEC-MR-02](06-maturity-and-release.md#dec-mr-02), [FR-MR-03](06-maturity-and-release.md#fr-mr-03), [FR-MR-07](06-maturity-and-release.md#fr-mr-07), [DEC-MR-14](06-maturity-and-release.md#dec-mr-14), the Levels in the [definitions](../../definitions.md#maturity-levels), Learning Card K5.2, the Message catalogue, the screens and the texts of the app); 5 · Monitored only from 4 · Explored, with no Monitor on a Resource without an EDA ([DEC-CM-12](08-checks-and-monitoring.md#dec-cm-12)); and Data Hub writing nothing to BigQuery, also for the Aggregate Table of a Breakdown ([DEC-CM-18](08-checks-and-monitoring.md#dec-cm-18)).

## Builds on

- [Data Hub overview](../../overview/data-hub.md), its [three forms of documentation](../../overview/data-hub.md#three-forms-of-documentation)
- [Maturity and release](06-maturity-and-release.md)
- [Resource card](05-resource-card.md): Key Fields and Known Behaviour
- [Checks and monitoring](08-checks-and-monitoring.md)
- [Claude](17-claude.md)
