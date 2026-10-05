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
tot en met 4d05f0a. De latere commits zitten in [PR #2](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/pull/2);
elk bestand zegt welke.

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
| [REQ-063](REQ-063.md) | n en weinig waarnemingen enkel bij een gemiddelde of mediaan van waarnemingen (`ratio`) | 2026-10-03 (antwoord) | geïmplementeerd | [59f0101](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/59f0101), [52aa602](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/52aa602) |
| [REQ-064](REQ-064.md) | Unieken over een blok enkel als som; dagelijkse unieken nooit als som | 2026-10-03 (antwoord) | geïmplementeerd | [59f0101](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/59f0101), [52aa602](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/52aa602) |
| [REQ-065](REQ-065.md) | Bouw de semgraphs die in Figma uitgewerkt zijn | 2026-10-03 (opdracht) | gedeeltelijk: de verdeling van twee waarden wacht op REQ-072 | [7ef1593](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/7ef1593), [0e06464](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/0e06464), [ba3fadd](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/ba3fadd), [2c38f25](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/2c38f25) |
| [REQ-066](REQ-066.md) | Maanden zijn nooit staven | 2026-10-03 (antwoord) | geïmplementeerd | [7ef1593](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/7ef1593), [0e06464](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/0e06464) |
| [REQ-067](REQ-067.md) | Vergelijken buiten een tijdas: de periode ervoor of vorig jaar, de aanvraag kiest | 2026-10-03 (antwoord) | gedeeltelijk: twee keuzes bij de open punten | [0e06464](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/0e06464), [ba3fadd](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/ba3fadd) |
| [REQ-068](REQ-068.md) | Wat nog te winnen is: bollen die elkaar net raken | 2026-10-03 (antwoord) | geïmplementeerd | [2c38f25](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/2c38f25) |
| [REQ-069](REQ-069.md) | `kpiStatus`: het warehouse levert het pad, de semgraph rekent verschillen | 2026-10-03 (antwoord) | geïmplementeerd | [2c38f25](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/2c38f25) |
| [REQ-070](REQ-070.md) | `measureType` `perUnit`; `ratio` vraagt een teller en een noemer | 2026-10-03 (antwoord) | geïmplementeerd | [e6501f7](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/e6501f7) |
| [REQ-071](REQ-071.md) | Ratio en Cohort in de catalogus | 2026-10-03 (antwoord) | geïmplementeerd: beide gepland | [0b2b232](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/0b2b232) |
| REQ-072 | De verdeling van twee waarden wordt een eigen semgraph, na een analyse | 2026-10-03 (antwoord) | open: eerst een analyse | – |
| [REQ-073](REQ-073.md) | Een staaf begint bij nul; een gemiddelde of mediaan per categorie mag inzoomen | 2026-10-03 (antwoord) | geïmplementeerd | [0e06464](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/0e06464) |
| [REQ-074](REQ-074.md) | Een verhouding is een teller gedeeld door een noemer: aandeel en verhouding per eenheid | 2026-10-03 (Confluence) | geïmplementeerd voor aandelen; een verhouding per eenheid is een open punt | [d661e80](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/d661e80) |
| [REQ-075](REQ-075.md) | Een verhouding is een vierkant in een vierkant | 2026-10-03 (Confluence) | geïmplementeerd | [d661e80](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/d661e80) |
| [REQ-076](REQ-076.md) | Een verhouding over de tijd: de lijn, met haar noemer als grijze trap op een rechteras; `movingWindowRatio`, `calendarRatio` | 2026-10-03 (Confluence) | geïmplementeerd voor aandelen | [d661e80](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/d661e80) |
| [REQ-077](REQ-077.md) | Een gevulde traplijn op een datumas enkel voor de noemer | 2026-10-03 (Confluence) | geïmplementeerd; `kpiStatus` is een open punt | [d661e80](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/d661e80) |
| [REQ-078](REQ-078.md) | Een licht vlak: focuskleur is spreiding, grijs is basis | 2026-10-03 (Confluence) | geïmplementeerd | [d661e80](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/d661e80) |
| [REQ-079](REQ-079.md) | De tweede as: beide vanaf nul, dezelfde rasterlijnen, de noemer onder de verhouding | 2026-10-03 (Confluence) | geïmplementeerd | [d661e80](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/d661e80) |
| [REQ-080](REQ-080.md) | Weinig waarnemingen bij een verhouding: statistisch dun of een afwijkende basis | 2026-10-03 (Confluence) | geïmplementeerd | [d661e80](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/d661e80) |
| [REQ-081](REQ-081.md) | Weinig waarnemingen tegenover de periode ervoor en erna, in plaats van de mediaan | 2026-10-03 (Confluence) | geïmplementeerd op de tijdas; bij categorieën een open punt | [4cccd03](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/4cccd03) |
| [REQ-082](REQ-082.md) | Iconen voor de verhouding over de tijd | 2026-10-03 (Confluence) | geïmplementeerd | [d661e80](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/d661e80) |
| [REQ-083](REQ-083.md) | Een overzicht van de grafieken met links naar hun voorbeelden: `GET /semgraphs` en `GET /gallery` | 2026-10-03 (opdracht) | geïmplementeerd | [eba8d30](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/eba8d30) |
| [REQ-084](REQ-084.md) | De API als OpenAPI-document (`GET /openapi.json`), met Swagger UI op `/docs` | 2026-10-05 (opdracht) | geïmplementeerd | [a3db5c3](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/a3db5c3) |
| [REQ-085](REQ-085.md) | Vaste maten voor een grafiek: `card`, `default`, `large` (een slide), `xl` (een groot scherm); enkel de breedte | 2026-10-05 (opdracht) | geïmplementeerd; de breedtes zijn een open punt | [f8c1ef9](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/f8c1ef9) |
| REQ-086 | Kaarten van Vlaanderen: heat map, punten, vlakken per postcode, per provincie en per eigen vaste regio | 2026-10-05 (opdracht) | open: eerst de analyse | – |
| REQ-087 | Op een kaart ter referentie de belangrijkste steden, de grote verkeersassen en de waterlopen | 2026-10-05 (opdracht) | open: eerst de analyse | – |
| REQ-088 | De geografische basisbestanden eenmalig opbouwen; bij nieuwe of gewijzigde regio's eerst opnieuw bouwen | 2026-10-05 (opdracht) | open: eerst de analyse | – |
| REQ-089 | De regio's moeten niet zeer gedetailleerd getekend worden | 2026-10-05 (opdracht) | open: hoe grof is open punt 17 | – |
| [REQ-090](REQ-090.md) | Een MCP-server op `POST /mcp`, op dezelfde kern als REST: `list_semgraphs`, `describe_semgraph`, `validate_semgraph`, `render_semgraph`; ook lokaal op stdio | 2026-10-05 (opdracht) | geïmplementeerd | [e239d86](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/e239d86), [2d7a8c4](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/2d7a8c4) |
| [REQ-091](REQ-091.md) | Login op de MCP-server met OAuth en de accounts van de gate (Cognito Pool 1); zonder configuratie dicht | 2026-10-05 (opdracht) | geïmplementeerd in de applicatie; de infrastructuur is open punt 20 | [2d7a8c4](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/2d7a8c4), [b30fa49](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/b30fa49) |
| [REQ-092](REQ-092.md) | De grafiek in het gesprek: een MCP App met de SVG van de dienst, `default` inline, `large` in volledig scherm, downloaden, licht ook in donker | 2026-10-05 (opdracht) | geïmplementeerd | [2d7a8c4](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/2d7a8c4) |
| [REQ-093](REQ-093.md) | Claude vult de metadata in: de vraag, de query, wie vroeg en de datum | 2026-10-05 (opdracht) | geïmplementeerd | [2d7a8c4](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/2d7a8c4) |
| REQ-094 | Night mode: een donkere grafiek in een donker gesprek, na een donkere tokenmodus in Figma | 2026-10-05 (opdracht) | open: punt 18 | – |
| REQ-095 | De keuzehulp als MCP-tool `choose_semgraph` en als `POST /choose` | 2026-10-05 (opdracht) | open: punt 19 | – |

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
unieken over een blok; ze bevestigen hoe het al gebouwd was. REQ-065 is de opdracht om te bouwen wat in Figma uitgewerkt is;
REQ-066 tot REQ-073 zijn de antwoorden van 2026-10-03 op de acht vragen daarover. Alles is gebouwd, op de verdeling van
twee waarden na (REQ-072, eerst een analyse). REQ-074 tot REQ-082 kwamen op 2026-10-03 op Confluence: teller en
noemer, de verhouding over de tijd en haar tweede as, en de buurregel bij weinig waarnemingen. Ze zijn gebouwd voor
aandelen (`movingWindowRatio`, `calendarRatio`); de vragen die overblijven staan bij de open punten 9 tot 15.
REQ-083 is de opdracht voor een overzicht van de grafieken met hun voorbeelden; eerst genoteerd als REQ-074.
REQ-084 is de opdracht van 2026-10-05 om de API als Swagger-documentatie aan te bieden.
REQ-085 is de opdracht van 2026-10-05 om een grafiek in een vaste maat te laten tekenen.
REQ-086 tot REQ-089 zijn de opdrachten van 2026-10-05 voor kaarten. Eerst de analyse:
[Kaarten (analyse)](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1361674253) op Confluence, met de vragen bij
open punt 17.
REQ-090 tot REQ-095 zijn de opdracht van 2026-10-05 om Claude de semgraph te laten gebruiken, voor jezelf en voor
collega's, met de antwoorden in hetzelfde gesprek: een MCP-server (REQ-090), login met de gate-accounts (REQ-091),
de grafiek als MCP App (REQ-092) en de metadata die Claude invult (REQ-093). Night mode (REQ-094) en de keuzehulp als
tool (REQ-095) komen later. Wat het platform moet doen, staat in [docs/platform/mcp-access.md](../platform/mcp-access.md).

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

Ook op Confluence onder "In discussie": de punten 1 tot 7 zijn daar 14 tot 20, de punten 9 tot 16 zijn daar 22 tot 29.
Punt 21 daar is de kleur van de bollen (zie [REQ-068](REQ-068.md)). Punt 17 hieronder (kaarten) zijn daar de punten
30 tot 43. Tel op Confluence enkel de genummerde punten: de zes opsommingstekens onder punt 2 tellen niet mee.

1. **De mini-trend van de KPI-tegel met de periode ervoor.** REQ-067 (2026-10-03): "Een vergelijking buiten een
   tijdas (vergelijkingsstaaf, KPI-tegel en haar mini-trend) mag met de periode net ervoor of met vorig jaar".
   REQ-037 (2026-10-03): "Vergelijk met wat niet op het scherm staat." Met de periode ervoor is die periode het
   vorige punt van de mini-trend zelf. Voorstel, zo gebouwd: dan geen schaduwlijn; enkel het getal vergelijkt. Een
   schaduwlijn met de periode vóór het scherm (zoals `periodComparison`) zou een andere waarde tonen dan het getal.
2. **Een momentopname en vorig jaar.** REQ-067 noemt vensters (7 en 14 dagen tegenover 28 en 91) en
   kalenderperiodes, geen dag. Voorstel, zo gebouwd: een momentopname (`day`) vergelijkt standaard met vorig jaar,
   want de dag ervoor verschilt bij een voorraad zoals panden online haast niet.
3. **Cohort wacht ook op teller en noemer.** REQ-071 (2026-10-03): "Ratio wacht op de requirement over teller en
   noemer." Een cel van de Cohort is een aandeel (nog actief van de nieuwe in die maand), dus ook een ratio over de
   tijd. Voorstel: het warehouse levert per cel beide aantallen (nieuw en nog actief), de semgraph rekent enkel het
   aandeel, net zoals REQ-069 verschillen toelaat. De requirement over teller en noemer is er nu: REQ-076 doet het
   zo voor de verhouding over de tijd. Of de Cohort nu gebouwd wordt: punt 13.
4. **REQ-072: de analyse van de verdeling van twee waarden.** Welke eigenschap onderscheidt ze van `distribution`
   (de keuzehulp moet bij precies één semgraph uitkomen)? Voorstel: een nieuwe eigenschap in de woordenlijst, het
   aantal waarden (één of twee). En het contract: een raster van cellen met per cel het aantal, plus beide medianen,
   geteld in het warehouse.
5. **Een gemiddelde of mediaan vergelijken in een staafgrafiek.** Figma ontwerpt de vergelijking in één staaf enkel
   voor een hoeveelheid. Zo gebouwd: geweigerd (`comparisonOnlyForSum`), met `periodComparison` als alternatief.
   Is een vergelijking van een gemiddelde per categorie nodig?
6. **Een eenheid bij de tijdas en de KPI-tegel.** `categoryComparison` noemt de eenheid van de waarden `unit`
   ("€ "), maar op de tijdas is `unit` de kalendereenheid. Voorstel: `valueUnit` op de tijdas, de KPI-tegel en de
   KPI-status, en `unit` in `categoryComparison` laten zoals het is.
7. **De eerste waarde van een ingezoomde as op een lichte achtergrond.** REQ-026 (2026-10-03): "de eerste waarde
   vet". Figma (KPI status, Distribution of two values): "its first value is bold on a light background". Voorstel:
   ook de lichte achtergrond, op elke ingezoomde as.
8. **REQ-017 (PNG).** Wacht op een PNG-uitvoer; v0 levert enkel SVG.
9. **De buurregel bij categorieën (REQ-081).** REQ-081 (2026-10-03): "n kleiner dan de helft van het gemiddelde n
   van de periode ervoor en erna", voor "alle semgraphs met een gemiddelde of mediaan". Categorieën hebben geen
   periodes. Voorstel, zo gebouwd: de buurregel op de tijdas; bij categorieën blijft de regel van REQ-044.
10. **REQ-081 en "enkel vanaf vijf punten".** REQ-044 (2026-10-03): "(enkel vanaf vijf punten)". REQ-081 zegt er
    niets over. Voorstel, zo gebouwd: de voorwaarde verdwijnt mee; een lopende periode is geen buur.
11. **Een verhouding per eenheid tonen (REQ-074).** REQ-074 (2026-10-03): ratio omvat een aandeel en een verhouding
    per eenheid, "op dezelfde manier getoond". "3,4 panden per makelaar" staat niet in procent. Voorstel: `share:
    true` (procent, de teller is deel van de noemer) of `false` (een getal). Gebouwd: enkel aandelen; een teller
    groter dan de noemer wordt voorlopig geweigerd (`ratioPerUnitOpen`).
12. **Een verhouding van nul en "de twee kruisen nooit" (REQ-079).** Bij een verhouding van 0 ligt de lijn op de
    basislijn en kan de noemer er niet onder. Voorstel, zo gebouwd: zulke periodes tellen niet mee voor de schaal.
13. **`measureType: ratio` bij de andere semgraphs.** Gebouwd: `movingWindowRatio` en `calendarRatio`; een andere
    semgraph weigert `ratio` met die twee als alternatief. Bouw ik nu ook Ratio per categorie (Figma Chart/Ratio,
    met de lichte noemerstaaf) en de Cohort (`survival`, met per cel nieuw en nog actief), en mag een KPI-tegel een
    verhouding tonen?
14. **Het open vierkant (REQ-075) en "altijd gevuld" (REQ-052).** REQ-052 (2026-10-03): "The shape on a point stays
    filled in every state; there is no hollow or pale shape." REQ-075 (2026-10-03): "een open vierkant (de noemer)
    met een klein gevuld vierkant erin". Lezing, zo gebouwd: een eigen vorm, binnenin wit, geen toestand.
15. **De trap van `kpiStatus` en REQ-077.** REQ-077 (2026-10-03, de recentste): "een gevulde traplijn op een datumas
    is toegelaten, enkel voor de noemer van een verhouding … Nooit voor de metriek zelf." `kpiStatus`
    ([REQ-065](REQ-065.md), [REQ-068](REQ-068.md), 2026-10-03, naar Figma KPI status) tekent de cumulatieve stand als
    gevulde trap, een trede per periode. Voorstel: REQ-077 aanscherpen met een uitzondering voor een cumulatieve
    stand tegenover een pad. Niet gewijzigd tot het antwoord.
16. **De vaste maten van REQ-085.** Voorstel, zo gebouwd: `card` 360 px (zo breed als de KPI-tegel), `default` 640 px,
    `large` 1280 px (een slide van 16:9) en `xl` 1920 px (full HD of print). `large` en `xl` worden opgebouwd op 960
    en 1280 px en dan vergroot (×4/3 en ×1,5), zodat de tekst meegroeit; `card` en `default` houden de lettergroottes
    van de grafiektaal. Akkoord met die breedtes, en met de vergroting?
17. **Kaarten (REQ-086 tot REQ-089).** De analyse staat op
    [Confluence](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1361674253). De vragen staan daar onder "In
    discussie", punten 30 tot 43, met de letterlijke tekst van de requirements en een voorstel. In het kort:
    - de lichtste klasse van de kleurschaal is de lichte focustint, die volgens REQ-078 spreiding betekent;
    - een heat map in cellen van het zeshoekraster, niet uitgesmeerd (REQ-058);
    - geen som op vlakken van ongelijke grootte;
    - geen data en weinig waarnemingen op een vlak;
    - een punt op een kaart is een plaats (REQ-008), en nooit van een persoon;
    - de Kust-regio afknippen op het land;
    - herkomst en licentie van de postcodegrenzen (OPDA);
    - de 13 postcodes in twee regio's;
    - een `regionId` voor de regio's;
    - een eigenschap `geoUnit` voor de keuzehulp;
    - de referentielagen;
    - de klassen en de legende;
    - de postcodes van heel Vlaanderen op een card;
    - hoe grof een regio getekend wordt (REQ-089): voorstel 500 m voor regio's en provincies, 150 m voor postcodes.
18. **Night mode (REQ-094).** Claude vraagt dat een MCP App licht en donker ondersteunt. De tokens hebben in Figma één
    modus (Chart, mode Current) met een witte achtergrond. Beslist op 2026-10-05: voorlopig blijft de grafiek een
    lichte kaart, ook in een donker gesprek ([REQ-092](REQ-092.md)). Vraag aan Daniel: komt er een donkere modus van de
    tokens in Figma, met elke kleur en elk patroon (arcering, mozaïek, stippels, bollen) opnieuw nagekeken? Daarna
    rendert de server per thema (bv. `theme: dark`), en geeft de app het thema van Claude door.
19. **De keuzehulp als tool (REQ-095).** De analyse noemt `choose_semgraph` naast de andere tools; het kiesalgoritme
    (de vraag die de grootste overblijvende groep zo klein mogelijk maakt) is nog niet gebouwd, de woordenlijst en de
    conformiteitscontroles wel. Tot dan kiest Claude met de voorbeeldvragen en de regels "niet gebruiken als" uit
    `describe_semgraph`, en vangt de validatie een verkeerde keuze op. Vraag: wanneer bouwen we het, en eerst als
    `POST /choose` voor de wizard of meteen ook als tool?
20. **De infrastructuur voor de MCP-server (REQ-091).** Bij het platform (Ben Elsen): een OAuth-client in Cognito
    Pool 1, een uitzondering in de gate voor `/mcp` op de semgraph-host, de WAF en drie omgevingsvariabelen. Het
    voorstel staat in [docs/platform/mcp-access.md](../platform/mcp-access.md). Tot dan werkt de MCP-server enkel
    lokaal (stdio, of `MCP_AUTH=none`), en antwoordt `/mcp` op het platform 503.

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
