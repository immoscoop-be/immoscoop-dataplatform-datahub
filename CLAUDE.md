# Repository instructions for Claude Code

## Language

Everything in this repository is in English: code, comments, documentation and commit messages. The app itself is English-only too (FR-SR-15). The Confluence pages the documentation came from are in Dutch; when translating from them, use the vocabulary in the translation reference of `docs/definitions.md`, and add new term pairs there.

## Documentation

- `docs/` is the source of truth for what Data Hub is and must do. Start from `docs/README.md`.
- Defined Terms are written with capitals, as in a contract, wherever they are used in their defined meaning: a Data Admin registers a Resource in a Collection. `docs/definitions.md` lists every Defined Term and the rules (ordinary meanings stay lowercase, verbs are not capitalised, service names stay lowercase, the runtime is written Node.js). A new term is added to `docs/definitions.md` first.
- `docs/architecture/` describes how Data Hub is built: one page per service. It is descriptive; the binding decisions and technical requirements it follows are in `docs/requirements/technical/00-platform.md`. Keep the two in step when a service changes.
- Requirements live under `docs/requirements/`: functional (`FR`), edge cases (`EC`), technical (`TR`) and non-functional (`NFR`), plus decisions (`DEC`) and open points (`OP`). The ID scheme, the block format and the status values are in `docs/requirements/README.md`; follow them exactly.
- Never renumber or reuse an ID. A requirement that is no longer wanted gets status `Withdrawn`.
- Link every ID you mention to its anchor, for example `[FR-AR-05](functional/01-artifact-registry.md#fr-ar-05)`.
- New files start from `docs/requirements/_templates/`.
- `docs/requirements/traceability.md` is generated. Never edit it by hand: run `pnpm docs:build`.
- Run `pnpm docs:check` before every commit that touches `docs/`; CI runs it on every pull request.
- Content migrated from Confluence is translated faithfully. Inconsistencies are not silently fixed: record them as an open point, marked as raised during the migration or later review.

## Code

- All code is TypeScript on Node 24, in one pnpm workspace: `packages/*` (shared), `services/*` (backend services), `apps/*` (web, mcp). ESM only.
- Before every commit that touches code: `pnpm typecheck` and `pnpm test`. `pnpm check` runs those plus the documentation check, as CI does.
- Every route is protected by the access token by default (`@datahub/auth`). Only mark a route public (`config: { public: true }`) when it must be reachable without login, such as a health check or the start of a login.
- A new service starts as a copy of an existing one; follow `docs/architecture/build-and-deploy.md#adding-a-service`.
- Scripts in `scripts/` are TypeScript that Node runs directly: Node built-ins only, and only type syntax that can be stripped (no enums, no namespaces).

## Infrastructure

- All GCP resources of Data Hub are Terraform in `infra/`, applied by GitHub Actions: `uat` applies to the uat project, `main` to the prod project. Never apply Terraform or change resources by hand.
- The only manual steps are the one-time bootstrap in `docs/architecture/gcp-setup.md`; keep that file in step when the bootstrap changes.

## Branches

- Every change goes first to `uat`, then from `uat` to `main` (prod). Work happens on a feature branch, with a pull request into `uat`.
- `main` only receives pull requests from `uat`; CI fails any other pull request into `main`.
- Never push or merge directly onto `uat` or `main`; everything goes through a pull request.
- Merge `uat` into `main` with a merge commit, never a squash.
- CI is one workflow, `.github/workflows/ci.yml`, ending in the gate job `ci`: the only check the branch rules require. Add new jobs to that workflow and to the `needs` of `ci`, never as a separate required check.

## Commits

When a commit implements or relates to a requirement, end its message with git trailers:

```text
Implements: FR-AR-05, FR-AR-06
Refs: OP-AR-02
```

Update the status of the requirement in the same change when it moves (for example `Specified` → `Implemented`), then rebuild the matrix.
