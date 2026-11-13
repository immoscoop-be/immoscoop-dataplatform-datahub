---
number: K5.4
status: draft
minutes: 4
added: 2026-11-12
changed: 2026-11-12
gain: Ziet een recent cijfer er raar uit, dan weet je of het fout is of dat de data nog binnenkomt.
translatedFrom: b6f06dc58ac9
---

# Why now

> Deze cijfers zijn raar.
> — Een collega, bij de meest recente dagen van een dashboard

Ze keken naar een periode waarvan de data nog binnenkwam. Voor die dagen zijn rare cijfers normaal, en ze verschuiven nog van de ene dag op de andere.

Promise: hoe je een cijfer dat fout is onderscheidt van een cijfer dat nog niet af is.

# Core idea

Een recent cijfer is pas definitief na zijn rijpingstijd, de **Stability** van zijn Resource: daarvoor is het niet fout, alleen nog niet af.

## Zoals een verkiezingsavond

Op een verkiezingsavond zijn de eerste gemeenten vroeg geteld, en het beeld schuift nog als de grote steden binnenkomen. Niemand noemt de eerste telling fout: ze is nog niet af. Op een gegeven moment is elke stem geteld, en weet je dat de uitslag niet meer zal veranderen.

## Bij Immoscoop

Sessies worden ingedeeld met data van Google Ads, die over zeven dagen binnenkomt. De sessies staan er de volgende ochtend, maar of ze betaald waren, verschuift nog een week: de betaalde sessies van de laatste zeven dagen lijken laag tot die week voorbij is. Data Hub heeft nog geen veld voor de Stability: zoek ze onder Let op bij de Resource, in de valkuilen die haar Owner schrijft, en vraag het haar Owner als ze er niet staat.

# See it

```chart
{
  "semgraph": "movingWindowAverage",
  "metric": "paidSessions",
  "title": "Betaalde sessies per dag, zoals geteld op 26 oktober (voorbeeldcijfers)",
  "measureType": "additive",
  "window": 1,
  "asOf": "2026-10-25",
  "locale": "nl-BE",
  "context": { "domain": "Sessies", "dataset": "Voorbeeld", "reliability": "voorbeeldcijfers" },
  "points": [
    { "end": "2026-09-28", "mean": 1180 },
    { "end": "2026-09-29", "mean": 1150 },
    { "end": "2026-09-30", "mean": 1120 },
    { "end": "2026-10-01", "mean": 1190 },
    { "end": "2026-10-02", "mean": 1100 },
    { "end": "2026-10-03", "mean": 960 },
    { "end": "2026-10-04", "mean": 990 },
    { "end": "2026-10-05", "mean": 1170 },
    { "end": "2026-10-06", "mean": 1140 },
    { "end": "2026-10-07", "mean": 1160 },
    { "end": "2026-10-08", "mean": 1130 },
    { "end": "2026-10-09", "mean": 1090 },
    { "end": "2026-10-10", "mean": 940 },
    { "end": "2026-10-11", "mean": 1010 },
    { "end": "2026-10-12", "mean": 1200 },
    { "end": "2026-10-13", "mean": 1150 },
    { "end": "2026-10-14", "mean": 1120 },
    { "end": "2026-10-15", "mean": 1170 },
    { "end": "2026-10-16", "mean": 1110 },
    { "end": "2026-10-17", "mean": 970 },
    { "end": "2026-10-18", "mean": 1000 },
    { "end": "2026-10-19", "mean": 1130 },
    { "end": "2026-10-20", "mean": 1040 },
    { "end": "2026-10-21", "mean": 930 },
    { "end": "2026-10-22", "mean": 850 },
    { "end": "2026-10-23", "mean": 660 },
    { "end": "2026-10-24", "mean": 450 },
    { "end": "2026-10-25", "mean": 330 }
  ]
}
```

Look at: de laatste zeven dagen, rechts van −7d.

You see: ze zakken stap voor stap, tot 330 op de laatste dag, tegenover ongeveer 950 tot 1.200 op de dagen ervoor. Er zakte niets: die dagen worden nog ingedeeld, en een week later staan ze even hoog als de dagen ervoor.

# Check your understanding

## De valkuilen van een Resource met leads zeggen dat late leads tot drie dagen later binnenkomen. Gisteren toont 30% minder leads dan een gewone dag. Wat doe je?

- [ ] Een Signal sturen: de leads zakten gisteren
- [x] Wachten tot gisteren drie dagen oud is, en het dan vergelijken
- [ ] Gisteren voorgoed uit je rapporten laten

Why: drie dagen lang is gisteren niet af: er komen nog late leads binnen. Zijn die dagen voorbij, dan is het cijfer definitief, en pas dan is een daling een daling.

## Elke ochtend neemt een collega het cijfer van de dag ervoor over in een spreadsheet, om de trend te volgen. De data komt nog vijf dagen lang binnen. Wat toont de spreadsheet?

- [ ] De echte trend, één dag later
- [x] Een trend die te laag ligt: elke dag werd overgenomen voor hij definitief was
- [ ] Een trend die te hoog ligt: late data wordt dubbel geteld

Why: elke dag werd overgenomen terwijl zijn data nog binnenkwam, dus elke waarde in de spreadsheet blijft onder haar definitieve cijfer. Neem een dag pas over als de Stability zegt dat hij definitief is.

## Een Resource zegt Betrouwbaar sinds 1 januari 2025. Is haar cijfer van gisteren definitief?

- [ ] Ja: alles sinds 1 januari 2025 is betrouwbaar
- [ ] Nee: alleen data van voor 1 januari 2025 is definitief
- [x] Die datum zegt het niet: ze zegt waar betrouwbare data begint, niet hoelang de laatste dagen nog verschuiven

Why: Betrouwbaar sinds is een begindatum: data van daarvoor vertrouw je niet. Of de laatste dagen definitief zijn, is de Stability van de Resource, en die vertellen haar valkuilen of haar Owner je.

# You can now

vragen "is dit cijfer al definitief?" voor je een recent cijfer in vraag stelt, en het antwoord zoeken in de valkuilen van zijn Resource, of het haar Owner vragen.

## Where to next

- Next to it: K5.2
- Next to it: 4.3.2
- Apply: [Open Collections](/collections) Open een Resource die je gebruikt en lees Let op in haar Samenvatting: zoek naar dagen die nog binnenkomen.
