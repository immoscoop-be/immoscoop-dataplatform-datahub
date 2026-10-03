# Requirements

Hier staan de functionele requirements van de grafiekserver die geïmplementeerd zijn. Vanaf dat moment is dit de
bron van waarheid, niet meer Confluence.

- **Nieuwe requirements** worden verzameld op Confluence:
  [ptditt - Tooling - Grafiekserver - Requirements grafiektaal](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1359872021).
- **De regels zelf** staan in Figma ([bestand grafiektaal](https://www.figma.com/design/X9FMecd5iH6jIced8nZQf6)).
- **Hoe we met requirements werken**, ook met tegenstrijdige, staat in [CLAUDE.md](../../CLAUDE.md).

## Werkwijze in het kort

1. Een requirement krijgt een nummer en een datum van beslissing op Confluence. Ook een opdracht die daar nog
   niet stond, krijgt er een rij.
2. Een nieuwe requirement wordt naast de bestaande gelegd. Bij tegenspraak of twijfel wordt ze eerst besproken en
   scherp gemaakt, en pas dan geïmplementeerd. Bij tegenspraak geldt de recentste beslissing.
3. Commits en code verwijzen naar het nummer (`REQ-006: mean as diamond`).
4. Eens geïmplementeerd krijgt de requirement hier een bestand. Op Confluence komen branch, commit, PR en een link
   naar dat bestand.
5. Wijzigt een geïmplementeerde requirement, dan wordt dat een nieuwe requirement die naar de oude verwijst. Het
   oude bestand krijgt "vervangen door REQ-yyy".

## Register

Statussen:

- **geïmplementeerd**: gebouwd en met tests.
- **gedeeltelijk**: een deel is gebouwd; wat ontbreekt staat in het bestand.
- **voorbereid**: de regel staat in de code, maar nog geen semgraph gebruikt ze.
- **aanvaard, nog niet nodig**: beslist, maar er is nog geen code die het nodig heeft.
- **open**: eerst scherp maken (zie de open punten hieronder).

Alles hieronder is gebouwd op branch `claude/friendly-clarke-m7ru1i`, in
[PR #1](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/pull/1).

| Nr | Requirement | Beslist | Status | Commits |
| --- | --- | --- | --- | --- |
| [REQ-000](REQ-000.md) | Basis: de regels in Figma vóór REQ-001 | 2026-10-02 | gedeeltelijk | [9a22b22](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/9a22b22), [77b414a](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/77b414a), [a238eb3](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/a238eb3), [16792e8](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/16792e8) |
| [REQ-001](REQ-001.md) | Een datumas is altijd een lijn, nooit staven | 2026-10-02 | geïmplementeerd | [a238eb3](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/a238eb3) |
| [REQ-002](REQ-002.md) | Staven enkel voor categorieën, nooit op een datumas | 2026-10-02 | geïmplementeerd | [a238eb3](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/a238eb3) |
| [REQ-003](REQ-003.md) | `periodComparison`: twee lijnen op één tijdas | 2026-10-02 | geïmplementeerd | [1667f85](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/1667f85) |
| [REQ-004](REQ-004.md) | `periodComparison`: enkel een achterstand wordt gearceerd | 2026-10-02 | geïmplementeerd | [1667f85](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/1667f85) |
| [REQ-005](REQ-005.md) | `periodComparison`: enkel de focusreeks krijgt een band | 2026-10-02 | geïmplementeerd | [1667f85](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/1667f85) |
| [REQ-006](REQ-006.md) | Een gemiddelde is een ruit; lopend is hol | 2026-10-02 | geïmplementeerd | [a238eb3](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/a238eb3) |
| [REQ-007](REQ-007.md) | Een hoeveelheid is een vierkant; lopend is hol | 2026-10-02 | geïmplementeerd | [a238eb3](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/a238eb3), [1667f85](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/1667f85) |
| [REQ-008](REQ-008.md) | Een mediaan is een bol; lopend is hol | 2026-10-02 | geïmplementeerd | [a238eb3](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/a238eb3) |
| [REQ-009](REQ-009.md) | Een licht vlak betekent enkel spreiding | 2026-10-02 | geïmplementeerd | [a238eb3](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/a238eb3) |
| REQ-010 | Metadata in de aanroep: vraag, referenties, query, wie vroeg, wie werkte uit, datum van samenstelling | 2026-10-03 | open | – |
| REQ-011 | De datum van samenstelling staat altijd vet in de statusregel | 2026-10-03 | open | – |
| REQ-012 | De overige metadata achter vier iconen links onderaan | 2026-10-03 | open, gewijzigd door REQ-018 | – |
| REQ-013 | Een icoon zonder inhoud blijft zichtbaar, gedimd en doorgestreept | 2026-10-03 | vervangen door REQ-020 | – |
| REQ-014 | Bij hover groeit het label uit tot een paneel over de hele grafiek; sluiten na ongeveer 350 ms | 2026-10-03 | open | – |
| REQ-015 | Gedrag per toestel: muis enkel hover, tik op touch, Tab op het toetsenbord | 2026-10-03 | open | – |
| REQ-016 | Alles met CSS in de SVG, zonder JavaScript; als afbeelding blijven de panelen verborgen | 2026-10-03 | open | – |
| REQ-017 | In een PNG gaat de metadata in de tekstvelden van het bestand | 2026-10-03 | open | – |
| REQ-018 | Tekstlabels in plaats van iconen: Question, References, Query, Metadata | 2026-10-03 | open | – |
| REQ-019 | Zonder query geen label Query | 2026-10-03 | vervangen door REQ-020 | – |
| REQ-020 | Wat er niet is, wordt niet getoond: een label enkel als er inhoud achter zit | 2026-10-03 | open | – |
| [REQ-021](REQ-021.md) | Eerste versie: Docker-image, Node, één semgraph als SVG via REST | 2026-10-02 (opdracht) | geïmplementeerd | [9a22b22](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/9a22b22) |
| [REQ-022](REQ-022.md) | Veel waarden: leesbaar blijven, met een label per waarde | 2026-10-02 (opdracht) | geïmplementeerd | [e89e5c9](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/e89e5c9), [a238eb3](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/a238eb3) |
| [REQ-023](REQ-023.md) | Kalenderperiodes; een lopende periode is hol | 2026-10-02 (opdracht) | geïmplementeerd | [77b414a](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/77b414a) |
| [REQ-024](REQ-024.md) | De mediaan naast het gemiddelde | 2026-10-02 (opdracht) | geïmplementeerd | [77b414a](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/77b414a) |
| [REQ-025](REQ-025.md) | Klassen met overerving, geen codeduplicatie | 2026-10-02 (opdracht) | geïmplementeerd | [77b414a](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/77b414a) |
| [REQ-026](REQ-026.md) | De waardeas mag niet van nul beginnen, maar nooit stil | 2026-10-02 (opdracht) | geïmplementeerd | [77b414a](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/77b414a) |
| [REQ-027](REQ-027.md) | Hover in de statische SVG, zonder script | 2026-10-02 (opdracht) | geïmplementeerd | [ca4e93c](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/ca4e93c) |
| [REQ-028](REQ-028.md) | Met een band staat de vorm enkel op het laatste punt | 2026-10-03 | geïmplementeerd | [a238eb3](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/a238eb3) |
| [REQ-029](REQ-029.md) | Een rollend venster toont blokken die elkaar niet overlappen; de tijdas zoals in Figma | 2026-10-03 | geïmplementeerd | [16792e8](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/16792e8) |
| [REQ-030](REQ-030.md) | Het laatste venster heet "nu" | 2026-10-03 | geïmplementeerd | [16792e8](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/16792e8) |
| [REQ-031](REQ-031.md) | Een venster van één dag: de dagwaarden | 2026-10-03 | geïmplementeerd | [16792e8](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/16792e8) |
| [REQ-032](REQ-032.md) | Zonder spreiding: toegestaan, met een rode melding | 2026-10-03 | geïmplementeerd | [16792e8](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/16792e8), [1667f85](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/1667f85) |
| [REQ-033](REQ-033.md) | Waardelabels: off, last, lastAndPrevious of all | 2026-10-03 | geïmplementeerd | [16792e8](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/16792e8) |
| [REQ-034](REQ-034.md) | `periodComparison`: de vergelijking is met wat niet op het scherm past, de verleden periode | 2026-10-03 | geïmplementeerd | [1667f85](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/1667f85) |
| [REQ-035](REQ-035.md) | `periodComparison`: beide lijnen tonen dezelfde waarde: de som, het gemiddelde of de mediaan | 2026-10-03 | geïmplementeerd | [1667f85](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/1667f85) |
| [REQ-036](REQ-036.md) | Technische id's in de SVG zijn toegestaan (bv. een patroon voor arcering) | 2026-10-03 | geïmplementeerd | [1667f85](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/1667f85) |
| [REQ-037](REQ-037.md) | Vergelijk altijd met de periode vóór het scherm, even lang als het scherm; deel van de filosofie | 2026-10-03 | geïmplementeerd | [1667f85](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/1667f85) |
| [REQ-038](REQ-038.md) | Elke getolereerde afwijking krijgt een rode melding | 2026-10-03 | geïmplementeerd | [1667f85](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/1667f85) |
| [REQ-039](REQ-039.md) | Dagwaarden houden de vorm van de semgraph en het minimum van 28 | 2026-10-03 | geïmplementeerd | [16792e8](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/16792e8) |
| [REQ-040](REQ-040.md) | Een waarschuwing is een rood blok met witte tekst: wie oplevert, verantwoordt zich | 2026-10-03 | geïmplementeerd | [1667f85](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/1667f85) |

REQ-021 tot REQ-027 waren opdrachten in het gesprek met Claude, gegeven vóór de rijen REQ-001 tot REQ-009 op
Confluence stonden. Bij tegenspraak gaan REQ-001 tot REQ-009 dus voor. Hun commits dateren van vóór deze
afspraak en noemen daarom nog geen nummer.

REQ-010 tot REQ-020 (metadata van een grafiek) staan op Confluence en zijn nog niet geïmplementeerd: Confluence is
hun bron. REQ-028 tot REQ-040 zijn de antwoorden van 2026-10-03 op de open punten.

### Hernummering

De requirements uit het gesprek kregen eerst de nummers REQ-010 tot REQ-025. Op Confluence waren die nummers
intussen al gegeven aan de metadata van een grafiek, dus volgens de afspraak (het volgende vrije nummer) kregen ze
REQ-021 tot REQ-036. De commits 4d05f0a, 16792e8 en 9ac7a56 noemen nog de oude nummers:

| Oud | Nieuw | Oud | Nieuw | Oud | Nieuw | Oud | Nieuw |
| --- | --- | --- | --- | --- | --- | --- | --- |
| REQ-010 | REQ-021 | REQ-014 | REQ-025 | REQ-018 | REQ-029 | REQ-022 | REQ-033 |
| REQ-011 | REQ-022 | REQ-015 | REQ-026 | REQ-019 | REQ-030 | REQ-023 | REQ-034 |
| REQ-012 | REQ-023 | REQ-016 | REQ-027 | REQ-020 | REQ-031 | REQ-024 | REQ-035 |
| REQ-013 | REQ-024 | REQ-017 | REQ-028 | REQ-021 | REQ-032 | REQ-025 | REQ-036 |

## Open punten, eerst te bespreken

1. **Metadata van een grafiek (REQ-010 tot REQ-020): bouwen?** Ze spreken geen gebouwde requirement tegen;
   REQ-020 heeft al voorrang op REQ-013, REQ-018 en REQ-019. Eén punt raakt de hover van de datapunten (REQ-027):
   - REQ-015 zegt dat een muisklik niets openhoudt.
   - Bij de hover van de datapunten blijft het kader nu open na een klik, omdat de klik de focus zet.
   - Voorstel: dezelfde regels per toestel voor beide. Met de muis enkel hover, een tik op touch, Tab op het
     toetsenbord.

## Sjabloon voor een requirement

```markdown
# REQ-xxx · Korte titel

| | |
| --- | --- |
| Beslist | JJJJ-MM-DD · Confluence of opdracht |
| Bron | Figma-node of analyse |
| Geldt voor | semgraphs |
| Status | geïmplementeerd |
| Implementatie | branch, commits, PR |

## Requirement

> De tekst zoals beslist.

## Zo geïmplementeerd

## Code en tests

## Samenhang

Welke requirements ze verfijnt, vervangt of aanvult.
```
