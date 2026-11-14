---
number: 2.3.5
status: reviewed
minutes: 6
added: 2026-10-29
changed: 2026-11-14
gain: Je legt uit waarom twee tellingen van "hetzelfde" verschillen, voor iemand een van beide fout noemt.
translatedFrom: 2a7a30611c5a
---

# Why now

> Marketing telt 1.310 panden in de regio en wij 1.240. Wie heeft zich vergist?
> — Een collega van sales, over een maandrapport

Twee teams tellen hetzelfde en komen op twee cijfers. Meestal vergiste niemand zich: ze telden langs een andere sleutel, en beantwoordden dus een andere vraag.

Promise: wat je vraagt voor je telt, zodat twee cijfers vergelijkbaar worden.

# Core idea

Elke telling staat op een **grain**, wat één rij is, en een **sleutel** waarlangs je telt; als een rij niet bij precies één waarde van de sleutel hoort, telt ze meer dan eens of valt ze weg, en beantwoordt het cijfer een andere vraag.

## Zoals een pakje en zijn adressen

Een pakje gaat naar één huis, maar een straat kan door twee gemeenten lopen. Tel je de pakjes van elke gemeente via haar straten, dan tellen de gemeenten op tot meer dan er pakjes zijn: de straat door beide gemeenten brengt al haar pakjes in beide.

## Bijvoorbeeld

Een pand ligt in één gemeente, maar een postcode kan over meerdere gemeenten lopen. Geteld langs de gemeente van elk pand telt de regio 1.240 panden; gevonden via de postcodes van elke gemeente 1.310. De 70 meer zijn panden in postcodes die over een grens lopen: zo'n postcode hoort bij elke gemeente waarover ze loopt, dus haar panden worden één keer per gemeente geteld.

# See it

```chart
{
  "semgraph": "categoryComparison",
  "metric": "listings",
  "title": "Panden in één regio, geteld langs twee sleutels (voorbeeldcijfers)",
  "measureType": "additive",
  "statistic": "sum",
  "period": "2026-09",
  "locale": "nl-BE",
  "context": { "domain": "Listings", "dataset": "Voorbeeld", "reliability": "voorbeeldcijfers" },
  "points": [
    { "category": "Opgeteld per gemeente", "sum": 1240 },
    { "category": "Opgeteld per postcode", "sum": 1310 }
  ]
}
```

Look at: de twee staven van dezelfde panden in dezelfde maand, opgeteld per gemeente en per postcode.

You see: 70 meer via de postcodes. Geen van beide is fout, maar ze beantwoorden een andere vraag: een postcode die over twee gemeenten loopt, brengt haar panden twee keer in het totaal.

# Check your understanding

## Een persoon kan inloggen, een e-mailadres achterlaten of enkel een cookie dragen. "Unieke personen" geteld op cookies geeft 48.000, op logins 21.000. Welke klopt?

- [ ] Die op logins, want die is het preciest
- [ ] Die op cookies, want die is het grootst
- [x] Beide, voor een andere vraag: ze tellen langs een andere sleutel

Why: een sleutel is een keuze. Cookies tellen browsers, logins tellen accounts. Welke past, hangt af van de vraag, en het rapport zegt best welke het nam.

## Voor je twee tellingen vergelijkt, wat vraag je eerst?

- [x] Wat één rij is, en langs welke sleutel elk geteld werd
- [ ] Welke van de twee het recentst is
- [ ] Welk team ze maakte

Why: twee tellingen met een andere grain of sleutel beantwoorden andere vragen. Pas als beide gelijk zijn, kan een verschil iets betekenen.

## Open een Resource in een Collection en bekijk zijn grain op zijn Overzicht. Waar staat één rij voor?

Try it: [Open Collections](/collections)

- [x] De Resource zegt het in één zin, zoals "één rij per pand per dag"
- [ ] Dat zie je enkel aan zijn SQL
- [ ] Elke Resource heeft één rij per dag

Why: de grain van een Resource staat op zijn pagina, in een zin en met de velden die elke rij identificeren, zodat je weet wat je telt voor je telt.

# You can now

benoemen wat één rij is en langs welke sleutel je telt, voor je telt, en uitleggen waarom twee sleutels twee cijfers geven.

## Where to next

- Deeper: 2.3.6
- Next to it: 1.2.2
- Apply: [Open Collections](/collections) Open een Resource en lees zijn grain voor je ermee telt.
