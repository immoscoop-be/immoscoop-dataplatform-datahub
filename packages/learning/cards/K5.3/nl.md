---
number: K5.3
status: draft
minutes: 5
added: 2026-11-12
changed: 2026-11-12
gain: Je weet waar data ontbreekt in een Resource voor je er een conclusie uit trekt, en je behoedt je collega's voor dezelfde fout.
translatedFrom: 454cc89e71e9
---

# Why now

> Waarom is de leadbron leeg voor al die leads? Wat is daar gebeurd?
> — Een collega die met leads werkt, niet de eerste die het vraagt

Het antwoord is altijd hetzelfde: een tijdlang werd de leadbron niet geregistreerd bij de leads. Niemand schreef het op, dus de vraag komt telkens terug. En de collega die het gat niet opmerkt, vraagt helemaal niets: die trekt een conclusie, en die klopt niet.

Promise: waarom een gat in de data alleen misleidt als niemand het opschreef, en waar je het opschrijft.

# Core idea

Een gat in de data is niet het probleem, een gat dat niemand opschreef wel: schrijf het op als **Known Gap** van zijn Resource, zodat de collega's na jou er niet dezelfde fout mee maken.

## Zoals een put met een bord

Er zit een put in de weg. Zet er een bord naast, en elke fietser die voorbijkomt, rijdt eromheen. Waarschuw gewoon de mensen.

## Bij Immoscoop

De leads van die periode zijn er allemaal, maar niemand kan zeggen waar ze vandaan kwamen: wat niet geregistreerd is, kan je niet terugspoelen. De Owner of het Data Team schrijft het één keer op, als Known Gap van de Resource die de leads bevat, afgebakend tot die periode en het veld leadbron. Vanaf dan staat het op het Overzicht van die Resource, met wie het toevoegde en wanneer: de collega die zich afvraagt wat er gebeurde, leest het daar in plaats van het opnieuw te vragen, en de collega die leads per leadbron telt, ziet het voor hij een conclusie trekt.

# See it

```chart
{
  "semgraph": "calendarRatio",
  "metric": "leadsWithLeadSource",
  "title": "Leads met een leadbron, per maand (voorbeeldcijfers)",
  "measureType": "ratio",
  "numeratorName": "leads met een leadbron",
  "denominatorName": "leads",
  "unit": "month",
  "locale": "nl-BE",
  "context": { "domain": "Leads", "dataset": "Voorbeeld", "reliability": "voorbeeldcijfers" },
  "points": [
    { "period": "2025-10", "numerator": 5384, "denominator": 5400 },
    { "period": "2025-11", "numerator": 5186, "denominator": 5200 },
    { "period": "2025-12", "numerator": 4688, "denominator": 4700 },
    { "period": "2026-01", "numerator": 5583, "denominator": 5600 },
    { "period": "2026-02", "numerator": 5485, "denominator": 5500 },
    { "period": "2026-03", "numerator": 2800, "denominator": 5800 },
    { "period": "2026-04", "numerator": 2690, "denominator": 5400 },
    { "period": "2026-05", "numerator": 5682, "denominator": 5700 },
    { "period": "2026-06", "numerator": 5285, "denominator": 5300 },
    { "period": "2026-07", "numerator": 4887, "denominator": 4900 },
    { "period": "2026-08", "numerator": 4788, "denominator": 4800 },
    { "period": "2026-09", "numerator": 5584, "denominator": 5600 }
  ]
}
```

Look at: maart en april 2026, waar de lijn naar ongeveer de helft zakt, terwijl de basis van leads eronder even hoog blijft als in elke andere maand.

You see: het gat liep van half maart tot half april, de helft van elke maand. De leads bleven binnenkomen zoals in elke andere maand, zo'n 5.300 per maand, maar slechts de helft van die van maart en april heeft een leadbron. Per leadbron geteld zakt elke bron in die twee maanden met ongeveer de helft, en zonder de Known Gap lees je dat als minder leads, niet als een gat in de data.

# Check your understanding

## Je ontdekt dat een veld van een Resource die je gebruikt, leeg is voor elke rij van voor vorige zomer. Wat doe je?

- [ ] Niets meer: nu je het weet, onthoud je het
- [ ] Het in een chat aan het Data Team vragen, en het bij hun antwoord laten
- [x] Het zoeken bij zijn Known Gaps; staat het er niet bij, het toevoegen als je team de Resource bezit, of zijn Owner verwittigen met een bericht op de Resource

Why: wat je onthoudt, of in een chat hoort, helpt niemand na jou. Een Known Gap waarschuwt iedereen die de Resource opent, en een bericht op de Resource bereikt zijn Owner en blijft leesbaar voor anderen.

## Weergaven van panden in de app halveerden gedurende twee weken in augustus. Wat kijk je na voor je verklaart waarom?

- [ ] Niets: de cijfers komen uit Data Hub, dus de daling gebeurde echt
- [x] De Known Gaps van de Resource: of er een die weken dekt
- [ ] Welke release van de app de daling veroorzaakte

Why: een daling zit in de wereld of in de data. Een Known Gap die die weken dekt, zegt dat de data daar een gat heeft; kijk dat eerst na, en zoek dan pas een oorzaak in de wereld.

## Een Known Gap zegt dat een veld vorig jaar drie maanden lang niet bewaard werd. Wat betekent dat voor je analyse?

- [ ] De Resource is onbetrouwbaar, dus je zoekt een andere
- [x] Je gebruikt hem, en voor die drie maanden laat je dat veld weg, of zeg je dat het ontbreekt
- [ ] Niets: het gat ligt in het verleden, dus je telt alsof het er niet is

Why: een gat dat je kent, is een gat waar je omheen rijdt. Erdoorheen tellen alsof het er niet is, leidt tot de verkeerde conclusie; de hele Resource laten vallen, gooit alles buiten het gat weg.

## Open een Resource en zoek zijn Known Gaps. Wat vertelt een Known Gap je naast zijn tekst?

Try it: [Open Collections](/collections)

- [ ] Wanneer het Data Team hem oplost
- [x] Wie hem toevoegde en wanneer, en, als hij afgebakend is, de periode, velden of rijen waarvoor hij geldt
- [ ] Hoeveel collega's erin trapten

Why: elke Known Gap is een item op zich, met wie hem toevoegde en wanneer, zodat je weet wie je het kan vragen. Afgebakend tot een periode, velden of rijen, zegt hij waar hij geldt, en Claude leest dat ook.

# You can now

vragen "welke Known Gaps heeft deze Resource?" voor je er een conclusie uit trekt, en je collega's waarschuwen voor elk gat dat je vindt, als Known Gap van zijn Resource.

## Where to next

- Deeper: 4.7.1
- Next to it: K5.1
- Apply: [Open Collections](/collections) Open een Resource die je gebruikt, en lees zijn Known Gaps op zijn Overzicht voor je een resultaat vertrouwt.
