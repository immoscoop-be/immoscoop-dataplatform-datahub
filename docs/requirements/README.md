# Requirements

This folder holds every requirement for Data Hub: what it must do (functional), how it is built (technical), and the qualities it must have (non-functional). Every requirement has a stable ID, so requirements can reference each other, and commits can say which requirements they implement.

| Folder | What it holds | State |
| --- | --- | --- |
| [`functional/`](functional/README.md) | What Data Hub does, domain by domain | Five domains specified, ten still to be specified |
| [`technical/`](technical/README.md) | How each functional requirement is realised | Platform specified; domains to follow |
| [`non-functional/`](non-functional/README.md) | Security, performance, cost, localisation and other qualities | Security started; other categories to follow |
| [`traceability.md`](traceability.md) | Generated matrix: requirement → status → realised by → commits | Generated, never edit by hand |
| [`_templates/`](_templates/) | Starting points for a new domain or requirement file | — |

## IDs

Every item has an ID of the form `<TYPE>-<CODE>-<NN>`.

| Type | Meaning | Lives in | Status values |
| --- | --- | --- | --- |
| `FR` | Functional requirement | `functional/` | Proposed, Specified, Implemented, Verified, Withdrawn |
| `EC` | Edge case: behaviour in an unusual situation | `functional/`, next to the requirements of its domain | Same as `FR` |
| `TR` | Technical requirement | `technical/` | Same as `FR` |
| `NFR` | Non-functional requirement | `non-functional/` | Same as `FR` |
| `DEC` | Decision | Where it applies: a domain file, or the [overview](../overview/data-hub.md) for decisions that span domains | Decided (implicit) |
| `OP` | Open point: a question or task still to resolve | A domain file, or [open themes](../overview/open-themes.md) | Open `[ ]` or done `[x]` |

`CODE` is the domain code for `FR`, `EC`, `TR`, `DEC` and `OP`, and a quality category for `NFR`. Technical requirements reuse the code of the functional domain they realise, so `TR-AR-03` is about the artifact registry. `NN` is a two-digit sequence number within one type and code.

### Codes

| Code | Domain | File |
| --- | --- | --- |
| `DH` | Data Hub as a whole: overarching decisions and open themes | [overview](../overview/data-hub.md), [open themes](../overview/open-themes.md) |
| `AR` | Artifact registry | [01-artifact-registry.md](functional/01-artifact-registry.md) |
| `UM` | User management | [02-user-management.md](functional/02-user-management.md) |
| `CO` | Collections | [03-collections.md](functional/03-collections.md) |
| `SR` | Stacks and resources | [04-stacks-and-resources.md](functional/04-stacks-and-resources.md) |
| `RC` | Resource card | [05-resource-card.md](functional/05-resource-card.md) |
| `MR` | Maturity and release | [06-maturity-and-release.md](functional/06-maturity-and-release.md) |
| `LN` | Log and notifications | [07-log-and-notifications.md](functional/07-log-and-notifications.md) |
| `CM` | Checks and monitoring | [08-checks-and-monitoring.md](functional/08-checks-and-monitoring.md) |
| `LE` | Lenses | [09-lenses.md](functional/09-lenses.md) |
| `RP` | Reports | [10-reports.md](functional/10-reports.md) |
| `BP` | Beta and promotion | [11-beta-and-promotion.md](functional/11-beta-and-promotion.md) |
| `PL` | Permissions and library cards | [12-permissions-and-library-cards.md](functional/12-permissions-and-library-cards.md) |
| `CH` | Channels | [13-channels.md](functional/13-channels.md) |
| `CV` | Conversations | [14-conversations.md](functional/14-conversations.md) |
| `ED` | EDA | [15-eda.md](functional/15-eda.md) |
| `PF` | Platform: technical choices not tied to one domain (technical requirements only) | [00-platform.md](technical/00-platform.md) |

Non-functional categories are listed in [`non-functional/README.md`](non-functional/README.md).

### Rules for IDs

- An ID is never reused or renumbered. A requirement that is no longer wanted gets status `Withdrawn` and stays in place.
- A new requirement takes the next free number in its type and code.
- Log IDs of the app itself, such as `RES-001`, are a different thing: they live in the [Log catalogue](functional/log-catalogue.md).

### Confluence IDs

The functional rules started on Confluence, in Dutch, with their own numbering. Each migrated requirement keeps its original ID as an alias on its status line, so a mention of an old ID in Jira or Slack can still be found with a text search.

| Confluence prefix | Repo prefix |
| --- | --- |
| `AR-nn` | `FR-AR-nn` |
| `GB-nn` (Gebruikersbeheer) | `FR-UM-nn` |
| `CO-nn` | `FR-CO-nn` |
| `SR-nn` | `FR-SR-nn` |
| `MO-nn` (Maturiteit en ontsluiting) | `FR-MR-nn` |

Edge cases, decisions and open points had no IDs on Confluence. They were numbered in the order they appear on their page.

## Format

### Requirements and edge cases

Each requirement is a heading with a fixed anchor, followed by a status line and the text:

```markdown
<a id="fr-ar-05"></a>
### FR-AR-05 · Ingest a run at most once

**Status:** Specified · **Confluence:** AR-05

A run is ingested at most once. A duplicate signal for the same run creates no duplicates.
```

- The anchor is the ID in lower case. Links point to the anchor, never to the heading text, so a title can change without breaking links.
- The title after `·` is short and descriptive. The Confluence rules had no titles; the titles of migrated rules were derived from their text.
- A technical requirement extends its status line with `· **Realises:**` and links to what it realises: functional requirements, edge cases, decisions or non-functional requirements. A non-functional requirement adds `· **Applies to:**` when it is about specific requirements. See the [templates](_templates/).

### Decisions and open points

Decisions and open points are list items with an inline anchor:

```markdown
- <a id="dec-um-01"></a>**DEC-UM-01** · Data Hub keeps no users or passwords of its own. …
- [ ] <a id="op-um-02"></a>**OP-UM-02** · Confirm which Workspace domain (or domains) is allowed.
```

### Links

Always link an ID when you mention it outside its own definition: `[FR-AR-05](functional/01-artifact-registry.md#fr-ar-05)`. Back-references are not written by hand: the traceability matrix computes them.

## Status lifecycle

| Status | Meaning |
| --- | --- |
| Proposed | Suggested, still to be confirmed. All migrated edge cases start here, because Confluence listed them as "proposals to confirm". |
| Specified | Agreed as a rule that can be built and tested. All migrated functional rules start here. |
| Implemented | Built. At least one commit references it with `Implements:`. |
| Verified | Built and tested. |
| Withdrawn | No longer wanted. Kept for history, never deleted. |

"Specified" is deliberately not called "Described": Described is a maturity level of a Resource (see the [definitions](../definitions.md#maturity-levels)), and the two must not be confused.

## Commits

A commit names the requirements it touches in git trailers at the end of its message:

```text
Ingest each dbt Cloud run at most once

Implements: FR-AR-05, FR-AR-06
Refs: FR-AR-14, OP-AR-02
```

- `Implements:` means the commit builds (part of) the requirement.
- `Refs:` means the commit is related but does not implement it, for example a test, a spike or a documentation change.
- Update the requirement's status in the same change when it moves, for example from Specified to Implemented.

The matrix picks the trailers up from `git log`, including from squash merges.

## Tooling

[`scripts/requirements.ts`](../../scripts/requirements.ts) uses only Node.js built-ins, and Node.js 24 runs it directly: no build step and no dependencies.

```sh
pnpm docs:check   # validate IDs, statuses and links (node scripts/requirements.ts check)
pnpm docs:build   # regenerate docs/requirements/traceability.md (node scripts/requirements.ts build)
```

`check` fails on a duplicate ID, an anchor that does not match its ID, an unknown status, a broken link or anchor, and a mention of an ID that does not exist. It runs in CI on every pull request. Run `build` after changing requirements or after commits with trailers. Never edit `traceability.md` by hand.

## Adding a requirement

1. Open the file of the domain, or start one from [`_templates/`](_templates/).
2. Take the next free number for its type and code.
3. Write the block in the format above, with status `Proposed` or `Specified`.
4. Link the requirements it depends on or realises.
5. Run `check` and `build`, and commit the result.
