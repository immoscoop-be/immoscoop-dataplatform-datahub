---
number: K5.10
status: draft
minutes: 4
added: 2026-11-14
changed: 2026-11-14
gain: Je weet waarom een knop er voor een collega wel staat en voor jou niet, en aan wie je hem vraagt.
translatedFrom: 23b543006d71
---

# Why now

> Mijn collega kan queries schrijven in Data Hub en ik niet. Is er bij mij iets kapot?
> — Een collega van sales, na een demo

Hun collega zit in een andere Permission group. Wat een User mag doen in Data Hub, komt uit de groep die het Data Team toekent, niet uit het team waarin die werkt; er is niets kapot.

Promise: wat je Permission group bepaalt, waar je hem ziet, en hoe je een andere krijgt.

# Core idea

Wat je mag doen in Data Hub, komt uit je **Permission group**, die het Data Team je geeft, en welke data van jou is uit je Owner Units: een knop die er niet staat, is een Permission die je niet hebt, nooit een fout.

## Bij Immoscoop

Een nieuwe collega meldt voor het eerst aan en komt in Lens user, de standaard Permission group: die laat Lenses draaien, maar maakt geen queries. Op My page staat welke groep dat is en wat ze toelaat. De teamlead vraagt het aan het Data Team, dat de collega in Business analyst zet. Binnen 15 minuten geldt de nieuwe groep in de webapp, in Claude en in Excel; de collega maakt en draait queries, en een bericht van Data Hub zegt wat die nu kan.

# Check your understanding

## Een collega ziet "Add a Remark" op een Resource, en jij niet. Waarom?

- [ ] De Resource is kapot voor jou
- [ ] Je moet de pagina vernieuwen
- [x] Je Permission group laat je dat soort bericht niet schrijven

Why: welke berichten een User schrijft, staat per soort in de Permission group; je collega zit in een andere. My page toont de jouwe.

## Je verhuist naar een ander team. Wat verandert er in Data Hub?

- [ ] Je Permission group volgt je nieuwe team
- [ ] Helemaal niets
- [x] De Collections die van jou zijn, volgen je Owner Units; wat je mag doen, blijft je Permission group tot het Data Team ze verandert

Why: welke data van jou is en wat je ermee mag doen, zijn twee aparte dingen: het eerste komt uit de teams waarin je zit, het tweede uit de Permission group die het Data Team je geeft.

## Claude noemt de kolommen en het aantal rijen van je resultaat, maar niets over de cijfers erin, terwijl de Claude van een collega dat wel doet. Waarom?

- [ ] Claude maakte een fout
- [ ] Je query las te veel
- [x] Je Permission group toont resultaten alleen in een kaart: jij ziet de rijen, Claude leest alleen hun vorm

Why: hoe een resultaat Claude bereikt, is een Permission op zich: in Claude, alleen in een kaart, of niet in Claude.

# You can now

je Permission group vinden op My page, en vragen "is dit een Permission die ik niet heb?" voor je een ontbrekende knop als fout meldt.

## Where to next

- Next to it: K5.1
- Next to it: K5.9
- Apply: [Open My page](/me) Bekijk je Permission group en wat hij toelaat.
