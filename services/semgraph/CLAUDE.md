# Working on semgraph

semgraph is the chart server of the chart language, the Chart Server of Data Hub: see [README.md](README.md) for how
it is built, and [its architecture page](../../docs/architecture/services/semgraph.md) for its place in Data Hub. The
rules of the repository root ([CLAUDE.md](../../CLAUDE.md)) apply here too; this file adds what is particular to the
chart language.

## Philosophy

The principles of semgraph are in the [README](README.md#philosophy). Hold every requirement and every design against
them, and say so when something goes against one. One of them was decided explicitly (REQ-037): **compare with what is
not on the screen.** What is on the screen, the reader compares by eye. A comparison therefore always brings in the
period just before the screen, as long as what is shown, and never a period that is already visible.

## Requirements

Every functional requirement has a number `REQ-xxx`.

- **Where they come in.** New requirements are on Confluence:
  [Requirements grafiektaal](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1359872021). An assignment in a
  conversation or an issue that is not there yet is a requirement too. Give it the next free number and put it on
  Confluence, with the date of the assignment and the assignment as its source.
- **Source of truth.** As long as a requirement is not implemented, Confluence is the source. Once it is implemented,
  the register of implemented requirements is. A later change therefore starts there, as a new requirement that refers
  to the old one, and not on Confluence.
- **Where the register is.** Until the requirements move into `docs/requirements` of Data Hub, translated into English
  ([OP-PF-16](../../docs/requirements/technical/00-platform.md#op-pf-16)), the register REQ-000 to REQ-107 is in Dutch
  in the [former repository](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/tree/main/docs/requirements).
  Do not bring untranslated files into this repository: a requirement implemented in the meantime is described in its
  pull request, and gets its file when the register moves.
- **Order.** When requirements contradict each other, the most recent decision applies. That is the date (and the
  time) of the decision, not the number.

## A new requirement: sharp first, then build

Hold every new requirement against three sources before you implement anything:

1. the implemented requirements in the register;
2. the open requirements on Confluence;
3. the rules in Figma ([file grafiektaal](https://www.figma.com/design/X9FMecd5iH6jIced8nZQf6)) and the
   [analysis](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1352106324).

If it contradicts something, or allows more than one reasonable implementation:

- **Say so before you write code.** Quote the conflicting requirements literally, with number and date, and say what
  each choice changes in the code.
- **Put it up for discussion.** Ask a concrete question with a proposal, and wait for the answer. "The most recent
  wins" decides your proposal, but does not replace the discussion: a newer requirement may have overlooked the older
  case.
- **Implement only once the requirement is sharp.** The outcome of the discussion becomes a new or sharpened
  requirement: a new row on Confluence that refers to the old one.
- **Only part of it sharp?** Implement that part. Put the rest with the open points of the register, with the question.

## Referring to requirements

- **Commit messages** name the numbers, for example `REQ-006: mean as diamond`.
- **In the code** the number stands where a rule comes from a requirement and someone would ask "why like this?", for
  example `// REQ-001: ...`. Not on every line.
- **Tests.** `test/requirements.test.ts` has a test per requirement, which runs over every example of every semgraph.
  Other tests may carry the number in their name.

## Once implemented

1. Describe the requirement as decided, how it is implemented, the code, tests, branch, commits and pull request:
   for now in the pull request (see "Where the register is" above).
2. Fill in the row on Confluence with branch, commit and pull request (links to GitHub).

## Developing

- Node 24 runs the TypeScript directly, without a build; semgraph reads its definitions next to its code. From the
  root of Data Hub:
  - `pnpm vitest run --project semgraph` and `pnpm typecheck`;
  - `pnpm --filter @datahub/semgraph schemas` after a change to a contract;
  - `UPDATE_GOLDEN=1 pnpm vitest run --project semgraph` after a deliberate change to the drawing. Look at the SVGs
    first (`pnpm --filter @datahub/semgraph render:examples`).
- Everything smart happens in our code; Vega-Lite only draws what it gets.
- No code duplication: a new chart is a subclass (REQ-025).
- semgraph holds no data and gets access to none: it is open to everyone
  ([DEC-PF-24](../../docs/requirements/technical/00-platform.md#dec-pf-24)).
