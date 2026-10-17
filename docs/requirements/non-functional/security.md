# Security

| | |
| --- | --- |
| Code | `SEC` |
| Status | First requirements, from the architecture decisions of 2026-10-17 |
| Source of truth | This file |

## Requirements

<a id="nfr-sec-01"></a>
### NFR-SEC-01 · Every service authenticates and authorises every request

**Status:** Specified · **Applies to:** [DEC-PF-02](../technical/00-platform.md#dec-pf-02)

No request is trusted because of where it comes from: not the network, not a gateway, and not another service. Every service checks who is asking and what they may do, on every request.

<a id="nfr-sec-02"></a>
### NFR-SEC-02 · Least privilege per service

**Status:** Specified · **Applies to:** [DEC-PF-08](../technical/00-platform.md#dec-pf-08), [DEC-DH-08](../../overview/data-hub.md#dec-dh-08)

Every service runs under its own identity, with only the permissions its responsibility needs. Only query can read the stacks, only registry can reach dbt Cloud and the artifact bucket, and only identity can read the groups in Workspace.

<a id="nfr-sec-03"></a>
### NFR-SEC-03 · Lost access takes effect quickly

**Status:** Proposed · **Applies to:** [FR-UM-06](../functional/02-user-management.md#fr-um-06), [FR-UM-10](../functional/02-user-management.md#fr-um-10)

A change in Workspace, such as a removed group membership or a suspended account, takes effect in Data Hub within the lifetime of one access token (15 minutes), plus the time groups are cached at identity ([OP-PF-02](../technical/00-platform.md#op-pf-02)).
