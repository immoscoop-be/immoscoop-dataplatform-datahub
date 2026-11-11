---
number: 2.1.3
status: draft
minutes: 5
added: 2026-11-10
changed: 2026-11-10
gain: Toont iemand je een stijgend vroeg cijfer, dan stel je de twee vragen die bepalen wat het waard is.
translatedFrom: 024f7391b33c
---

# Why now

> De sessies liggen 40% hoger sinds de campagne loopt. Waar blijven de extra leads dan?
> — Een collega van marketing, drie weken in een campagne

De campagne had één doel, meer sessies, en haalde het. De leads die dat doel moest opleveren, kwamen niet.

Promise: waarom duwen aan een vroeg cijfer het late niet meetrekt.

# Core idea

Een **voorlopende indicator** beweegt eerst en een achterlopende volgt, verbonden door een factor en een vertraging: achterlopend = voorlopend × factor, na de doorlooptijd.

## Zoals een winkel

Mensen die binnenkomen zijn het vroege cijfer, mensen aan de kassa het late. Slechts een deel van de bezoekers koopt, en in een immokantoor kopen ze weken na hun bezoek. Deel aan de deur gratis koffie uit en de teller aan de deur stijgt; de verkoop niet.

## Bij Immoscoop

Sessies zijn voorlopend, leads achterlopend. In een gewone week levert ongeveer 4 op 100 sessies een lead op, enkele weken later. Een campagne die 40% meer sessies koopt van mensen die geen woning zoeken, doet de sessies stijgen, niet de leads: de factor van die extra sessies ligt dicht bij nul.

# See it

```chart
{
  "semgraph": "calendarRatio",
  "metric": "sessionToLead",
  "title": "Leads per sessie, per week (voorbeeldcijfers)",
  "measureType": "ratio",
  "numeratorName": "leads",
  "denominatorName": "sessies",
  "unit": "week",
  "locale": "nl-BE",
  "context": { "domain": "Leads", "dataset": "Voorbeeld", "reliability": "voorbeeldcijfers" },
  "points": [
    { "period": "2026-W33", "numerator": 800, "denominator": 20000 },
    { "period": "2026-W34", "numerator": 816, "denominator": 20400 },
    { "period": "2026-W35", "numerator": 792, "denominator": 19800 },
    { "period": "2026-W36", "numerator": 808, "denominator": 20200 },
    { "period": "2026-W37", "numerator": 812, "denominator": 28000 },
    { "period": "2026-W38", "numerator": 820, "denominator": 28400 },
    { "period": "2026-W39", "numerator": 806, "denominator": 27800 },
    { "period": "2026-W40", "numerator": 814, "denominator": 28200 }
  ]
}
```

Look at: de laatste vier weken, toen de campagne liep: de basis van sessies onder de lijn, en de lijn zelf.

You see: de basis groeit met 40%, terwijl het aandeel sessies dat een lead oplevert zakt van 4,0% naar 2,9%. De leads blijven rond 800 per week: de extra sessies brachten er bijna geen op.

# Check your understanding

## Het aantal inschrijvingen op de nieuwsbrief verdubbelde deze maand. Wat vraag je voor je meer leads verwacht?

- [ ] Niets: dubbel zoveel inschrijvingen is dubbel zoveel leads
- [x] Hoeveel inschrijvingen een lead worden, en hoelang dat duurt
- [ ] Of de inschrijvingen dubbel geteld zijn

Why: een inschrijving is een vroeg cijfer. Wat ze later waard is, hangt af van het deel dat een lead wordt en van de tijd die dat duurt, en geen van beide zit in het aantal inschrijvingen.

## Een team krijgt als doel 20% meer weergaven van panden dit kwartaal. Wat gebeurt er het waarschijnlijkst?

- [ ] De leads stijgen ook met ongeveer 20%
- [x] De weergaven stijgen, langs wat weergaven het snelst doet stijgen, en de leads hoeven niet te volgen
- [ ] Weergaven en leads blijven gelijk

Why: een doel op een vroeg cijfer maakt van dat cijfer het doel. De goedkoopste manieren om weergaven te doen stijgen, brengen niet per se de mensen die een lead sturen.

## De leads zakten deze week, twee weken nadat de sessies zakten. Wat toont dat het waarschijnlijkst?

- [x] De vertraging tussen beide: het achterlopende cijfer volgt het voorlopende
- [ ] De meting van leads ging deze week stuk
- [ ] Sessies en leads hebben niets met elkaar te maken

Why: een achterlopend cijfer volgt het voorlopende na zijn doorlooptijd, dus een daling in sessies toont zich later in de leads. Kijk naar de vertraging voor je een kapotte meting zoekt.

# You can now

vragen "wat is de factor, en hoelang duurt het?" voor je een vroeg cijfer vertrouwt, of er een doel op zet.

## Where to next

- Next to it: 1.2.1
- Apply: [Open Query](/query/new) Zet sessies per week en leads per week naast elkaar, en zoek hoeveel weken het tweede het eerste volgt.
