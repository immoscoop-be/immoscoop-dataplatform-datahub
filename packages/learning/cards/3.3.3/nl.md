---
number: 3.3.3
status: draft
minutes: 4
added: 2026-10-29
changed: 2026-10-29
gain: Je beoordeelt of data goed genoeg is voor je beslissing, zonder op perfecte data te wachten.
translatedFrom: 73a99246874e
---

# Why now

> Onze bezoekerscijfers missen iedereen die cookies weigert. Dan kunnen we ze toch helemaal niet gebruiken?
> — Een collega van product

Geen data is perfect, dus "is het goed?" heeft geen antwoord. "Goed genoeg waarvoor?" heeft er wel een, en het beslist of je de cijfers gebruikt of andere zoekt.

Promise: hoe je data beoordeelt tegenover wat je ermee wil doen.

# Core idea

Data is **betrouwbaar** als ze de verwachting waarmaakt die haar label zet, voor het gebruik dat je voor ogen hebt: dezelfde cijfers kunnen goed genoeg zijn voor een trend en niet voor een factuur.

## Zoals een keukenweegschaal

Een keukenweegschaal is betrouwbaar voor een recept en nutteloos om goud te wegen. De weegschaal veranderde niet; wat je ervan wil, wel.

## Bijvoorbeeld

De bezoekerscijfers missen wie cookies weigert, elke week ongeveer hetzelfde deel. Voor de trend van het laatste kwartaal is dat goed genoeg; om een kantoor per bezoeker te factureren niet.

# See it

```chart
{
  "semgraph": "categoryComparison",
  "metric": "visitors",
  "title": "Gemeten bezoekers per week (voorbeeldcijfers)",
  "measureType": "additive",
  "statistic": "sum",
  "ordered": true,
  "window": 35,
  "locale": "nl-BE",
  "context": { "domain": "Website", "dataset": "Voorbeeld", "reliability": "voorbeeldcijfers" },
  "points": [
    { "category": "W38", "sum": 41200 },
    { "category": "W39", "sum": 41900 },
    { "category": "W40", "sum": 44800 },
    { "category": "W41", "sum": 45600 },
    { "category": "W42", "sum": 46100 }
  ]
}
```

Look at: de stijging vanaf week 40.

You see: elke week is met ongeveer hetzelfde deel te laag, dus de stijging is echt. Deze cijfers dragen de trend; een factuur per bezoeker zouden ze niet dragen.

# Check your understanding

## De leads per week zijn bevestigd door hun Owner, maar de laatste week is nog onvolledig. Waarvoor zijn ze vandaag goed genoeg?

- [x] De weken voor de laatste vergelijken
- [ ] Het totaal van vorige week aan KBC rapporteren
- [ ] Niets, tot elke week volledig is

Why: de Resource zegt wat je mag verwachten: definitieve weken mag je vergelijken, de lopende week zet zich nog. Dezelfde tabel is betrouwbaar voor het ene gebruik en nog niet voor het andere.

## Een tabel mist ongeveer 1% van haar rijen, altijd van dezelfde soort. Wanneer doet dat ertoe?

- [ ] Altijd: een tabel met gaten is niet betrouwbaar
- [x] Als je vraag over precies de rijen gaat die ontbreken
- [ ] Nooit: 1% is te weinig om ertoe te doen

Why: een gekend, stabiel gat is onschuldig voor de meeste toepassingen en doorslaggevend voor die ene die net die rijen nodig heeft. Betrouwbaarheid beoordeel je tegenover de vraag, niet op zich.

# You can now

beoordelen of data goed genoeg is voor wat je ermee wil doen, in plaats van te vragen of ze goed is.

## Where to next

- Next to it: K5.2
- Next to it: 1.2.1
- Apply: [Open Collections](/collections) Lees het gekende gedrag van een Resource voor je haar voor een beslissing gebruikt.
