# eda

| | |
| --- | --- |
| Kind | Backend service on Cloud Run |
| Code | `services/eda` |
| Schema | `eda` |
| Domains | [EDA](../../requirements/functional/15-eda.md) |

**In one sentence:** eda keeps the EDA of each Resource, its EDA-Probes, their runs, results and readings, writes the SQL of each EDA-Probe and has query run it as the User, and tells catalogue when an EDA-Setup is complete; it reads no data itself ([DEC-ED-26](../../requirements/functional/15-eda.md#dec-ed-26)).

## Responsibilities

- The EDA of a Resource, started by a User with `eda.use`, In progress until its EDA-Setup is complete, then Explored: [FR-ED-01](../../requirements/functional/15-eda.md#fr-ed-01), [FR-ED-02](../../requirements/functional/15-eda.md#fr-ed-02), built as [TR-ED-01](../../requirements/technical/15-eda.md#tr-ed-01) and [TR-ED-06](../../requirements/technical/15-eda.md#tr-ed-06)
- The EDA-Probes per model type, which are needed, and when one is complete, from one catalogue in contracts: [FR-ED-05](../../requirements/functional/15-eda.md#fr-ed-05), built as [TR-ED-02](../../requirements/technical/15-eda.md#tr-ed-02)
- The SQL of an EDA-Probe, returning aggregates only, and its result with Data Hub's reading: [FR-ED-07](../../requirements/functional/15-eda.md#fr-ed-07) to [FR-ED-10](../../requirements/functional/15-eda.md#fr-ed-10), built as [TR-ED-03](../../requirements/technical/15-eda.md#tr-ed-03)
- Running an EDA-Probe through query, as the User: [FR-ED-06](../../requirements/functional/15-eda.md#fr-ed-06), built as [TR-ED-04](../../requirements/technical/15-eda.md#tr-ed-04)
- The readings of who works on the EDA: [FR-ED-11](../../requirements/functional/15-eda.md#fr-ed-11)
- Telling catalogue that an EDA-Setup is complete, which makes the Resource 4 · Explored: [FR-ED-12](../../requirements/functional/15-eda.md#fr-ed-12), built as [TR-ED-05](../../requirements/technical/15-eda.md#tr-ed-05)

## API

| Endpoint | Purpose |
| --- | --- |
| `GET /edas` | The EDAs of the Resources the User sees, for the panel of the section EDA |
| `POST /resources/{id}/eda` | Starts the EDA of a Resource at 3 · Confirmed or above |
| `GET /resources/{id}/eda` | The EDA as the tab Steps and the Maturity of the Resource show it |
| `POST /resources/{id}/eda/probes/{probe}/runs` | Adds an EDA-Probe and runs it through query |
| `PUT /resources/{id}/eda/probes/{probe}/readings` | The reading of a result by who works on the EDA |

Every route needs the Access Token of a User with `eda.use` ([TR-ED-01](../../requirements/technical/15-eda.md#tr-ed-01)).

## Data

The schema `eda`: `edas`, `eda_probes`, `eda_runs`, `eda_results` and `eda_readings` ([TR-ED-01](../../requirements/technical/15-eda.md#tr-ed-01)). Results hold aggregates only, never rows of a table.

## Talks to

catalogue (`DATAHUB_CATALOGUE_URL`), with the token of the User, for a Resource as the User sees it, and with its Google ID token for catalogue's address when an EDA-Setup is complete ([TR-ED-05](../../requirements/technical/15-eda.md#tr-ed-05)); query (`DATAHUB_QUERY_URL`), with the token of the User, to run an EDA-Probe ([TR-ED-04](../../requirements/technical/15-eda.md#tr-ed-04)); identity (`DATAHUB_TOKEN_ISSUER`) for the public keys of the tokens.

## Permissions

Cloud SQL client only. No role on BigQuery: query reads the data ([TR-ED-08](../../requirements/technical/15-eda.md#tr-ed-08)).
