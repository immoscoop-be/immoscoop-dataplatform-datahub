---
number: K5.1
status: draft
minutes: 5
added: 2026-10-29
changed: 2026-10-29
gain: Je weet wat een Resource je vertelt, hoe ver je hem kan vertrouwen, en wie je erover vraagt.
translatedFrom: e3e5d40f966c
---

# Why now

> Weekly lead volume zegt 840 leads van de website vorige week. Mag ik dat aan de directie tonen, en wie vraag ik het als het vreemd lijkt?
> — Een collega van marketing

Data Hub bevat Resources. Wie weet wat dat is, weet waar de cijfers vandaan komen, hoe ver je ze kan vertrouwen, en wie ervoor instaat.

Promise: wat een Resource is, wat zijn pagina bevat, en wie ervoor instaat.

# Core idea

Een **Resource** is één tabel uit BigQuery met haar pagina: wat ze bevat, hoe ver je haar kan vertrouwen en wie ervoor instaat; de data zelf blijft in BigQuery.

## Zoals een boek in een bibliotheek

De bibliotheek schrijft het boek niet, maar haar fiche zegt waar het boek over gaat, waar het staat, en wie je erover vraagt. Het boek zelf blijft in het rek.

## Bijvoorbeeld

Weekly lead volume zit in de Collection Credit leads, met het credit-team als Owner Unit: het aantal credit leads per week en per leadbron, op Level 4 · Explored. Een vraag erover gaat als bericht op zijn pagina naar het credit-team.

# See it

```chart
{
  "semgraph": "categoryComparison",
  "metric": "creditLeads",
  "title": "Credit leads per leadbron, één week (voorbeeldcijfers)",
  "measureType": "additive",
  "statistic": "sum",
  "period": "2026-W42",
  "locale": "nl-BE",
  "context": { "domain": "Credit leads", "dataset": "Weekly lead volume", "reliability": "voorbeeldcijfers" },
  "points": [
    { "category": "Website", "sum": 840 },
    { "category": "Partner", "sum": 310 },
    { "category": "Mailing", "sum": 120 },
    { "category": "Telefoon", "sum": 95 }
  ]
}
```

Look at: de voet van de grafiek, die de Resource noemt die ze leest.

You see: de cijfers komen uit Weekly lead volume. Zijn pagina zegt wat één rij is, wie ervoor instaat en op welk Level hij staat: daar kijk je na voor je het cijfer toont.

# Check your understanding

## Wie is de Owner van een Resource?

- [ ] Wie zijn tabel in dbt bouwde
- [x] De Owner Unit van zijn Collection
- [ ] Het Data Team

Why: de Owner is het team dat de data begrijpt en ervoor instaat: de Owner Unit van de Collection waarin de Resource zit. Het Data Team bouwt en registreert hem.

## Wie ziet een Resource die niet gepubliceerd is?

- [x] Enkel het Data Team en zijn Owner Unit
- [ ] Iedereen die zijn Collection ziet
- [ ] Het hele bedrijf

Why: enkel zijn Owner publiceert een Resource; tot dan zien enkel het Data Team en de Owner Unit hem. Gepubliceerd ziet iedereen die zijn Collection ziet hem.

## Een veld van een Resource veranderde sinds zijn laatste bevestiging. Wat gebeurt er met zijn Level?

- [ ] Het zakt één stap
- [x] Het blijft, en de Resource toont een waarschuwing tot zijn Owner de wijziging als gezien markeert
- [ ] Het gaat terug naar 0 · Beta

Why: een gewijzigd veld laat het Level niet zakken; het waarschuwt wie hem leest, tot zijn Owner of het Data Team naar de wijziging keek.

## Open een Resource en zoek wie je erover vraagt. Waar stuur je je vraag naartoe?

Try it: [Open Collections](/collections)

- [x] Als bericht op zijn pagina, dat naar zijn Owner gaat
- [ ] Per e-mail naar het Data Team
- [ ] In de beschrijving van de Resource

Why: een vraag over een Resource is een bericht op zijn pagina: het bereikt zijn Owner, en iedereen die de Resource ziet, kan het antwoord later lezen.

# You can now

uitleggen wat een Resource in Data Hub is, wat zijn pagina bevat, en wie je vraagt als je aan een cijfer twijfelt.

## Where to next

- Deeper: 4.3.2
- Next to it: K3.4
- Apply: [Open Collections](/collections) Open een Resource en zoek zijn Owner, zijn Level en zijn grain.
