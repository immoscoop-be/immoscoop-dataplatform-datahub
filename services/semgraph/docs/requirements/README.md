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
- **open**: eerst scherp maken (zie de open punten hieronder).

Alles hieronder is gebouwd op branch `claude/friendly-clarke-m7ru1i`, in
[PR #1](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/pull/1).

| Nr | Requirement | Beslist | Status | Commits |
| --- | --- | --- | --- | --- |
| [REQ-000](REQ-000.md) | Basis: de regels in Figma vóór REQ-001 | 2026-10-02 | gedeeltelijk | [9a22b22](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/9a22b22), [77b414a](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/77b414a), [a238eb3](https://github.com/immoscoop-be/immoscoop-ptditt-semgraph/commit/a238eb3) |
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

REQ-010 tot REQ-016 waren opdrachten in het gesprek met Claude, gegeven vóór de rijen REQ-001 tot REQ-009 op
Confluence stonden. Bij tegenspraak gaan REQ-001 tot REQ-009 dus voor. Hun commits dateren van vóór deze
afspraak en noemen daarom nog geen nummer.

## Open punten, eerst te bespreken

Deze punten zijn niet geïmplementeerd, omdat requirements elkaar tegenspreken of meer dan één uitvoering toelaten.
Bij elk punt staat een voorstel.

1. **Rollend venster: één punt per dag of één punt per venster?**
   - In Figma (REQ-000, Time series) staat: "Every point is one block of time, not a moment" en "windows of 1, 7,
     14 or 91 days, labelled in steps of the window and ending at "now"". De x-as heeft daar 7 periodes,
     bijvoorbeeld −42d … now voor een venster van 7 dagen. Dat zijn dus vensters die elkaar niet overlappen.
   - Het uitgewerkte voorbeeld in de analyse rekent één punt per dag, voor het venster dat op die dag eindigt
     (horizon 28, venster 7: 28 punten). Zo is het nu gebouwd.
   - De keuze verandert enkel `MovingWindowChart.slots()`.
   - Voorstel: Figma volgen, want REQ-000 is de recentste bron. Eén punt per dag kan dan een expliciete variant
     blijven, als de dagelijkse resolutie gewenst is.
2. **Het label van het laatste punt op een rollende as.** Figma zegt "now". De analyse zegt "vandaag", of de datum
   als de laatste volledige dag ouder is dan gisteren; zo is het gebouwd. Voorstel: "nu" als de laatste volledige
   dag gisteren is, anders de datum.
3. **Welke vensters?**
   - Figma noemt vensters van 1, 7, 14 of 91 dagen, en tegelijk "altijd veelvouden van 7". Een venster van 1 is
     geen veelvoud van 7.
   - Het contract laat nu 2 tot 364 dagen toe. Wat geen veelvoud van 7 is, wordt getekend als getolereerde
     afwijking.
   - Voorstel: 1 toelaten als "dagwaarden" en elk veelvoud van 7 conform houden.
4. **Een gemiddelde of mediaan zonder spreiding.**
   - Figma (REQ-000) zegt: "A median or mean never appears without its spread."
   - Volgens de analyse is `spread: none` een getolereerde afwijking: getekend, met een melding in de voetregel.
     Zo is het gebouwd.
   - Voorstel: Figma volgen en `spread: none` weigeren (422).
5. **Waardelabels.**
   - Figma (REQ-000) zegt: "Values: Off by default; Last for rolling; Last + previous for calendar (previous =
     last final value, bold; current in grey); All only with one series and few points."
   - Gebouwd: altijd de laatste waarde, vet, met de spreiding als detail.
   - Voorstel: een contractveld `values` met `off`, `last`, `lastAndPrevious` of `all`. De standaard is `last` voor
     een rollend venster en `lastAndPrevious` voor kalenderperiodes. "Off by default" lees ik als de standaard
     van het Figma-component.
6. **`periodComparison` (REQ-003, REQ-004, REQ-005).** De tekening is duidelijk, in Figma onder
   [Period comparison](https://www.figma.com/design/X9FMecd5iH6jIced8nZQf6?node-id=184-423): twee lijnen, enkel
   een achterstand gearceerd, enkel de focusreeks met een band. Het contract is nog niet scherp:
   - **Vergelijken met wat?** REQ-003 zegt "een vorige periode". Figma toont "last year" (364 dagen terug, zodat
     de weekdagen samenvallen). Voorstel: `compareWith: previousYear | previousPeriod`. Bij maanden en kwartalen
     betekent vorig jaar dezelfde maand of hetzelfde kwartaal, niet 364 dagen terug.
   - **Welke reeksen?** Figma toont drie varianten: een hoeveelheid (som per periode, vierkant, REQ-007), een
     gemiddelde per dag (ruit met band) en een mediaan per dag (bol met band). Voorstel: drie semgraphs op de
     bestaande klassen, of één semgraph met een veld voor de statistiek. Een som van unieke aantallen is nooit
     toegelaten.
   - **Arcering (REQ-004).** Een SVG-patroon heeft een `id` nodig, en dat botst met "geen id's" uit REQ-016
     (meerdere grafieken op één pagina). Voorstel: de arceerlijnen zelf berekenen en tekenen, zonder patroon en
     zonder id.
   - **Labels aan het einde.** Figma toont de laatste waarde van de focusreeks ("427", "61 /day") en "last year" bij
     de vergelijkingslijn. Voorstel: zo overnemen, met "vorig jaar" of "vorige maand" afhankelijk van
     `compareWith`.
7. **Nog te bouwen uit REQ-000, zonder discussie.** Een langere, donkerdere tick bij een jaarwissel, en het label
   "lopend"/"current" onder het holle punt in plaats van naast de waarde. Zie [REQ-000](REQ-000.md).

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
