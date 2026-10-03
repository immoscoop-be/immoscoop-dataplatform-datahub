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
| REQ-003 | `periodComparison`: twee lijnen op één tijdas | 2026-10-02 | open | – |
| REQ-004 | `periodComparison`: enkel een achterstand wordt gearceerd | 2026-10-02 | open | – |
| REQ-005 | `periodComparison`: enkel de focusreeks krijgt een band | 2026-10-02 | open | – |
| [REQ-006](REQ-006.md) | Een gemiddelde is een ruit; lopend is hol | 2026-10-02 | geïmplementeerd | [a238eb3](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/a238eb3) |
| REQ-007 | Een hoeveelheid is een vierkant; lopend is hol | 2026-10-02 | voorbereid | [a238eb3](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/a238eb3) |
| [REQ-008](REQ-008.md) | Een mediaan is een bol; lopend is hol | 2026-10-02 | geïmplementeerd | [a238eb3](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/a238eb3) |
| [REQ-009](REQ-009.md) | Een licht vlak betekent enkel spreiding | 2026-10-02 | geïmplementeerd | [a238eb3](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/a238eb3) |
| [REQ-010](REQ-010.md) | Eerste versie: Docker-image, Node, één semgraph als SVG via REST | 2026-10-02 (opdracht) | geïmplementeerd | [9a22b22](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/9a22b22) |
| [REQ-011](REQ-011.md) | Veel waarden: leesbaar blijven, met een label per waarde | 2026-10-02 (opdracht) | geïmplementeerd | [e89e5c9](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/e89e5c9), [a238eb3](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/a238eb3) |
| [REQ-012](REQ-012.md) | Kalenderperiodes; een lopende periode is hol | 2026-10-02 (opdracht) | geïmplementeerd | [77b414a](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/77b414a) |
| [REQ-013](REQ-013.md) | De mediaan naast het gemiddelde | 2026-10-02 (opdracht) | geïmplementeerd | [77b414a](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/77b414a) |
| [REQ-014](REQ-014.md) | Klassen met overerving, geen codeduplicatie | 2026-10-02 (opdracht) | geïmplementeerd | [77b414a](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/77b414a) |
| [REQ-015](REQ-015.md) | De waardeas mag niet van nul beginnen, maar nooit stil | 2026-10-02 (opdracht) | geïmplementeerd | [77b414a](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/77b414a) |
| [REQ-016](REQ-016.md) | Hover in de statische SVG, zonder script | 2026-10-02 (opdracht) | geïmplementeerd | [ca4e93c](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/ca4e93c) |
| [REQ-017](REQ-017.md) | Met een band staat de vorm enkel op het laatste punt | 2026-10-03 | geïmplementeerd | [a238eb3](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/a238eb3) |
| [REQ-018](REQ-018.md) | Een rollend venster toont blokken die elkaar niet overlappen; de tijdas zoals in Figma | 2026-10-03 | geïmplementeerd | [16792e8](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/16792e8) |
| [REQ-019](REQ-019.md) | Het laatste venster heet "nu" | 2026-10-03 | geïmplementeerd | [16792e8](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/16792e8) |
| [REQ-020](REQ-020.md) | Een venster van één dag: de dagwaarden | 2026-10-03 | geïmplementeerd | [16792e8](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/16792e8) |
| [REQ-021](REQ-021.md) | Zonder spreiding: toegestaan, met een rode melding | 2026-10-03 | geïmplementeerd | [16792e8](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/16792e8) |
| [REQ-022](REQ-022.md) | Waardelabels: off, last, lastAndPrevious of all | 2026-10-03 | geïmplementeerd | [16792e8](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/16792e8) |
| REQ-023 | `periodComparison`: de vergelijking is altijd met wat niet op het scherm past, de verleden periode | 2026-10-03 | open | – |
| REQ-024 | `periodComparison`: beide lijnen tonen dezelfde waarde: de som, het gemiddelde of de mediaan | 2026-10-03 | open | – |
| REQ-025 | Technische id's in de SVG zijn toegestaan (bv. een patroon voor arcering) | 2026-10-03 | aanvaard, nog niet nodig | – |

REQ-010 tot REQ-016 waren opdrachten in het gesprek met Claude, gegeven vóór de rijen REQ-001 tot REQ-009 op
Confluence stonden. Bij tegenspraak gaan REQ-001 tot REQ-009 dus voor. Hun commits dateren van vóór deze
afspraak en noemen daarom nog geen nummer.

REQ-017 tot REQ-025 zijn de antwoorden van 2026-10-03 op de open punten van 2026-10-02.

## Open punten, eerst te bespreken

Deze punten zijn niet geïmplementeerd, omdat ze meer dan één uitvoering toelaten. Bij elk punt staat een voorstel.

1. **`periodComparison`: wat is "de verleden periode"?** Beslist op 2026-10-03:
   - De vergelijking is altijd met wat niet op het scherm past: de verleden periode, een jaar of een maand of wat
     dan ook (REQ-023).
   - Beide lijnen tonen dezelfde waarde: de som, het gemiddelde of de mediaan (REQ-024).
   - Technische id's mogen (REQ-025).

   Nog open is hoe ver de vergelijkingslijn teruggaat. Er zijn twee lezingen:
   - **A, de periode net vóór het scherm, even lang als wat getoond wordt.**
     - 12 weken (W27–W38) → de 12 weken ervoor (W15–W26), met het label "vorige 12 weken".
     - Een jaar per maand → het jaar ervoor, met het label "vorig jaar".
     - 7 vensters van 7 dagen → de 49 dagen ervoor.
   - **B, een gekozen periode (vorig jaar, vorige maand) die minstens zo lang is als het scherm,** zodat ze er niet
     op past. Zo staat het in het Figma-voorbeeld "Leads per week, this year vs last year": 12 weken tegenover
     dezelfde weken vorig jaar (364 dagen terug).

   Voorstel: A, omdat "altijd" en "wat niet op het scherm past" daar het best bij passen. Het Figma-voorbeeld
   toont dan een heel jaar in plaats van 12 weken.

   Verder stel ik voor:
   - **Labels:** de laatste waarde van de focusreeks volgens `values` (REQ-022), en aan het einde van de grijze
     lijn "vorig jaar" of "vorige 12 weken".
   - **Som:** de som per periode is een hoeveelheid en wordt een vierkant (REQ-007). Een som van unieke aantallen
     wordt geweigerd.
2. **Rode melding ook voor de andere afwijkingen?**
   - De rode melding geldt nu enkel voor een gemiddelde of mediaan zonder spreiding (REQ-021).
   - Een venster dat geen 1 en geen veelvoud van 7 is, blijft een afwijking met enkel de melding in de voetregel.
   - Voorstel: elke getolereerde afwijking krijgt een rode melding met haar eigen tekst, om dezelfde reden: slecht
     gedrag ondersteunen maar ontmoedigen.
3. **Dagwaarden (REQ-020): welke vorm, en vanaf hoeveel dagen?**
   - **Vorm.** Een dagwaarde in `movingWindowAverage` is nu een ruit, in `movingWindowMedian` een bol. Een
     dagwaarde van een telling is eigenlijk een hoeveelheid, en dus een vierkant (REQ-007). Voorstel: zo laten, en
     het vierkant gebruiken zodra er een semgraph voor hoeveelheden is.
   - **Minimum.** `minimumPoints` (28 waarden) blijft gelden, dus dagwaarden vragen minstens 28 dagen, terwijl de
     Figma-as "Rolling 1d" er 7 toont. Voorstel: 28 houden.

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
