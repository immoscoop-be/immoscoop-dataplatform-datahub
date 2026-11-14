---
number: K5.10
status: reviewed
minutes: 4
added: 2026-11-14
changed: 2026-11-14
gain: Je weet waarom een knop er voor een collega wel staat en voor jou niet, en aan wie je hem vraagt.
translatedFrom: 36402f2907e0
---

# Why now

> Mijn collega kan queries schrijven in Data Hub en ik niet. Is er bij mij iets kapot?
> — Een collega van sales, na een demo

Hun collega zit in een andere Permission group. Wat een User mag doen in Data Hub, komt uit de groep die het Data Team toekent, niet uit het team waarin die werkt; er is niets kapot.

Promise: wat je Permission group bepaalt, hoe je weet in welke je zit, en hoe je een andere krijgt.

# Core idea

Wat je mag doen in Data Hub, komt uit je **Permission group**, die het Data Team je geeft, en welke data van jou is uit de Groups waarin je zit: een knop die er niet staat, is een Permission die je niet hebt, nooit een fout.

## Bij Immoscoop

Een nieuwe collega meldt voor het eerst aan en komt in Lens user, de standaard Permission group: die laat Lenses draaien, maar maakt geen queries. De teamlead vraagt het aan het Data Team, dat de collega in Business analyst zet. Binnen 15 minuten geldt de nieuwe groep in de webapp, in Claude en in Excel; de collega maakt en draait queries, en een bericht van Data Hub zegt in welke groep die nu zit en wat die kan.

# Check your understanding

## Een collega ziet "Add a Remark" op een Resource, en jij niet. Waarom?

- [ ] De Resource is kapot voor jou
- [ ] Je moet de pagina vernieuwen
- [x] Je Permission group laat je dat soort bericht niet schrijven

Why: welke berichten een User schrijft, staat per soort in de Permission group; je collega zit in een andere. Het Data Team zegt je welke de jouwe is.

## Je wordt aan een andere Group in Data Hub toegevoegd. Wat verandert er?

- [ ] Je Permission group volgt de nieuwe Group
- [ ] Helemaal niets
- [x] De Collections van die Group worden ook van jou; wat je mag doen, blijft je Permission group tot het Data Team ze verandert

Why: welke data van jou is en wat je ermee mag doen, zijn twee aparte dingen: het eerste komt uit de Groups waarin je zit, het tweede uit de Permission group die het Data Team je geeft.

## Claude noemt de kolommen en het aantal rijen van je resultaat, maar niets over de cijfers erin, terwijl de Claude van een collega dat wel doet. Waarom?

- [ ] Claude maakte een fout
- [ ] Je query las te veel
- [x] Je Permission group toont resultaten alleen in een kaart: jij ziet de rijen, Claude leest alleen hun vorm

Why: hoe een resultaat Claude bereikt, is een Permission op zich: in Claude, alleen in een kaart, of niet in Claude.

# You can now

vragen "is dit een Permission die ik niet heb?" voor je een ontbrekende knop als fout meldt, en het Data Team om een andere groep vragen als je die nodig hebt.

## Where to next

- Next to it: K5.1
- Next to it: K5.9
- Apply: [Open je berichten](/messages) Lees wat Data Hub je vertelde toen je Permission group veranderde.
