---
number: 1.2.1
status: draft
minutes: 4
added: 2026-10-29
changed: 2026-10-29
gain: Je noemt een cijfer voor wat het echt telt, zodat niemand paginaweergaven als mensen leest.
translatedFrom: cacaa22afc50
---

# Why now

> Het dashboard zegt 180.000 bezoeken vorige week. Dat zijn veel mensen, toch?
> — Een collega van marketing

"Bezoeken" kan bezoekers, sessies of paginaweergaven betekenen, en de drie verschillen een veelvoud. Voor je een cijfer vergelijkt of doorgeeft, moet je weten welk het is.

Promise: hoe je ziet wat een cijfer telt, en wat je vraagt als het label het niet zegt.

# Core idea

Een cijfer telt één ding: **bezoekers**, **sessies** en **paginaweergaven** zijn drie verschillende tellingen van dezelfde week, want één bezoeker kan meerdere sessies hebben en één sessie veel paginaweergaven.

## Zoals een museum

De mensen die binnenkwamen, de keren dat de deur openging en de schilderijen die bekeken werden: drie tellingen van één dag in een museum, en geen ervan is de andere.

## Bijvoorbeeld

Eén week telt 25.000 bezoekers, 61.000 sessies en 180.000 paginaweergaven. Een grafiek met het label "bezoeken" die 180.000 toont, telt paginaweergaven, geen mensen.

# See it

```chart
{
  "semgraph": "categoryComparison",
  "metric": "visits",
  "title": "Drie tellingen van dezelfde week (voorbeeldcijfers)",
  "measureType": "additive",
  "statistic": "sum",
  "period": "2026-W40",
  "locale": "nl-BE",
  "context": { "domain": "Website", "dataset": "Voorbeeld", "reliability": "voorbeeldcijfers" },
  "points": [
    { "category": "Bezoekers", "sum": 25000 },
    { "category": "Sessies", "sum": 61000 },
    { "category": "Paginaweergaven", "sum": 180000 }
  ]
}
```

Look at: de drie staven van dezelfde week.

You see: één week telt 25.000, 61.000 of 180.000, naargelang wat er geteld wordt. Een label dat enkel "bezoeken" zegt, vertelt je niet welke van de drie je hebt.

# Check your understanding

## Een tegel zegt "Bezoeken: 61.000". Wat doe je voor je het doorgeeft?

- [ ] Het lezen als 61.000 mensen
- [x] Vragen of het bezoekers, sessies of paginaweergaven telt
- [ ] Het door zeven delen om een dag te krijgen

Why: "bezoeken" is geen telling op zich; het antwoord beslist of je over mensen, bezoeken of pagina's spreekt.

## Eén bezoeker komt drie keer in een week en bekijkt telkens vier pagina's. Wat telt de week?

- [x] 1 bezoeker, 3 sessies en 12 paginaweergaven
- [ ] 3 bezoekers, 3 sessies en 12 paginaweergaven
- [ ] 1 bezoeker, 1 sessie en 12 paginaweergaven

Why: een bezoeker telt één keer in de week, elk bezoek is een sessie, en elke bekeken pagina is een paginaweergave.

# You can now

zien wat een cijfer telt, en de afgesproken term vragen als het label het niet zegt.

## Where to next

- Deeper: 1.2.2
- Next to it: 2.3.5
- Apply: [Open Collections](/collections) Lees de beschrijving van een veld voor je ermee telt.
