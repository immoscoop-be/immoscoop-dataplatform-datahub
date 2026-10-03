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
| [REQ-004](REQ-004.md) | `periodComparison`: enkel een achterstand wordt gearceerd | 2026-10-02 | geïmplementeerd, vorm gewijzigd door REQ-055 | [1667f85](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/1667f85), [c013878](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/c013878) |
| [REQ-005](REQ-005.md) | `periodComparison`: enkel de focusreeks krijgt een band | 2026-10-02 | geïmplementeerd | [1667f85](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/1667f85), [59f0101](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/59f0101) |
| [REQ-006](REQ-006.md) | Een gemiddelde is een ruit; lopend is hol | 2026-10-02 | geïmplementeerd, gewijzigd door REQ-052 | [a238eb3](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/a238eb3) |
| [REQ-007](REQ-007.md) | Een hoeveelheid is een vierkant; lopend is hol | 2026-10-02 | geïmplementeerd, gewijzigd door REQ-052 | [a238eb3](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/a238eb3), [1667f85](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/1667f85) |
| [REQ-008](REQ-008.md) | Een mediaan is een bol; lopend is hol | 2026-10-02 | geïmplementeerd, gewijzigd door REQ-052 | [a238eb3](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/a238eb3) |
| [REQ-009](REQ-009.md) | Een licht vlak betekent enkel spreiding | 2026-10-02 | geïmplementeerd | [a238eb3](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/a238eb3) |
| [REQ-010](REQ-010.md) | Metadata in de aanroep: vraag, referenties, query, wie vroeg, wie werkte uit, datum van samenstelling | 2026-10-03 | geïmplementeerd | [10547b7](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/10547b7) |
| [REQ-011](REQ-011.md) | De datum van samenstelling staat altijd vet in de statusregel | 2026-10-03 | geïmplementeerd | [10547b7](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/10547b7) |
| [REQ-012](REQ-012.md) | De overige metadata links onderaan, één onderwerp per label | 2026-10-03 | geïmplementeerd, zoals gewijzigd door REQ-018 en REQ-020 | [10547b7](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/10547b7) |
| REQ-013 | Een icoon zonder inhoud blijft zichtbaar, gedimd en doorgestreept | 2026-10-03 | vervangen door REQ-020, nooit gebouwd | – |
| [REQ-014](REQ-014.md) | Bij hover groeit het label uit tot een paneel over de hele grafiek; sluiten na ongeveer 350 ms | 2026-10-03 | geïmplementeerd | [10547b7](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/10547b7) |
| [REQ-015](REQ-015.md) | Gedrag per toestel: muis enkel hover, tik op touch, Tab op het toetsenbord | 2026-10-03 | geïmplementeerd | [780050e](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/780050e), [10547b7](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/10547b7) |
| [REQ-016](REQ-016.md) | Alles met CSS in de SVG, zonder JavaScript; als afbeelding blijven de panelen verborgen | 2026-10-03 | geïmplementeerd voor SVG | [10547b7](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/10547b7) |
| REQ-017 | In een PNG gaat de metadata in de tekstvelden van het bestand | 2026-10-03 | aanvaard, nog niet nodig: er is nog geen PNG-uitvoer | – |
| [REQ-018](REQ-018.md) | Tekstlabels in plaats van iconen: Question, References, Query, Metadata | 2026-10-03 | geïmplementeerd | [10547b7](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/10547b7) |
| REQ-019 | Zonder query geen label Query | 2026-10-03 | vervangen door REQ-020 (de regel geldt nu voor alles) | – |
| [REQ-020](REQ-020.md) | Wat er niet is, wordt niet getoond: een label enkel als er inhoud achter zit | 2026-10-03 | geïmplementeerd | [10547b7](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/10547b7) |
| [REQ-021](REQ-021.md) | Eerste versie: Docker-image, Node, één semgraph als SVG via REST | 2026-10-02 (opdracht) | geïmplementeerd | [9a22b22](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/9a22b22) |
| [REQ-022](REQ-022.md) | Veel waarden: leesbaar blijven, met een label per waarde | 2026-10-02 (opdracht) | geïmplementeerd | [e89e5c9](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/e89e5c9), [a238eb3](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/a238eb3) |
| [REQ-023](REQ-023.md) | Kalenderperiodes; een lopende periode is hol | 2026-10-02 (opdracht) | geïmplementeerd, gewijzigd door REQ-052 en REQ-058 | [77b414a](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/77b414a), [59f0101](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/59f0101) |
| [REQ-024](REQ-024.md) | De mediaan naast het gemiddelde | 2026-10-02 (opdracht) | geïmplementeerd, contract gewijzigd door REQ-058 | [77b414a](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/77b414a), [59f0101](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/59f0101) |
| [REQ-025](REQ-025.md) | Klassen met overerving, geen codeduplicatie | 2026-10-02 (opdracht) | geïmplementeerd | [77b414a](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/77b414a) |
| [REQ-026](REQ-026.md) | De waardeas mag niet van nul beginnen, maar nooit stil | 2026-10-02 (opdracht) | geïmplementeerd | [77b414a](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/77b414a) |
| [REQ-027](REQ-027.md) | Hover in de statische SVG, zonder script | 2026-10-02 (opdracht) | geïmplementeerd | [ca4e93c](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/ca4e93c) |
| [REQ-028](REQ-028.md) | Met een band staat de vorm enkel op het laatste punt | 2026-10-03 | geïmplementeerd | [a238eb3](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/a238eb3) |
| [REQ-029](REQ-029.md) | Een rollend venster toont blokken die elkaar niet overlappen; de tijdas zoals in Figma | 2026-10-03 | geïmplementeerd, contract gewijzigd door REQ-058 | [16792e8](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/16792e8), [59f0101](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/59f0101) |
| [REQ-030](REQ-030.md) | Het laatste venster heet "nu" | 2026-10-03 | geïmplementeerd | [16792e8](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/16792e8) |
| [REQ-031](REQ-031.md) | Een venster van één dag: de dagwaarden | 2026-10-03 | geïmplementeerd, contract gewijzigd door REQ-058 | [16792e8](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/16792e8), [59f0101](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/59f0101) |
| [REQ-032](REQ-032.md) | Zonder spreiding: toegestaan, met een rode melding | 2026-10-03 | geïmplementeerd, contract gewijzigd door REQ-058 | [16792e8](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/16792e8), [1667f85](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/1667f85), [59f0101](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/59f0101) |
| [REQ-033](REQ-033.md) | Waardelabels: off, last, lastAndPrevious of all | 2026-10-03 | geïmplementeerd | [16792e8](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/16792e8) |
| [REQ-034](REQ-034.md) | `periodComparison`: de vergelijking is met wat niet op het scherm past, de verleden periode | 2026-10-03 | geïmplementeerd | [1667f85](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/1667f85) |
| [REQ-035](REQ-035.md) | `periodComparison`: beide lijnen tonen dezelfde waarde: de som, het gemiddelde of de mediaan | 2026-10-03 | geïmplementeerd, contract gewijzigd door REQ-058 | [1667f85](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/1667f85), [59f0101](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/59f0101) |
| [REQ-036](REQ-036.md) | Technische id's in de SVG zijn toegestaan (bv. een patroon voor arcering) | 2026-10-03 | geïmplementeerd | [1667f85](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/1667f85) |
| [REQ-037](REQ-037.md) | Vergelijk altijd met de periode vóór het scherm, even lang als het scherm; deel van de filosofie | 2026-10-03 | geïmplementeerd, contract gewijzigd door REQ-058 | [1667f85](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/1667f85), [59f0101](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/59f0101) |
| [REQ-038](REQ-038.md) | Elke getolereerde afwijking krijgt een rode melding | 2026-10-03 | geïmplementeerd | [1667f85](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/1667f85) |
| [REQ-039](REQ-039.md) | Dagwaarden houden de vorm van de semgraph en het minimum van 28 | 2026-10-03 | geïmplementeerd, contract gewijzigd door REQ-058 | [16792e8](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/16792e8), [59f0101](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/59f0101) |
| [REQ-040](REQ-040.md) | Een waarschuwing is een rood blok met witte tekst | 2026-10-03 | geïmplementeerd | [1667f85](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/1667f85) |
| [REQ-041](REQ-041.md) | De waarschuwing is een boodschap aan de lezer; het ongemak voor wie oplevert blijft impliciet | 2026-10-03 | geïmplementeerd | [ab03d0b](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/ab03d0b) |
| [REQ-042](REQ-042.md) | Geen voetregel "Buiten de grafiektaal": het rode blok zegt genoeg | 2026-10-03 | geïmplementeerd | [780050e](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/780050e) |
| [REQ-043](REQ-043.md) | Elk punt van een gemiddelde of mediaan kent zijn n; de n staat in het hoverkader | 2026-10-03 | geïmplementeerd | [59f0101](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/59f0101) |
| [REQ-044](REQ-044.md) | Weinig waarnemingen: n < 30 (gemiddelde), n < 10 (mediaan), of minder dan de helft van de mediaan van alle n's | 2026-10-03 | geïmplementeerd | [59f0101](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/59f0101) |
| REQ-045 | Een punt met weinig waarnemingen behoudt zijn vorm, bleek, ook in een band | 2026-10-03 | vervangen door REQ-053, nooit gebouwd | – |
| [REQ-046](REQ-046.md) | De n van zo'n punt staat klein onder de x-as | 2026-10-03 | geïmplementeerd | [59f0101](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/59f0101) |
| [REQ-047](REQ-047.md) | Weinig waarnemingen geeft een rode waarschuwing, maar is geen afwijking: het versielabel blijft | 2026-10-03 | geïmplementeerd | [59f0101](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/59f0101) |
| [REQ-048](REQ-048.md) | De hover op de datapunten volgt het gedrag per toestel van REQ-015 | 2026-10-03 (antwoord) | geïmplementeerd | [780050e](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/780050e) |
| [REQ-049](REQ-049.md) | De toestand van een periode is een patroon achter haar hele kolom | 2026-10-03 | geïmplementeerd | [72f61e8](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/72f61e8), [59f0101](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/59f0101) |
| [REQ-050](REQ-050.md) | Patronen zijn naadloze tegels, verankerd aan de plot: mozaïek 8 px, stippels 6 px, lijntjes 4 px | 2026-10-03 | geïmplementeerd | [72f61e8](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/72f61e8), [59f0101](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/59f0101) |
| [REQ-051](REQ-051.md) | Leeg: de kolom krijgt het mozaïek; geen omlijning meer | 2026-10-03 | geïmplementeerd | [72f61e8](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/72f61e8) |
| [REQ-052](REQ-052.md) | Lopend: fijne verticale lijntjes, de vorm blijft gevuld; de holle vorm vervalt | 2026-10-03 | geïmplementeerd | [72f61e8](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/72f61e8), [59f0101](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/59f0101) |
| [REQ-053](REQ-053.md) | Weinig waarnemingen: de kolom krijgt stippels, de vorm blijft gevuld; vervangt REQ-045 | 2026-10-03 | geïmplementeerd | [59f0101](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/59f0101) |
| [REQ-054](REQ-054.md) | Lopend wint van weinig waarnemingen | 2026-10-03 | geïmplementeerd | [59f0101](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/59f0101) |
| [REQ-055](REQ-055.md) | De arcering voor verlies: dalend, dun, zacht, op de achtergrondkleur | 2026-10-03 | geïmplementeerd | [c013878](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/c013878), [72f61e8](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/72f61e8) |
| [REQ-056](REQ-056.md) | Een gemiddelde van gemiddelden mag niet | 2026-10-03 (opdracht) | geïmplementeerd, door REQ-058 | [59f0101](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/59f0101) |
| [REQ-057](REQ-057.md) | Weinig waarnemingen enkel waar het veilig is, dus niet bij dagwaarden | 2026-10-03 (opdracht) | geïmplementeerd | [59f0101](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/59f0101) |
| [REQ-058](REQ-058.md) | De semgraph rekent geen data meer om: het warehouse levert per blok de waarde, de spreiding en n | 2026-10-03 (opdracht) | geïmplementeerd, zoals aangescherpt door REQ-062 | [59f0101](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/59f0101) |
| [REQ-059](REQ-059.md) | Zwart is te hard: de tekst is grey/700 | 2026-10-03 | geïmplementeerd | [59f0101](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/59f0101) |
| [REQ-060](REQ-060.md) | Het icoon van de semgraph links van de titel, in muted-grijs, gelinkt aan de leeskaart | 2026-10-03 | geïmplementeerd | [59f0101](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/59f0101) |
| [REQ-061](REQ-061.md) | Iconen uit een kleine vaste set, een zin in de grafiektaal | 2026-10-03 | geïmplementeerd (de iconen uit Figma, gecontroleerd) | [59f0101](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/59f0101) |
| [REQ-062](REQ-062.md) | Een blok heet `end` of `period`; n niet verplicht, maar zonder n een rode waarschuwing | 2026-10-03 (antwoord) | geïmplementeerd | [59f0101](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/59f0101) |
| [REQ-063](REQ-063.md) | n en weinig waarnemingen enkel bij een gemiddelde of mediaan van waarnemingen (`ratio`) | 2026-10-03 (antwoord) | geïmplementeerd | [59f0101](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/59f0101) |
| [REQ-064](REQ-064.md) | Unieken over een blok enkel als som; dagelijkse unieken nooit als som | 2026-10-03 (antwoord) | geïmplementeerd | [59f0101](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/59f0101) |

REQ-021 tot REQ-027 waren opdrachten in het gesprek met Claude, gegeven vóór de rijen REQ-001 tot REQ-009 op
Confluence stonden. Bij tegenspraak gaan REQ-001 tot REQ-009 dus voor. Hun commits dateren van vóór deze
afspraak en noemen daarom nog geen nummer.

REQ-010 tot REQ-020 (metadata van een grafiek) zijn geïmplementeerd zoals REQ-018 en REQ-020 ze wijzigden;
REQ-013 en REQ-019 zijn vervangen voor ze gebouwd werden, REQ-017 wacht op een PNG-uitvoer. REQ-028 tot REQ-041 zijn
de antwoorden van 2026-10-03 op de open punten. REQ-042 tot REQ-047 kwamen op 2026-10-03 op Confluence: REQ-042 is
gebouwd, REQ-043 tot REQ-047 zijn eerst te bespreken. REQ-048 is het antwoord van 2026-10-03 op de vraag over de
hover op de datapunten. REQ-049 tot REQ-055 zijn de data states uit Figma. REQ-056 en REQ-057 zijn de opdracht van
2026-10-03 over gemiddelden van gemiddelden en wanneer weinig waarnemingen veilig is; REQ-058 is de keuze die
daaruit volgt (het warehouse rekent) en REQ-062 het antwoord op de vragen over het contract. Daarmee zijn ook
REQ-043 tot REQ-047, REQ-053 en REQ-054 (weinig waarnemingen) gebouwd. REQ-059 tot REQ-061 (tekstkleur en iconen)
kwamen op 2026-10-03 uit Figma. REQ-063 en REQ-064 zijn de antwoorden van 2026-10-03 op de open punten over n en over
unieken over een blok; ze bevestigen hoe het al gebouwd was.

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

1. **REQ-017 (PNG).** Wacht op een PNG-uitvoer; v0 levert enkel SVG.

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
