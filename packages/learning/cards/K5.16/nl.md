---
number: K5.16
status: reviewed
minutes: 4
added: 2026-11-15
changed: 2026-11-15
gain: Je vermijdt de fouten die anderen al met een tabel maakten, en je behoedt je collega's voor de valstrikken die je zelf vond.
translatedFrom: 88361cb8d3c6
---

# Why now

> Mijn gemiddelde positie voor oktober is 14, maar het SEO-team rapporteert 6. Zit er een fout in de data?
> — Een collega van marketing, bij het maken van het maandrapport

Die is er niet: beide cijfers komen uit dezelfde rijen, en beide zien eruit als een positie. Slechts één ervan is de positie van de site, en het SEO-team wist welke; ze hadden het telkens aan één collega uitgelegd.

Promise: wat een valkuil van een Resource is, en waarom die op zijn kaart hoort.

# Core idea

Een **valkuil** is een manier om een tabel verkeerd te lezen die er juist uitziet: staat hij op haar kaart, dan stapt de volgende collega eromheen.

## Bij Immoscoop

Search Console impressions, whole site, in de Collection Attraction, houdt bij hoe vaak de site in Google verschijnt en op welke positie, in één rij per dag, zoekopdracht, land, toestel en zoektype. Elke rij klopt, en toch is het gemiddelde van hun posities niet de positie van de site: het geeft een rij met tien vertoningen evenveel gewicht als een met tienduizend, terwijl Google elke rij weegt naar haar vertoningen. Dus schrijft het SEO-team, zijn Owner, het bij zijn valkuilen: "Neem geen gemiddelde van de positie: weeg elke rij naar haar vertoningen." Vanaf dan staat het onder Known Behaviour op het Overzicht van de Resource, en Claude leest het ook. Er ontbreekt niets, dus het is geen Known Gap: de data klopt, het lezen loopt fout.

# Check your understanding

## Een Resource bevat leads per week en per leadbron. Een collega telt de bronnen op om de leads van een week te tellen, en een lead die via twee bronnen binnenkwam, telt dubbel. Wat is dat?

- [ ] Een bug: het Data Team zou de tabel moeten herstellen
- [ ] Een Known Gap: een deel van de data ontbreekt
- [x] Een valkuil: elke rij klopt, en ze optellen leest ze verkeerd

Why: één lead in twee bronnen is twee rijen, zoals de tabel belooft, dus er is niets te herstellen en niets ontbreekt. De fout zit in het lezen, en het totaal ziet er juist uit: daarvoor waarschuwt een valkuil.

## Onder Known Behaviour zeggen de valkuilen van een Resource die je wil gebruiken "Nog niets geschreven." Wat vertelt je dat?

- [ ] Hij heeft geen valkuilen
- [ ] Het Data Team controleerde hem en vond er geen
- [x] Niemand schreef er een, of zei dat er geen zijn: vraag het zijn Owner voor je een cijfer vertrouwt dat ertoe doet

Why: stilte is geen antwoord, want misschien keek niemand. Als zijn Owner of het Data Team zegt dat er geen zijn, zegt de kaart het: "Geen, volgens" wie, op welke dag.

## Je team bezit een Resource. In een chat legde je een collega uit waarom een cijfer dat die eruit haalde, niet klopte. Wat nu?

- [ ] Niets meer: die weet het nu
- [ ] Wachten tot een tweede collega dezelfde fout maakt, om zeker te zijn dat het de moeite is om op te schrijven
- [x] Het bij de valkuilen van de Resource schrijven, zodat de volgende collega het leest voor die dezelfde fout maakt

Why: een chat bereikt één collega, één keer. Bij de valkuilen geschreven, bereikt het iedereen die de Resource opent, en Claude leest het ook; wachten op de tweede fout betekent dat iemand ze maakt.

# You can now

de valkuilen van een Resource lezen voor je er een cijfer uit vertrouwt, en vragen "waar vergissen mensen zich in deze tabel?" voor je een eigen Resource publiceert.

## Where to next

- Next to it: K5.3
- Next to it: K5.4
- Apply: [Open Collections](/collections) Open een Resource die je gebruikt en lees zijn valkuilen onder Known Behaviour op zijn Overzicht.
