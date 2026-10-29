---
number: 4.3.2
status: draft
minutes: 5
added: 2026-10-29
changed: 2026-10-29
gain: Je wijzigt een Resource zonder de rapporten te breken van mensen die je nooit ontmoette.
translatedFrom: 539b32685dad
---

# Why now

> Ik heb maar één kolom hernoemd. Waarom staat het KBC-rapport vanmorgen leeg?
> — Een Owner van een Resource, op een dinsdag

Een wijziging die aan jouw kant klein lijkt, kan breken wat anderen op je data bouwden. Een kolom toevoegen breekt niets; een kolom hernoemen of weghalen breekt elke query die hem leest.

Promise: hoe je een brekende wijziging herkent, en wat je afspreekt met wie je data gebruikt.

# Core idea

Een **brekende wijziging**, een veld hernoemd, weggehaald of met een andere betekenis, krijgt een nieuwe versie en wordt aangekondigd aan wie de data gebruikt; een veld toevoegen breekt nooit.

## Zoals een dienstregeling

Een trein erbij breekt niemands reis. De trein van 8.12 naar 8.20 verplaatsen breekt de plannen van iedereen die hem neemt, dus kondigt het spoor het aan voor de nieuwe dienstregeling ingaat.

## Bijvoorbeeld

De Owner hernoemt `lead_source` naar `lead_channel`. Elke query, Lens en elk rapport dat `lead_source` leest, werkt niet meer. `lead_channel` ernaast toevoegen, en `lead_source` pas weghalen als de gebruikers overstapten, breekt niets.

# See it

```chart
{
  "semgraph": "categoryComparison",
  "metric": "creditLeads",
  "title": "Credit leads per week in een rapport op de Resource (voorbeeldcijfers)",
  "measureType": "additive",
  "statistic": "sum",
  "ordered": true,
  "window": 35,
  "locale": "nl-BE",
  "context": { "domain": "Credit leads", "dataset": "Voorbeeld", "reliability": "voorbeeldcijfers" },
  "points": [
    { "category": "W38", "sum": 1210 },
    { "category": "W39", "sum": 1185 },
    { "category": "W40", "sum": 1240 },
    { "category": "W41", "sum": null },
    { "category": "W42", "sum": null }
  ]
}
```

Look at: de laatste twee weken, die leeg zijn, niet nul.

You see: het rapport vond zijn veld niet meer toen het in week 41 hernoemd werd. De leads waren er; de afspraak over wat de Resource bevat, was gebroken.

# Check your understanding

## Welke wijziging aan een gepubliceerde Resource is brekend?

- [ ] Een veld `lead_channel` toevoegen
- [x] `lead_source` hernoemen naar `lead_channel`
- [ ] Een betere Business Description schrijven

Why: een hernoeming haalt de oude naam weg, en alles wat die leest, werkt niet meer. Een veld toevoegen of het beter beschrijven verandert niets voor wat erop gebouwd is.

## Een veld houdt zijn naam, maar telt voortaan ook testleads. Is dat brekend?

- [x] Ja: zijn betekenis veranderde, dus elk cijfer dat erop bouwt, verandert zonder waarschuwing
- [ ] Nee: de naam en het type bleven gelijk
- [ ] Enkel als er een rapport breekt

Why: een wijziging van betekenis is brekend, ook als niets leeg valt. Dat is de gevaarlijkste soort, want de cijfers blijven komen en kloppen niet.

## Data Hub meldt dat een veld van je Resource veranderde sinds zijn laatste bevestiging. Wat betekent dat?

- [ ] Zijn Level is gezakt
- [x] Hij toont een waarschuwing tot jij, of het Data Team, die als gezien markeert
- [ ] Hij is ingetrokken

Why: een gewijzigd veld laat het Level zoals het is, maar de Resource waarschuwt wie hem leest, tot zijn Owner naar de wijziging keek en bevestigde wat hij nu bevat.

# You can now

een brekende wijziging herkennen voor je ze maakt, en ze een nieuwe versie en een aankondiging geven in plaats van een verrassing.

## Where to next

- Next to it: K3.4
- Next to it: K5.1
- Apply: [Open je berichten](/messages) Bekijk wat Data Hub je vertelde over de wijzigingen aan je Resources.
