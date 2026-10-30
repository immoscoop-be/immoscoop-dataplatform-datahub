---
number: 1.2.2
status: draft
minutes: 5
added: 2026-10-29
changed: 2026-10-29
gain: Je beantwoordt "waarom tellen de weken niet op tot de maand?" zelf, in een minuut, in plaats van het aan het Data Team te vragen.
translatedFrom: fa5fc8014626
---

# Why now

> Het rapport zegt 61.000 bezoekers vorige maand, maar de vier weken tellen op tot 82.000. Welke klopt niet?
> — Een collega van sales, op een maandag

Die vraag hoor je opnieuw, telkens een maand naast haar weken of dagen staat. Beide cijfers kloppen, en een dashboard dat de dagen voor je optelt, doet het fout zonder het te zeggen.

Promise: waarom de weken van een unieke telling nooit optellen tot de maand.

# Core idea

Een **unieke telling** telt iedereen één keer per periode, dus de tellingen van kortere periodes tellen nooit op tot die van de langere.

## Zoals een gastenlijst

Wie op vrijdag en op zaterdag komt, staat op de lijst van beide avonden, maar is één gast van het weekend.

## Bijvoorbeeld

Op maandag komen 4.000 mensen, op dinsdag 3.000. Samen zijn dat er minstens 4.000 en hoogstens 7.000: wie beide dagen kwam, telt één keer. Paginaweergaven en leads zijn niet uniek: die mag je wel optellen.

# See it

```chart
{
  "semgraph": "categoryComparison",
  "metric": "visitors",
  "title": "Eén week bezoekers (voorbeeldcijfers)",
  "measureType": "unique",
  "uniqueAggregation": "overPeriod",
  "statistic": "sum",
  "period": "2026-W40",
  "locale": "nl-BE",
  "context": { "domain": "Website", "dataset": "Voorbeeld", "reliability": "voorbeeldcijfers" },
  "points": [
    { "category": "De zeven dagen opgeteld", "sum": 9800 },
    { "category": "Unieke bezoekers in de week", "sum": 6100 }
  ]
}
```

Look at: de twee staven van dezelfde week: de dagen opgeteld, en de bezoekers geteld over de hele week.

You see: 3.700 meer in de eerste staaf. Dat zijn mensen die op meer dan één dag kwamen: de dagen optellen telt hen opnieuw, dus de week is lager, en juist.

# Check your understanding

## In januari stuurden 9.000 mensen een creditLead, in februari 7.000. Hoeveel mensen stuurden er één in de twee maanden samen?

- [ ] 16.000
- [x] Minstens 9.000 en hoogstens 16.000
- [ ] 8.000, het gemiddelde van beide

Why: wie in beide maanden een lead stuurde, telt één keer in de twee samen, dus het totaal ligt tussen de drukste maand en de som van beide.

## Welke van deze mag je optellen over de dagen van een maand?

- [ ] Unieke bezoekers
- [x] Paginaweergaven
- [ ] Unieke gepubliceerde panden

Why: paginaweergaven zijn niet uniek: elke weergave telt, dus de dagen tellen op tot de maand. Unieke bezoekers en unieke gepubliceerde panden vragen een telling over de hele maand.

## Elk kwartaal kregen ongeveer 300 kantoren een listingLead. Over het jaar zegt de telling 420 kantoren, niet 1.200. Wat is er gebeurd?

- [x] Niets is fout: de meeste kantoren kregen in meer dan één kwartaal leads
- [ ] Het jaar mist data
- [ ] De kwartalen tellen sommige kantoren per vergissing dubbel

Why: beide cijfers kloppen. Een kwartaal telt een kantoor één keer per kwartaal, het jaar één keer in het jaar, dus het jaar is lager dan de som van zijn kwartalen.

## Welk label zegt je dat een cijfer een unieke telling is?

- [ ] Sessies
- [x] Distinct users
- [ ] Paginaweergaven

Why: "distinct" en "uniek" betekenen dat elk één keer telt. Sessies en paginaweergaven tellen elk bezoek en elke weergave.

# You can now

een unieke telling herkennen aan haar label, en uitleggen waarom haar dagen, weken of maanden nooit optellen.

## Where to next

- Deeper: 2.3.5
- Next to it: 2.3.6
- Apply: [Open Query](/query/new) Tel de bezoekers van een maand in één query, over de hele maand, en vergelijk dat met haar dagen opgeteld.
