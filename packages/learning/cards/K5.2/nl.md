---
number: K5.2
status: draft
minutes: 4
added: 2026-10-29
changed: 2026-10-29
gain: Je weet aan het Level van een Resource hoe ver je erop mag bouwen, en wie je vraagt als het zakt.
translatedFrom: e60857ca45bd
---

# Why now

> De tabel zegt 2 · Described. Mag ik ze in mijn rapport voor het managementteam zetten?
> — Een collega van marketing

Elke Resource in Data Hub draagt een Level, van 0 tot 5. Het geeft de data geen punten: het zegt hoe ver de Resource gekomen is, en wie ervoor instaat.

Promise: wat elk Level belooft, wie een Resource erheen tilt, en waarom ze zakt.

# Core idea

Het **Level** zegt hoeveel je op een Resource mag bouwen: op 2 · Described heeft het Data Team ze beschreven, vanaf 3 · Confirmed staat haar Owner ervoor in, en ze zakt zodra wegvalt waarop haar Level steunde.

## Zoals de uitgaven in een bibliotheek

Een bibliotheek geeft aan welke uitgave gecontroleerd en geannoteerd is. Je mag elke uitgave lezen, maar je citeert de gecontroleerde, en je kijkt opnieuw als de annotatie verdwijnt.

## Bijvoorbeeld

Weekly lead volume staat op 4 · Explored: het Data Team beschreef ze, het credit-team bevestigde ze en koppelde een EDA-document. Valt haar beschrijving weg in dbt, dan zakt ze naar 1 · Available, en haar Owner krijgt een melding.

# See it

```chart
{
  "semgraph": "categoryComparison",
  "metric": "resources",
  "title": "De Resources van één Collection per Level (voorbeeldcijfers)",
  "measureType": "additive",
  "statistic": "sum",
  "ordered": true,
  "period": "2026-09",
  "locale": "nl-BE",
  "context": { "domain": "Data Hub", "dataset": "Voorbeeld", "reliability": "voorbeeldcijfers" },
  "points": [
    { "category": "1 · Available", "sum": 12 },
    { "category": "2 · Described", "sum": 8 },
    { "category": "3 · Confirmed", "sum": 5 },
    { "category": "4 · Explored", "sum": 2 },
    { "category": "5 · Monitored", "sum": 0 }
  ]
}
```

Look at: de staven vanaf 3 · Confirmed.

You see: voor 7 van de 27 Resources staat een Owner in. Je mag ze allemaal lezen, maar voor je op de 20 eronder een rapport voor anderen bouwt, kijk je waarop ze steunen, of vraag je het hun Owner.

# Check your understanding

## Een Resource staat op 2 · Described. Wat vertelt je dat?

- [ ] Haar Owner controleerde dat haar cijfers kloppen
- [x] Het Data Team beschreef ze, en nog geen Owner heeft ze bevestigd
- [ ] Ze mag niet gebruikt worden

Why: op 2 · Described zijn de keuzes die van het Data Team; je mag ze gebruiken, wetende dat nog niemand van de business ze bevestigde. Vanaf 3 · Confirmed staat een Owner ervoor in.

## Het Level van een Resource die je gebruikt, zakte van 3 naar 1. Wat gebeurde er het waarschijnlijkst?

- [x] Er viel een beschrijving weg in dbt
- [ ] Iemand vond een fout in haar cijfers
- [ ] Ze verhuisde naar een andere Collection

Why: een Resource zakt als wegvalt waarop haar Level steunde: een beschrijving, haar EDA-document of haar laatste actieve check. Het Level zegt niets over of een cijfer fout is.

## Open een Collection en bekijk de Levels van haar Resources. Welk Level zegt je dat iemand van de business voor een Resource instaat?

Try it: [Open Collections](/collections)

- [ ] 2 · Described
- [x] 3 · Confirmed
- [ ] 1 · Available

Why: bevestigen doet de Owner als hij een Resource publiceert: hij verklaart dat ze is wat haar beschrijvingen zeggen.

# You can now

aan het Level van een Resource zien hoe ver je erop mag bouwen, en wie je vraagt als het zakt.

## Where to next

- Deeper: 3.3.3
- Next to it: K5.1
- Apply: [Open Collections](/collections) Zoek het Level van een Resource die je gebruikt, en waarop het steunt.
