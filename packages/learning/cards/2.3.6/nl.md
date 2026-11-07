---
number: 2.3.6
status: draft
minutes: 6
added: 2026-10-29
changed: 2026-10-29
gain: Je ziet aan het model type van een Resource wat je mag optellen, en wat nooit.
translatedFrom: 18ae05450c5e
---

# Why now

> Vorige week stonden er elke dag 52.000 panden online, dus 364.000 panden die week?
> — Een collega, bij het maken van een slide

Sommige tabellen mag je over de dagen optellen, andere nooit. Het verschil zit niet in de cijfers maar in wat één rij betekent, en elke Resource zegt het met zijn model type.

Promise: de vijf model types, en wat elk betekent voor tellen.

# Core idea

Het **model type** zegt wat één rij is, en daarmee wat je mag tellen: een `event` en een `fact` tel je op, een `state` tel je op een moment, een `dimension` beschrijft andere, en een `aggregate` tel je nooit opnieuw op.

## Zoals een winkel

De kasbonnen zijn events: tel ze op. De voorraad in de rekken is een state: je telt hem bij sluitingstijd, niet elk uur opgeteld. De prijslijst is een dimension: ze beschrijft de producten. Het weekrapport van de verkoop is een aggregate: zijn totalen zijn al gemaakt.

## Bijvoorbeeld

Een `event` is één rij per iets dat gebeurde, op een moment, en verandert daarna nooit, zoals een verstuurde lead. Een `state` is één rij per ding zoals het is, of was op een moment, zoals een pand dat op een dag online staat. Een `fact` is één rij per zakelijke gebeurtenis met de maten om op te tellen. Een `dimension` is één rij per ding dat andere beschrijft, zoals een kantoor. Een `aggregate` is één rij per groep met haar tellingen al gemaakt.

# See it

```chart
{
  "semgraph": "categoryComparison",
  "metric": "listingsOnline",
  "title": "Panden online op elke dag van één week (voorbeeldcijfers)",
  "measureType": "additive",
  "statistic": "sum",
  "ordered": true,
  "window": 7,
  "locale": "nl-BE",
  "context": { "domain": "Listings", "dataset": "Voorbeeld", "reliability": "voorbeeldcijfers" },
  "points": [
    { "category": "ma", "sum": 51800 },
    { "category": "di", "sum": 52100 },
    { "category": "wo", "sum": 52000 },
    { "category": "do", "sum": 52300 },
    { "category": "vr", "sum": 51900 },
    { "category": "za", "sum": 51700 },
    { "category": "zo", "sum": 52200 }
  ]
}
```

Look at: zeven staven van ongeveer 52.000, één per dag.

You see: grotendeels dezelfde panden, elke dag opnieuw geteld. Panden online is een state: de week heeft ongeveer 52.000 panden online, niet zeven keer zoveel.

# Check your understanding

## Een Resource heeft één rij per verstuurde lead, met haar moment. Welk model type is dat?

- [x] event
- [ ] state
- [ ] dimension

Why: een verstuurde lead gebeurde één keer, op een moment, en haar rij verandert daarna nooit: dat is een event, en zijn rijen mag je optellen.

## Een Resource heeft één rij per kantoor per week, met het aantal leads dat het kreeg. Wat mag je ermee doen?

- [ ] Zijn rijen over het jaar optellen om kantoren te tellen
- [x] Zijn tellingen lezen zoals ze gemaakt zijn, en de leads optellen, geen unieke tellingen
- [ ] Hem behandelen als een event

Why: het is een aggregate: zijn tellingen zijn al gemaakt. Een unieke telling opnieuw optellen zou kantoren dubbel tellen, zoals in 1.2.2.

## Open een Resource en bekijk zijn model type op zijn Overzicht. Welk woord toont hij?

Try it: [Open Collections](/collections)

- [x] Een van event, state, fact, dimension of aggregate
- [ ] Zijn aantal rijen
- [ ] De naam van zijn dbt-project

Why: elke Resource in een Collection noemt zijn model type, naast zijn grain, zodat je weet wat je mag tellen voor je hem opent in Query.

# You can now

de vijf model types uit elkaar houden, en van elk zeggen of je zijn rijen mag optellen.

## Where to next

- Next to it: 2.3.5
- Next to it: 1.2.2
- Apply: [Open Collections](/collections) Lees het model type van een Resource voor je iets optelt.
