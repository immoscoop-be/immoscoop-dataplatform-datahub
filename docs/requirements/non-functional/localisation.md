# Localisation

| | |
| --- | --- |
| Code | `LOC` |
| Status | Proposed: the language principle of Max, 2026-10-25, still to be confirmed ([OP-DH-43](../../overview/open-themes.md#op-dh-43)) |
| Scope | Every text a User sees in Data Hub: the interface, the content of assets, notifications, Pre-flights, the answers of the MCP server and the Learning Centre |
| Source of truth | This file. It comes from the proposal [ptditt - Data Hub - Taalprincipe voor interface en learning-centre](https://claude.ai/artifact/NAbA5F5ctEoNsmkZK4U5qa) (Dutch) |

**In one sentence:** names are English and never translated; sentences are in the language of the User.

*Proposed by Max on 2026-10-25, to be taken into the functional analysis; the proposal calls itself a direction, not a fixed plan. It agrees with [DEC-DH-02](../../overview/data-hub.md#dec-dh-02) and [FR-SR-15](../functional/04-stacks-and-resources.md#fr-sr-15) on names, and differs on sentences: they make the whole app English. Which holds is [OP-DH-43](../../overview/open-themes.md#op-dh-43).*

## Names and sentences

In this file, *name* and *sentence* are ordinary words with the meaning below. The Dutch examples show the Dutch version of the app.

| Kind | Examples | Language |
| --- | --- | --- |
| **Name:** a term of the Domain Model | `creditLead`, `listingLead`, `visitorId`, `officeId`: Entities and identifiers | English, always, in every language version |
| **Name:** a kind of asset, and a level | `resource`, `collection`, `lens`, `semgraph`, `report`; the Levels and the levels of confidentiality | English, always |
| **Name:** names of fields and columns, statuses, Query IDs | As they are in dbt and BigQuery | English, always |
| **Sentence:** the interface | Buttons, menus, labels, empty states, tooltips | Dutch and English, through translation files |
| **Sentence:** notifications and Pre-flights | "Deze query verwerkt 3,2 GB. Doorgaan?" (This query processes 3.2 GB. Continue?) | Dutch and English |
| **Sentence:** the content of the Learning Centre | Cards, questions, feedback, "Je kan nu" (You can now) | Dutch in the first version; see [OP-DH-40](../../overview/open-themes.md#op-dh-40) |
| **Sentence:** metadata written by people | The definition, open questions, Known Gaps, the log of changes | The language of the writer; the guideline is Dutch, with English names |

**The test:** would you write it in code format, or with a fixed spelling (camelCase, a capital)? Then it is a name.

## Requirements

<a id="nfr-loc-01"></a>
### NFR-LOC-01 · Names are English and never translated

**Status:** Proposed · **Source:** [Max, 2026-10-25](https://claude.ai/artifact/NAbA5F5ctEoNsmkZK4U5qa) · **Applies to:** [DEC-DH-02](../../overview/data-hub.md#dec-dh-02), [FR-SR-15](../functional/04-stacks-and-resources.md#fr-sr-15)

A name, as defined above, is English in every language version of Data Hub and in every text: the interface, notifications, the Learning Centre, the answers of the MCP server and the metadata people write. Switching the language changes only sentences: names, data, Query IDs and Lenses stay identical.

<a id="nfr-loc-02"></a>
### NFR-LOC-02 · Translation files hold sentences only

**Status:** Proposed · **Source:** [Max, 2026-10-25](https://claude.ai/artifact/NAbA5F5ctEoNsmkZK4U5qa)

Translation files contain sentences only, never a name of the Domain Model or a kind of asset. A name goes into a sentence as a parameter and is not translated with it. For example, the key `lens.publish.confirm` reads "Wil je deze lens publiek maken?" in Dutch and "Do you want to make this lens public?" in English: `lens` stays `lens` in both.

<a id="nfr-loc-03"></a>
### NFR-LOC-03 · A name always stands in a sentence that says what it is

**Status:** Proposed · **Source:** [Max, 2026-10-25](https://claude.ai/artifact/NAbA5F5ctEoNsmkZK4U5qa)

A name never stands alone, without context: not "creditLeads: 1 204" as the only explanation, but "1 204 creditLeads (leads die naar KBC gaan)", the leads that go to KBC. Every name that appears on a screen has a tooltip, or an explanation inline, taken from the Glossary ([NFR-LOC-05](#nfr-loc-05)). How that relates to the marker of the Learning Centre is [OP-DH-44](../../overview/open-themes.md#op-dh-44).

<a id="nfr-loc-04"></a>
### NFR-LOC-04 · No Dutch synonyms for names

**Status:** Proposed · **Source:** [Max, 2026-10-25](https://claude.ai/artifact/NAbA5F5ctEoNsmkZK4U5qa)

A name has no Dutch synonym, not even in free text: not "kredietleads", not "credit leads", but `creditLead(s)`.

<a id="nfr-loc-05"></a>
### NFR-LOC-05 · The Glossary is the source of names and their explanation

**Status:** Proposed · **Source:** [Max, 2026-10-25](https://claude.ai/artifact/NAbA5F5ctEoNsmkZK4U5qa) · **Applies to:** [FR-LR-27](../functional/16-learning.md#fr-lr-27)

The [Glossary](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1352106063) (Woordenlijst, Confluence) is the source of names and of their explanation in Dutch. Every name is marked there "name, do not translate", with an explanation in one sentence. Data Hub uses that explanation for tooltips, and for the step Core idea of a Learning Card. Where the list of names lives is [OP-DH-42](../../overview/open-themes.md#op-dh-42).

<a id="nfr-loc-06"></a>
### NFR-LOC-06 · The interface follows the language of the User

**Status:** Proposed · **Source:** [Max, 2026-10-25](https://claude.ai/artifact/NAbA5F5ctEoNsmkZK4U5qa) · **Applies to:** [FR-SR-15](../functional/04-stacks-and-resources.md#fr-sr-15)

The interface follows the language preference of the User: Dutch by default, English available. The choice changes nothing about names, data or Query IDs. Notifications and Pre-flights have a Dutch and an English version, with the same parameters. Where a User chooses the language is [OP-DH-46](../../overview/open-themes.md#op-dh-46).

<a id="nfr-loc-07"></a>
### NFR-LOC-07 · The answers of the MCP server follow the same rule

**Status:** Proposed · **Source:** [Max, 2026-10-25](https://claude.ai/artifact/NAbA5F5ctEoNsmkZK4U5qa)

Claude gets names in English and explanations in the language of the User, so that people and agent use the same words.

<a id="nfr-loc-08"></a>
### NFR-LOC-08 · Learning Cards: Dutch sentences, English names

**Status:** Proposed · **Source:** [Max, 2026-10-25](https://claude.ai/artifact/NAbA5F5ctEoNsmkZK4U5qa) · **Applies to:** [OP-LR-02](../functional/16-learning.md#op-lr-02)

A Learning Card has Dutch sentences and English names, and never a Dutch synonym for a name. The first version is in Dutch; whether cards ever come in English too is [OP-DH-40](../../overview/open-themes.md#op-dh-40). The structure of a card, its five steps, does not depend on the language ([DEC-LR-10](../functional/16-learning.md#dec-lr-10)).

<a id="nfr-loc-09"></a>
### NFR-LOC-09 · Metadata written by people is in the language of the writer

**Status:** Proposed · **Source:** [Max, 2026-10-25](https://claude.ai/artifact/NAbA5F5ctEoNsmkZK4U5qa)

Metadata people write, such as the definition, open questions, Known Gaps and the log of changes, is in the language of the writer. The guideline is Dutch, with English names. Whether it stays a guideline is [OP-DH-41](../../overview/open-themes.md#op-dh-41).

## Acceptance criteria

For the functional analysis, from the proposal:

- Every screen consists of interface sentences, which are translated, and names, which are not; the analysis marks which text is which.
- Translation files hold no name of the Domain Model and no kind of asset.
- Every name that appears on a screen has a tooltip or an explanation inline, from the Glossary.
- Switching between Dutch and English changes only sentences: names, data, IDs and Lenses stay identical.
- Learning Cards follow the rule: Dutch sentences, English names, never a Dutch synonym.
- Notifications and Pre-flights have a Dutch and an English version with the same parameters.

## Why

- Colleagues already talk this way: "de creditLeads van KBC" (the creditLeads of KBC) is a Dutch sentence with an English name in it. The hub writes down what people say.
- Two vocabularies, an English one in the model and a Dutch one in the interface, force someone to choose and translate one day. That is the source of the confusion, not the solution.
- The Learning Centre builds exactly the bridge from the words of colleagues to the name: Why now speaks in the words of colleagues ("de leads die we naar KBC sturen", the leads we send to KBC), and Core idea attaches the name to it ("dat heet een `creditLead`", that is called a `creditLead`). A translation in between takes the bridge away.
- The Domain Model and the dbt layer stay untouched; nothing upstream is called into question.

## Builds on

- [Learning-centre: filosofie en guiding principles](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1381138494) (Confluence, Dutch)
- [Glossary](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1352106063) (Woordenlijst, Confluence, Dutch)
- The requirements of the [workshop of 2026-10-22](../../workshops/2026-10-22-data-agents-and-governance.md)
