# Data Hub documentation

Data Hub is the library of our data: the one entry point for business colleagues and their Claude, next to and together with the Chart Server. This folder holds everything that describes it: why it exists, what it must do, and how it is built.

This repository is the source of truth. The documentation started on Confluence, in Dutch, under [ptditt - Tooling - Data Hub](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1362428000), and was migrated here, in English, on 2026-10-17. Every migrated file links its Confluence page.

## Where to start

| If you want to know | Read |
| --- | --- |
| What Data Hub is, and the decisions that shape it | [Data Hub overview](overview/data-hub.md) |
| What a term means, or how a Confluence term is translated | [Definitions](definitions.md) |
| What Data Hub must do, domain by domain | [Functional domains](requirements/functional/README.md) |
| How requirements are numbered, linked and tied to commits | [Requirements conventions](requirements/README.md) |
| Which requirements exist, their status, and the commits that implement them | [Traceability matrix](requirements/traceability.md) |
| What is still open for Data Hub as a whole | [Open themes](overview/open-themes.md) |
| How the web app must look and behave: design rules, style values and prototype screens | [Design](design/README.md) |
| How Data Hub is built: services, tokens, data, technology | [Architecture](architecture/README.md) |
| How code becomes running services, and the branches | [Build and deploy](architecture/build-and-deploy.md) |
| How to set up the GCP projects, once | [GCP setup](architecture/gcp-setup.md) |

## Structure

```text
docs/
├── README.md                  this file
├── definitions.md             Defined Terms, Levels, Dutch-to-English translation reference
├── architecture/
│   ├── README.md              services, how users are validated, interfaces, data, repository layout
│   ├── build-and-deploy.md    pipeline, images, branches and their rules
│   ├── gcp-setup.md           the one-time bootstrap of the GCP projects
│   └── services/              one page per service and application
├── design/
│   ├── README.md              how we work on the design, and how to view the screens
│   ├── principles.md          the rules of the design, its decisions and open points (DEC-UX, OP-UX)
│   ├── tokens.css, base.css   the style values and the components of the prototype
│   └── screens/               the screens as working prototypes in HTML and CSS
├── overview/
│   ├── data-hub.md            vision, the library metaphor, overarching decisions (DEC-DH)
│   └── open-themes.md         themes still to be worked out (OP-DH)
└── requirements/
    ├── README.md              ID scheme, format, statuses, commit trailers, tooling
    ├── traceability.md        generated: requirement → status → realised by → commits
    ├── _templates/            starting points for new files
    ├── functional/            one file per functional domain (FR, EC, DEC, OP)
    ├── technical/             technical requirements (TR): the platform, then one file per domain
    └── non-functional/        non-functional requirements (NFR), one file per category
```

## Conventions in short

- Everything is in English, as is the app itself.
- Every requirement, edge case, decision and open point has a stable ID, such as `FR-AR-05`, and an anchor to link to.
- Commits name what they implement with `Implements:` and `Refs:` trailers.
- `pnpm docs:check` validates IDs and links; `pnpm docs:build` regenerates the traceability matrix.

The details are in the [requirements conventions](requirements/README.md).
