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

Alles hieronder is gebouwd op branch `claude/friendly-clarke-m7ru1i`.
[PR #1](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/pull/1), gemerged op 2026-10-03, bevat de commits
tot en met 4d05f0a. De latere commits staan op de branch en zitten nog in geen PR; elk bestand zegt welke.

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
| [REQ-010](REQ-010.md) | Metadata in de aanroep: vraag, referenties, query, wie vroeg, wie werkte uit, datum van samenstelling | 2026-10-03 | geïmplementeerd | [10547b7](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/10547b7) |
| [REQ-011](REQ-011.md) | De datum van samenstelling staat altijd vet in de statusregel | 2026-10-03 | geïmplementeerd | [10547b7](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/10547b7) |
| [REQ-012](REQ-012.md) | De overige metadata links onderaan, één onderwerp per label | 2026-10-03 | geïmplementeerd, zoals gewijzigd door REQ-018 en REQ-020 | [10547b7](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/10547b7) |
| REQ-013 | Een icoon zonder inhoud blijft zichtbaar, gedimd en doorgestreept | 2026-10-03 | vervangen door REQ-020, nooit gebouwd | – |
| [REQ-014](REQ-014.md) | Bij hover groeit het label uit tot een paneel over de hele grafiek; sluiten na ongeveer 350 ms | 2026-10-03 | geïmplementeerd | [10547b7](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/10547b7) |
| [REQ-015](REQ-015.md) | Gedrag per toestel: muis enkel hover, tik op touch, Tab op het toetsenbord; ook voor de datapunten | 2026-10-03 | geïmplementeerd | [780050e](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/780050e), [10547b7](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/10547b7) |
| [REQ-016](REQ-016.md) | Alles met CSS in de SVG, zonder JavaScript; als afbeelding blijven de panelen verborgen | 2026-10-03 | geïmplementeerd voor SVG | [10547b7](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/10547b7) |
| REQ-017 | In een PNG gaat de metadata in de tekstvelden van het bestand | 2026-10-03 | aanvaard, nog niet nodig: er is nog geen PNG-uitvoer | – |
| [REQ-018](REQ-018.md) | Tekstlabels in plaats van iconen: Question, References, Query, Metadata | 2026-10-03 | geïmplementeerd | [10547b7](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/10547b7) |
| REQ-019 | Zonder query geen label Query | 2026-10-03 | vervangen door REQ-020 (de regel geldt nu voor alles) | – |
| [REQ-020](REQ-020.md) | Wat er niet is, wordt niet getoond: een label enkel als er inhoud achter zit | 2026-10-03 | geïmplementeerd | [10547b7](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/10547b7) |
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
| [REQ-040](REQ-040.md) | Een waarschuwing is een rood blok met witte tekst | 2026-10-03 | geïmplementeerd | [1667f85](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/1667f85) |
| [REQ-041](REQ-041.md) | De waarschuwing is een boodschap aan de lezer; het ongemak voor wie oplevert blijft impliciet | 2026-10-03 | geïmplementeerd | [ab03d0b](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/ab03d0b) |
| [REQ-042](REQ-042.md) | Geen voetregel "Buiten de grafiektaal": het rode blok zegt genoeg | 2026-10-03 | geïmplementeerd | [780050e](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/780050e) |
| REQ-043 | Elk punt van een gemiddelde of mediaan kent zijn n; de n staat in het hoverkader | 2026-10-03 | open (zie open punt 1) | – |
| REQ-044 | Weinig waarnemingen: n < 30 (gemiddelde), n < 10 (mediaan), of minder dan de helft van de mediaan van alle n's | 2026-10-03 | open (zie open punt 1) | – |
| REQ-045 | Een punt met weinig waarnemingen behoudt zijn vorm, bleek, ook in een band | 2026-10-03 | open (zie open punten 1 en 2) | – |
| REQ-046 | De n van zo'n punt staat klein onder de x-as | 2026-10-03 | open (zie open punt 1) | – |
| REQ-047 | Weinig waarnemingen geeft een rode waarschuwing, maar is geen afwijking: het versielabel blijft | 2026-10-03 | open (zie open punt 1) | – |

REQ-021 tot REQ-027 waren opdrachten in het gesprek met Claude, gegeven vóór de rijen REQ-001 tot REQ-009 op
Confluence stonden. Bij tegenspraak gaan REQ-001 tot REQ-009 dus voor. Hun commits dateren van vóór deze
afspraak en noemen daarom nog geen nummer.

REQ-010 tot REQ-020 (metadata van een grafiek) zijn geïmplementeerd zoals REQ-018 en REQ-020 ze wijzigden;
REQ-013 en REQ-019 zijn vervangen voor ze gebouwd werden, REQ-017 wacht op een PNG-uitvoer. REQ-028 tot REQ-041 zijn
de antwoorden van 2026-10-03 op de open punten. REQ-042 tot REQ-047 kwamen op 2026-10-03 op Confluence: REQ-042 is
gebouwd, REQ-043 tot REQ-047 zijn eerst te bespreken.

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

1. **Weinig waarnemingen (REQ-043 tot REQ-047): wat is n?**
   - REQ-043 (2026-10-03): "Elk punt van een gemiddelde of mediaan kent zijn n, het aantal waarnemingen erachter."
   - REQ-044 (2026-10-03): "Een punt heeft weinig waarnemingen als n < 30 bij een gemiddelde of n < 10 bij een
     mediaan, of als n minder is dan de helft van de mediaan van alle n's in de grafiek (enkel vanaf vijf punten)."
   - Onze semgraphs krijgen dagwaarden ([REQ-021](REQ-021.md)). Een gemiddelde of mediaan gaat dus over dagen, en
     de enige n die de server kent is het aantal dagen achter een punt: 7 voor een venster van 7 dagen, 28 tot 31
     voor een maand, de dagen tot nu voor een lopende periode.
   - Met n = dagen maken de vaste drempels elk punt met minder dan 30 dagen bleek, met een rode waarschuwing: elk
     venster van 7 of 14 dagen en elke week. Dat botst met [REQ-031](REQ-031.md) (2026-10-03): "Veelvouden van 7
     zijn conform." De relatieve regel slaat bij een rollend venster nooit aan (n is altijd het venster), en bij
     kalenderperiodes enkel bij een lopende periode, die al hol is ([REQ-023](REQ-023.md)).
   - Het voorbeeld in Figma ("Credit leads per day, weekly mean", n 8, n 12, n 96) telt iets anders dan dagen:
     waarnemingen achter de waarde, zoals de leads achter een gemiddeld bedrag. Die geeft het contract vandaag niet
     mee.
   - Vraag: wat is een waarneming? Voorstel:
     - Bij de huidige semgraphs is een waarneming een dag. De n staat in het hoverkader (REQ-043), maar de drempels
       gelden niet voor dagen. Er wordt dus niets bleek en er komt geen waarschuwing.
     - Weinig waarnemingen gaat pas spelen met een nieuw soort metric: een gemiddelde of mediaan over waarnemingen,
       waarbij de aanroeper per dag meestuurt wat erachter zit (voor een gemiddelde `n`, de som en de som van de
       kwadraten; voor een mediaan de waarden zelf). Dan rekent de server gemiddelde, spreiding, mediaan en n over
       de waarnemingen, en gelden REQ-044 tot REQ-047 volledig. Uit te werken bij de eerste metric die het nodig
       heeft.
     - Een lopende periode met weinig waarnemingen houdt de rand van de holle vorm, met de bleke vulling erin.
2. **De bleke vorm op een lichte spreiding (REQ-045).** Op Confluence in discussie: in Figma valt een bleke ruit weg
   tegen de lichte balk of band. Daniel beslist over de tint.
3. **REQ-017 (PNG).** Wacht op een PNG-uitvoer; v0 levert enkel SVG.

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
