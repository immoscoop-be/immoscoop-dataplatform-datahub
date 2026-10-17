# Log catalogue

| | |
| --- | --- |
| Status | First draft; to be completed with the log IDs of the other domains ([OP-SR-02](04-stacks-and-resources.md#op-sr-02)) |
| Owned by | [Log and notifications](07-log-and-notifications.md), once that domain is described |
| Source of truth | This file |
| Migrated from | The section "Logcatalogus (eerste aanzet)" of [ptditt - Tooling - Data Hub - Stacks en resources](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1371078741) (Confluence, Dutch), last modified 2026-10-17, migrated 2026-10-17 |

Every log entry in Data Hub refers to a fixed log ID from this catalogue, with its parameters as JSON. The text is only built at display time from the template and the parameters ([DEC-SR-09](04-stacks-and-resources.md#dec-sr-09), [FR-SR-11](04-stacks-and-resources.md#fr-sr-11), [FR-SR-12](04-stacks-and-resources.md#fr-sr-12)).

The prefix of a log ID says which domain the entry comes from. The templates are in English, like everything in the app.

Log IDs are not requirement IDs: they are codes in the app itself. Requirement IDs are described in the [requirements conventions](../README.md).

| Log ID | Template | Parameters |
| --- | --- | --- |
| `RES-001` | Resource registered by {admin} | admin, key |
| `RES-002` | Maturity assessed at level {level} | level, reason |
| `RES-003` | Renamed from {old} to {new} by {admin} | old, new, admin |
| `RES-004` | Resource deregistered by {admin} | admin, reason |
| `RES-005` | {field} updated by {actor} | field, actor |
| `COL-030` | Added to collection {collection} | collection |
| `COL-031` | Removed from collection {collection} | collection |
| `ART-010` | Structural change: field {field} {direction} | field, direction, sourceNode, distance |
| `ART-011` | Logic change in {sourceNode} | sourceNode, distance |
| `ART-012` | Type of {field} changed from {old} to {new} | field, old, new, sourceNode, distance |
| `ART-013` | Description changed in {sourceNode} | sourceNode, distance |
| `MAT-020` | Confirmed by {owner} | owner, fingerprint |
| `MAT-021` | Maturity dropped to level {level}; owner alerted | level, reason |
| `PUB-040` | Published by {owner} | owner, level |
| `CNV-050` | Signal raised by {actor} | actor, conversation |
| `CNV-051` | Signal turned into anomaly by {actor} | actor, conversation, anomaly |
