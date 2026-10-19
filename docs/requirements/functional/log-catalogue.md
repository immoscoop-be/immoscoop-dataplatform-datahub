# Log catalogue

| | |
| --- | --- |
| Status | First draft; to be completed with the Log IDs of the other domains ([OP-SR-02](04-stacks-and-resources.md#op-sr-02)) |
| Owned by | [Log and notifications](07-log-and-notifications.md), once that domain is described |
| Source of truth | This file |
| Migrated from | The section "Logcatalogus (eerste aanzet)" of [ptditt - Tooling - Data Hub - Stacks en resources](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1371078741) (Confluence, Dutch), last modified 2026-10-17, migrated 2026-10-17 |

Every Log Entry in Data Hub refers to a fixed Log ID from this catalogue, with its parameters as JSON. The text is only built at display time from the template and the parameters ([DEC-SR-09](04-stacks-and-resources.md#dec-sr-09), [FR-SR-11](04-stacks-and-resources.md#fr-sr-11), [FR-SR-12](04-stacks-and-resources.md#fr-sr-12)).

The prefix of a Log ID says which domain the entry comes from. The templates are in English, like everything in the app.

*Changed on 2026-10-19: `RES-001`, `RES-003`, `RES-004`, `COL-030` and `COL-031` follow the Registration through exposures ([DEC-SR-22](04-stacks-and-resources.md#dec-sr-22)), and `RES-006`, `COL-006` and `COL-007` are new.*

Most Log Entries are about a Resource. The entries with a Log ID from `COL-001` to `COL-029` are about a Collection itself, and appear in the Log of that Collection.

Log IDs are not requirement IDs: they are codes in the app itself. Requirement IDs are described in the [requirements conventions](../README.md).

| Log ID | Template | Parameters |
| --- | --- | --- |
| `RES-001` | Registered through exposure {exposure} | exposure, key, run |
| `RES-002` | Maturity assessed at level {level} | level, reason |
| `RES-003` | Renamed from {old} to {new} | old, new, run |
| `RES-004` | Withdrawn: no exposure with the tag datahub depends on it any more | run |
| `RES-005` | {field} updated by {actor} | field, actor |
| `RES-006` | Back through exposure {exposure} | exposure, run |
| `COL-001` | Collection created by {actor} | actor, name, ownerUnit, visibility |
| `COL-002` | {field} changed by {actor} | field, old, new, actor |
| `COL-003` | Owner Unit changed from {old} to {new} by {actor} | old, new, actor |
| `COL-004` | Made {visibility} by {actor} | visibility, actor |
| `COL-005` | Collection dissolved by {actor} | actor |
| `COL-006` | {resource} added by {actor} | resource, actor |
| `COL-007` | {resource} removed by {actor} | resource, actor |
| `COL-030` | Added to collection {collection} by {actor} | collection, actor |
| `COL-031` | Removed from collection {collection} by {actor} | collection, actor |
| `ART-010` | Structural change: field {field} {direction} | field, direction, sourceNode, distance |
| `ART-011` | Logic change in {sourceNode} | sourceNode, distance |
| `ART-012` | Type of {field} changed from {old} to {new} | field, old, new, sourceNode, distance |
| `ART-013` | Description changed in {sourceNode} | sourceNode, distance |
| `MAT-020` | Confirmed by {owner} | owner, fingerprint |
| `MAT-021` | Maturity dropped to level {level}; owner alerted | level, reason |
| `PUB-040` | Published by {owner} | owner, level |
| `CNV-050` | Signal raised by {actor} | actor, conversation |
| `CNV-051` | Signal turned into anomaly by {actor} | actor, conversation, anomaly |
