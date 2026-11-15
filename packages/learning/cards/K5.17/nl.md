---
number: K5.17
status: reviewed
minutes: 4
added: 2026-11-15
changed: 2026-11-15
gain: Je vergelijkt dit jaar nooit met een opstartperiode die nooit volledig was.
translatedFrom: bec90d557afb
---

# Why now

> De vertoningen liggen 150% hoger dan vorig jaar in februari. Welke van onze aanpassingen deed dat?
> — Een collega van marketing, in het maandrapport

Februari vorig jaar is geen maand om mee te vergelijken: de export van Search Console begon halverwege die maand, en de eerste twee weken waren een test. De tabel heeft rijen vanaf die dag, dus niets hield de vergelijking tegen.

Promise: vanaf welke dag een Resource betrouwbaar is, en hoe die dag verschilt van een Known Gap.

# Core idea

**Betrouwbaar sinds** is de dag waarop de hele tabel betrouwbaar wordt; een Known Gap is een gat na die dag, of in een deel van de rijen.

## Bij Immoscoop

Search Console impressions, whole site, heeft rijen vanaf 14 februari 2025, de dag dat de export van Search Console begon. De eerste twee weken waren een test, nog niet volledig, dus zet het SEO-team, zijn Owner, hem op betrouwbaar sinds 1 maart 2025. De dag staat onder Known Behaviour op het Overzicht van de Resource, en zijn Samenvatting zegt: lees eerdere data niet als betrouwbaar. De zoekopdrachten die Google anonimiseert, zijn een ander verhaal: ze hebben geen zoektekst, in ongeveer een kwart van de rijen, elke dag sindsdien. Geen latere dag lost dat op, dus zijn ze een Known Gap van de Resource.

# See it

```chart
{
  "semgraph": "calendarAverage",
  "metric": "searchImpressions",
  "title": "Search Console-vertoningen per dag, per maand (voorbeeldcijfers)",
  "measureType": "additive",
  "unit": "month",
  "locale": "nl-BE",
  "context": { "domain": "Search Console", "dataset": "Voorbeeld", "reliability": "voorbeeldcijfers" },
  "points": [
    { "period": "2025-02", "mean": 19800, "sd": 8600, "n": 15 },
    { "period": "2025-03", "mean": 46200, "sd": 5200, "n": 31 },
    { "period": "2025-04", "mean": 47800, "sd": 5600, "n": 30 },
    { "period": "2025-05", "mean": 49100, "sd": 5900, "n": 31 },
    { "period": "2025-06", "mean": 45300, "sd": 5400, "n": 30 },
    { "period": "2025-07", "mean": 41800, "sd": 4800, "n": 31 },
    { "period": "2025-08", "mean": 40500, "sd": 4600, "n": 31 },
    { "period": "2025-09", "mean": 48900, "sd": 5500, "n": 30 },
    { "period": "2025-10", "mean": 50200, "sd": 5700, "n": 31 },
    { "period": "2025-11", "mean": 49600, "sd": 5600, "n": 30 },
    { "period": "2025-12", "mean": 43100, "sd": 6900, "n": 31 },
    { "period": "2026-01", "mean": 51800, "sd": 5800, "n": 31 },
    { "period": "2026-02", "mean": 50600, "sd": 5300, "n": 28 }
  ]
}
```

Look at: februari 2025, de eerste maand, van voor de dag waarop de Resource betrouwbaar wordt: zijn 15 dagen zijn de test van de export.

You see: die dagen halen gemiddeld zo'n 20.000 vertoningen, tegen 40.000 tot 52.000 per dag in elke maand daarna. Tegenover die test lijkt februari 2026 twee en een half keer zo hoog; tegenover de maanden erna is het een gewone maand.

# Check your understanding

## Een Resource heeft rijen vanaf 3 januari 2024 en zegt Betrouwbaar sinds 1 april 2024. Je wil zijn trend over de langst mogelijke periode. Waar begint die?

- [ ] Op 3 januari 2024: de tabel heeft rijen vanaf die dag
- [ ] Op 3 januari 2024, zonder de dagen die vreemd lijken
- [x] Op 1 april 2024: op wat ervoor kwam, kan je niet rekenen, hoe volledig het ook lijkt

Why: de eerste dag in een tabel is wanneer haar rijen beginnen; betrouwbaar sinds is wanneer je erop kan rekenen. De Owner zette die dag omdat de weken ervoor tekortschieten, of dat nu in een grafiek te zien is of niet.

## Een Resource is betrouwbaar sinds januari 2025. In maart 2026 viel een feed stil, en tien dagen hebben geen rijen. Wat verandert zijn Owner?

- [ ] Betrouwbaar sinds, naar de dag na die tien dagen
- [ ] Niets: een gat dat zo kort is, heeft geen waarschuwing nodig
- [x] Betrouwbaar sinds laten zoals het is, en een Known Gap toevoegen voor die tien dagen

Why: de dag verschuiven gooit meer dan een jaar weg waarop je kan rekenen, voor een gat van tien dagen. Een gat na de dag sinds wanneer een Resource betrouwbaar is, is een Known Gap, afgebakend tot zijn periode, zodat een lezer net om die dagen heen stapt.

## In een Resource met kredietleads hebben de leads die uit MySQL komen in plaats van van de website, nooit een `visitorId`. Waar waarschuwt zijn Owner ervoor?

- [ ] In betrouwbaar sinds: een latere dag, want een deel van de tabel is nooit volledig
- [ ] Nergens: wie de `visitorId` nodig heeft, ziet dat hij leeg is
- [x] In een Known Gap, afgebakend tot die rijen en dat veld

Why: die rijen worden nooit volledig, dus geen dag van betrouwbaar sinds kan ervoor waarschuwen, en een latere dag gooit al de rest weg. Een gat in een deel van de rijen is een Known Gap: afgebakend tot de rijen en het veld, zegt hij precies waar hij geldt.

# You can now

vragen "sinds wanneer is deze Resource betrouwbaar?" voor je met zijn eerste maanden vergelijkt, en een gat na die dag als Known Gap schrijven, niet als een latere dag.

## Where to next

- Next to it: K5.3
- Next to it: K5.4
- Apply: [Open Collections](/collections) Open een Resource die je gebruikt en zoek Betrouwbaar sinds onder Known Behaviour op zijn Overzicht, voor je met zijn eerste maanden vergelijkt.
