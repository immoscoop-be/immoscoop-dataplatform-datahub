# Availability and resilience

| | |
| --- | --- |
| Code | `AVL` |
| Status | Proposed: first requirements, for the front door of [Applications](../functional/18-applications.md), on 2026-11-23 |
| Source of truth | This file |

## Requirements

<a id="nfr-avl-01"></a>
### NFR-AVL-01 · The front door stays up during a release

**Status:** Proposed · **Applies to:** [DEC-AP-09](../functional/18-applications.md#dec-ap-09), [FR-AP-27](../functional/18-applications.md#fr-ap-27)

A release of the front door that Applications call answers every question throughout: a new version takes traffic only once it answers, gradually, and reads the copies the version before it wrote. No release, migration or delivery makes an Application get an answer "Data Hub unavailable" ([OP-AP-05](../functional/18-applications.md#op-ap-05)).

*Could, not in v1: set on 2026-11-23, by Max ([DEC-AP-18](../functional/18-applications.md#dec-ap-18)).*

<a id="nfr-avl-02"></a>
### NFR-AVL-02 · A prepared Feed is served without the rest of Data Hub

**Status:** Proposed · **Applies to:** [FR-AP-31](../functional/18-applications.md#fr-ap-31)

The front door answers a question to a prepared Feed from its copy in Firestore and the keys of its Applications alone. BigQuery, the database of Data Hub, its other services and dbt Cloud being unavailable does not stop it answering with the last good delivery.

*Could, not in v1: set on 2026-11-23, by Max ([DEC-AP-18](../functional/18-applications.md#dec-ap-18)).*
