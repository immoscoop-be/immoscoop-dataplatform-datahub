# Security

| | |
| --- | --- |
| Code | `SEC` |
| Status | First requirements, from the architecture decisions of 2026-10-17 |
| Source of truth | This file |

## Requirements

<a id="nfr-sec-01"></a>
### NFR-SEC-01 · Every service authenticates and authorises every request

**Status:** Specified · **Applies to:** [DEC-PF-02](../technical/00-platform.md#dec-pf-02), [DEC-PF-10](../technical/00-platform.md#dec-pf-10)

No request is trusted because of where it comes from: not the network, not a gateway, and not another service. Every service checks who is asking and what they may do, on every request.

The one exception is semgraph, the Chart Server: it holds no data and has access to none, so it is open without login, behind a rate limit ([DEC-PF-24](../technical/00-platform.md#dec-pf-24)).

<a id="nfr-sec-02"></a>
### NFR-SEC-02 · Least privilege per service

**Status:** Specified · **Applies to:** [DEC-PF-08](../technical/00-platform.md#dec-pf-08), [DEC-DH-08](../../overview/data-hub.md#dec-dh-08)

Every service runs under its own identity, with only the permissions its responsibility needs. Only query can read the Stacks, only registry can reach dbt Cloud and the artifact bucket, and only identity can read the Groups in Workspace.

<a id="nfr-sec-03"></a>
### NFR-SEC-03 · Lost access takes effect quickly

**Status:** Proposed · **Applies to:** [FR-UM-06](../functional/02-user-management.md#fr-um-06), [FR-UM-10](../functional/02-user-management.md#fr-um-10)

A change in Workspace, such as a removed Group membership or a suspended account, takes effect in Data Hub within the lifetime of one Access Token (15 minutes): at every renewal identity reads the Groups again and checks the account ([TR-PF-26](../technical/00-platform.md#tr-pf-26)).

<a id="nfr-sec-04"></a>
### NFR-SEC-04 · Only main can change prod

**Status:** Specified · **Applies to:** [DEC-PF-14](../technical/00-platform.md#dec-pf-14), [DEC-PF-16](../technical/00-platform.md#dec-pf-16)

Nothing outside the branch `main` can change the prod project: GitHub Actions may only act as the prod Terraform identity on `main`, and as the uat Terraform identity only on `uat`. A pull request or a feature branch cannot act as either, even with a changed workflow. No service account key exists that could bypass this.
