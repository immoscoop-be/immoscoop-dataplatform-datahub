# Stacks and resources: technical requirements

| | |
| --- | --- |
| Realises | [Stacks and resources](../functional/04-stacks-and-resources.md) |
| Status | Registration through exposures, Resources in Collections and their Log implemented; the Level, the Fingerprint, Publication and reading the data follow |
| Source of truth | This file |

How the tables under the exposures of the dbt projects become Resources, in the service [catalogue](../../architecture/services/catalogue.md), from what [registry](../../architecture/services/registry.md) hands over ([TR-AR-08](01-artifact-registry.md#tr-ar-08)).

## Requirements

<a id="tr-sr-01"></a>
### TR-SR-01 · catalogue takes the exposed tables from registry only

**Status:** Implemented · **Realises:** [TR-PF-05](00-platform.md#tr-pf-05), [DEC-PF-26](00-platform.md#dec-pf-26), [NFR-SEC-01](../non-functional/security.md#nfr-sec-01)

`POST /internal/resources` takes no Access Token of a User: no User starts it. It takes a Google ID token instead, and accepts it only when Google signed it, it was issued for catalogue's own address, and it belongs to the service account of registry, with a verified address. Any other call is answered `401`, without looking at what it carries.

<a id="tr-sr-02"></a>
### TR-SR-02 · Resources live in the schema of catalogue

**Status:** Implemented · **Realises:** [FR-SR-04](../functional/04-stacks-and-resources.md#fr-sr-04), [FR-SR-05](../functional/04-stacks-and-resources.md#fr-sr-05), [FR-SR-06](../functional/04-stacks-and-resources.md#fr-sr-06), [FR-SR-33](../functional/04-stacks-and-resources.md#fr-sr-33), [FR-CO-07](../functional/03-collections.md#fr-co-07)

The table `resources` holds one row per Resource: a UUID as its ID; the Key, unique, as registry writes a `relation`; the dbt project, its unique ID and the name and kind of its Node; the Display Name; the description; the names of the exposures that make it a Resource; its Collection, if any; and when it was registered, last changed and withdrawn.

- One Collection at most: the Resource holds the ID of its Collection.
- The Display Name is unique, whatever its case, among the Resources that are not withdrawn. When the label or Node name is taken, the name of the dbt project follows in brackets, and if that is taken too, the Key.
- The description is a copy of the Artifacts, refreshed by every call; it is never typed in Data Hub.
- `resource_syncs` keeps per dbt project the run of the last call that was applied. A call for an older run, from a run processed again, changes nothing.

<a id="tr-sr-03"></a>
### TR-SR-03 · Every call registers, renames, withdraws and brings back

**Status:** Implemented · **Realises:** [FR-SR-32](../functional/04-stacks-and-resources.md#fr-sr-32), [FR-SR-33](../functional/04-stacks-and-resources.md#fr-sr-33), [FR-SR-34](../functional/04-stacks-and-resources.md#fr-sr-34), [FR-SR-14](../functional/04-stacks-and-resources.md#fr-sr-14), [DEC-SR-26](../functional/04-stacks-and-resources.md#dec-sr-26)

A call carries every exposed table of one dbt project. In one transaction, catalogue:

- registers a table it does not know yet, without Collection, and writes `RES-001`;
- brings back a withdrawn Resource whose table is exposed again, as it was, with its Collection, and writes `RES-006`;
- renames a Resource whose Display Name changed, and writes `RES-003`;
- refreshes the description, the Node and the exposures of every other Resource, without a Log Entry;
- withdraws every Resource of that dbt project whose table is no longer in the call, and writes `RES-004`.

The table `resource_log` holds the Log of the Resources, append-only like the Log of the Collections ([TR-CO-04](03-collections.md#tr-co-04)): a trigger refuses every update and delete. The actor of these entries is Data Hub itself.

<a id="tr-sr-04"></a>
### TR-SR-04 · The Data Team adds Resources to Collections and removes them

**Status:** Implemented · **Realises:** [FR-CO-07](../functional/03-collections.md#fr-co-07), [FR-CO-08](../functional/03-collections.md#fr-co-08), [FR-CO-11](../functional/03-collections.md#fr-co-11), [FR-CO-14](../functional/03-collections.md#fr-co-14), [DEC-SR-27](../functional/04-stacks-and-resources.md#dec-sr-27)

`PUT /resources/{id}/collection` with a `collectionId` adds a Resource to a Collection; `DELETE /resources/{id}/collection` removes it. Only the Data Team may do either (`403` for anyone else). A Resource that is in another Collection is refused with `409 in_another_collection`: it is removed first and added again, never moved. Adding writes `COL-006` in the Log of the Collection and `COL-030` in the Log of the Resource; removing writes `COL-007` and `COL-031`.

<a id="tr-sr-05"></a>
### TR-SR-05 · Who reads which Resources

**Status:** Implemented · **Realises:** [FR-SR-35](../functional/04-stacks-and-resources.md#fr-sr-35), [DEC-SR-26](../functional/04-stacks-and-resources.md#dec-sr-26), [DEC-SR-27](../functional/04-stacks-and-resources.md#dec-sr-27)

| Route | What | Who |
| --- | --- | --- |
| `GET /resources?collection=none` | The Resources without Collection, withdrawn ones marked | The Data Team |
| `GET /collections/{id}/resources` | The Resources of a Collection, withdrawn ones marked | Whoever sees the Collection; see below |
| `GET /resources/{id}/log` | The Log of a Resource, newest first | Whoever sees the Resource |

The Data Team and the members of the Owner Unit see every Resource of a Collection. Anyone else who sees the Collection sees only its published Resources ([FR-SR-31](../functional/04-stacks-and-resources.md#fr-sr-31)); Publication is not built yet, so for now that list is empty for them. A Resource someone does not see is answered with `404`.

## Open points

None yet; reading the data of Resources is [OP-SR-10](../functional/04-stacks-and-resources.md#op-sr-10).
