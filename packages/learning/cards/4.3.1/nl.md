---
number: 4.3.1
status: draft
minutes: 5
added: 2026-10-29
changed: 2026-10-29
gain: Je wijzigt een definitie zonder het vertrouwen te verliezen van wie erop steunt.
translatedFrom: 6688487d51f4
---

# Why now

> De credit leads zakten van de ene dag op de andere met 15%. Is er iets kapot?
> — Een collega van het credit-team

Er is niets kapot: vanaf maandag telt een lead pas als hij bevestigd is. Het cijfer is beter dan voorheen, maar wie het niet wist, leest een daling die nooit gebeurde.

Promise: hoe je een definitie wijzigt zodat iedereen de cijfers daarna nog vertrouwt.

# Core idea

Een **definitie** mag wijzigen als je meer leert; vertrouwen breekt pas als de wijziging stil gebeurt, dus wijzig je ze op één plek, kondig je de dag aan waarop ze ingaat, en markeer je de breuk in de reeks.

## Zoals een nieuwe regel in een sport

Toen het voetbal de buitenspelregel wijzigde, twijfelde niemand aan de uitslagen: de wijziging was voor het seizoen aangekondigd, en de archieven vermelden het jaar waarin ze inging.

## Bijvoorbeeld

Vanaf 1 oktober telt een credit lead pas nadat de bezoeker hem bevestigde. De Owner wijzigt het in dbt, schrijft het in de beschrijving van het veld, verwittigt wie de Resource gebruikt, en de grafiek van het jaar toont een lijn op 1 oktober: "nieuwe definitie".

# See it

```chart
{
  "semgraph": "categoryComparison",
  "metric": "creditLeads",
  "title": "Credit leads per week, voor en na een nieuwe definitie (voorbeeldcijfers)",
  "measureType": "additive",
  "statistic": "sum",
  "ordered": true,
  "window": 35,
  "locale": "nl-BE",
  "context": { "domain": "Credit leads", "dataset": "Voorbeeld", "reliability": "voorbeeldcijfers" },
  "points": [
    { "category": "W38", "sum": 1240 },
    { "category": "W39", "sum": 1210 },
    { "category": "W40", "sum": 1050 },
    { "category": "W41", "sum": 1035 },
    { "category": "W42", "sum": 1060 }
  ]
}
```

Look at: de trap tussen week 39 en week 40.

You see: ongeveer 160 leads per week minder vanaf de week waarin de nieuwe definitie inging. De leads daalden niet; wat als lead telt, veranderde. Zonder aankondiging en zonder markering in de grafiek leest het als een daling.

# Check your understanding

## Je merkt dat de telling van actieve kantoren ook kantoren zonder enig pand meetelt. Hoe wijzig je het?

- [ ] Het rechtzetten in het dashboard dat het toont
- [x] De definitie wijzigen in dbt, de dag aankondigen waarop ze ingaat, en de breuk markeren
- [ ] Wachten tot niemand het cijfer nog gebruikt

Why: een definitie leeft op één plek. Ze daar wijzigen en wie erop steunt verwittigen, houdt hun vertrouwen; een stille correctie in één dashboard maakt twee waarheden.

## Na een wijziging van definitie toont de grafiek van het jaar één vloeiende lijn. Wat ontbreekt er?

- [x] Waar de oude definitie stopt en de nieuwe begint
- [ ] Een stippellijn voor het hele jaar
- [ ] Niets: de lijn toont elke week

Why: voor en na een wijziging is geen doorlopende trend. De breuk moet zichtbaar zijn, zodat niemand de trap leest als een verandering in de business.

# You can now

een definitie zichtbaar wijzigen: op één plek, aangekondigd en gemarkeerd in de reeks, zodat de cijfers hun vertrouwen houden.

## Where to next

- Deeper: 4.3.2
- Next to it: K3.4
- Apply: [Open Collections](/collections) Lees de beschrijvingen van een Resource die je beheert, en kijk of ze zeggen wat vandaag telt.
