---
number: K3.4
status: draft
minutes: 4
added: 2026-10-29
changed: 2026-10-29
gain: Je weet waar je opzoekt wat een begrip betekent, en waar je een definitie vastlegt zodat iedereen hetzelfde telt.
translatedFrom: 4102a501bb4d
---

# Why now

> Het sales-dashboard zegt 1.420 credit leads in september en het credit-dashboard 1.180. Welke definitie is de echte?
> — Een collega van credit

Als twee cijfers met dezelfde naam verschillen, ligt het meestal niet aan de data maar aan de definitie. Wie weet waar definities leven, weet welke telt, en waar te kijken.

Promise: het verschil tussen een uitleg en een definitie, en waar elk leeft.

# Core idea

De **woordenlijst** legt een begrip uit in gewone woorden, en de **officiële definitie** leeft op één plek, het dbt-project en Colleciónes; wie moet tellen, leest de definitie, nooit een kopie ervan.

## Zoals een woordenboek en de wet

Een woordenboek legt in gewone woorden uit wat "inwoner" betekent. De wet zegt precies wie er een is. Van het eerste leer je, op het tweede beslis je.

## Bijvoorbeeld

De woordenlijst zegt dat een `creditLead` "een lead die we naar KBC sturen" is. De definitie in dbt zegt welke tellen: zonder test- en dubbele aanvragen. Het sales-dashboard nam een oudere regel over en telt die ook, dus toont het er 240 meer.

# See it

```chart
{
  "semgraph": "categoryComparison",
  "metric": "creditLeads",
  "title": "Credit leads in september, op twee dashboards (voorbeeldcijfers)",
  "measureType": "additive",
  "statistic": "sum",
  "period": "2026-09",
  "locale": "nl-BE",
  "context": { "domain": "Credit leads", "dataset": "Voorbeeld", "reliability": "voorbeeldcijfers" },
  "points": [
    { "category": "Sales-dashboard, eigen regel", "sum": 1420 },
    { "category": "Credit-dashboard, de definitie in dbt", "sum": 1180 }
  ]
}
```

Look at: de twee staven voor dezelfde maand en dezelfde naam.

You see: een verschil van 240 dat geen fout in de data is: het ene dashboard telt volgens een kopie van een oude regel, het andere volgens de definitie in dbt.

# Check your understanding

## Je wil precies weten welke leads als `creditLead` tellen. Waar kijk je?

- [ ] In de woordenlijst
- [x] In de officiële definitie, in dbt en Colleciónes
- [ ] In het dashboard dat het meeste toont

Why: de woordenlijst legt uit in gewone woorden; enkel de definitie zegt precies wat telt. Een dashboard gebruikt de definitie, het is er niet de bron van.

## Je team begint een nieuw soort lead te tellen. Waar leg je zijn definitie vast?

- [x] Op één plek: de definitie in dbt, met haar uitleg erbij in de woordenlijst
- [ ] In de beschrijving van elk dashboard dat ze gebruikt
- [ ] In een document van je team

Why: een definitie op één plek is voor iedereen dezelfde. Elke kopie drijft ervan weg, en dan zijn twee dashboards het oneens.

## Open een Resource en vergelijk zijn beschrijving uit dbt met zijn Business Description. Wat is het verschil?

Try it: [Open Collections](/collections)

- [x] Die uit dbt zegt hoe hij gebouwd is; de Business Description wat hij betekent voor het bedrijf
- [ ] Het is altijd dezelfde tekst
- [ ] De Business Description vervangt die uit dbt

Why: beide staan bewust naast elkaar: de beschrijving uit dbt volgt de definitie, de Business Description legt ze uit in de woorden van zijn Owner.

# You can now

opzoeken wat een begrip betekent in de woordenlijst, en zijn definitie vinden en vastleggen op de ene plek waar ze leeft.

## Where to next

- Deeper: 4.3.2
- Next to it: K5.1
- Apply: [Open Collections](/collections) Lees de beschrijving uit dbt en de Business Description van een Resource naast elkaar.
