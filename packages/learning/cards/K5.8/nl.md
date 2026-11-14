---
number: K5.8
status: draft
minutes: 4
added: 2026-11-14
changed: 2026-11-14
gain: Je vindt het antwoord dat een collega al bouwde voor je je eigen query schrijft, en je weet wanneer je eigen query de juiste weg is.
translatedFrom: 733c4468793a
---

# Why now

> De lens die ik elke maandag gebruik, is verwijderd. Moet ik de SQL nu zelf schrijven?
> — Een collega van marketing, op een maandag

De lens achter hun wekelijkse rapport is weg. Een eigen query schrijven lijkt de enige weg terug, terwijl een andere Lens dezelfde vraag misschien al beantwoordt.

Promise: wanneer een Lens het betere antwoord is, en wanneer je eigen query.

# Core idea

Zoek een **Lens** voor je een query schrijft: een Lens is een vraag die een collega al beantwoordde en blijft laten werken, met Parameters die je zelf instelt; je eigen query is voor de vraag die geen Lens beantwoordt.

## Bij Immoscoop

Mia Peeters verwijderde de lens Leads per source name, met "Vervangen door de lens Leads per source, week by week". In plaats van zijn SQL opnieuw te schrijven, opent de collega de nieuwe Lens, stelt de week in als Parameter, en heeft het cijfer voor maandag. Als die later ook de leads per regio nodig heeft, die geen enkele Lens toont, start die een nieuwe query op Weekly lead volume: Data Hub toont eerst de Lenses op die Resource, en pas dan de lege query.

# Check your understanding

## Je wil het aantal leads per bron van vorige maand. Wat doe je eerst?

- [ ] Een query schrijven op de Resource met de leads
- [x] Een Lens zoeken die het beantwoordt: een nieuwe query toont eerst de Lenses op zijn Resources
- [ ] Het Data Team om een export vragen

Why: een Lens is een vraag die iemand al beantwoordde, controleerde en blijft laten werken; je stelt zijn Parameters in, zoals de maand, zonder aan zijn SQL te komen. Data Hub kent geen exports.

## Een Lens toont de leads per bron per week, maar je hebt ze ook per regio nodig. Wat nu?

- [ ] De SQL van de Lens aanpassen
- [ ] De Lens gebruiken en de regio's met de hand toevoegen in Excel
- [x] Je eigen query schrijven op dezelfde Resources; de Lens blijft zoals hij is voor iedereen die hem gebruikt

Why: een Lens hoort bij zijn Owner Unit en dient elke collega die hem laat draaien; een eigen vraag is een eigen query.

## Je eigen query beantwoordt een vraag die je hele team elke week stelt. Wat verdient hij?

- [ ] Niets: iedereen kan je SQL kopiëren
- [ ] Elke maandag een screenshot in Slack
- [x] Een Lens worden, zodat het team hem met zijn eigen Parameters laat draaien en hij blijft werken

Why: een vraag die terugkomt, is waar een Lens voor dient; een gekopieerde query of een screenshot beantwoordt ze één keer, en veroudert zonder dat iemand het merkt.

# You can now

vragen "beantwoordt een Lens dit al?" voor je een query schrijft, en weten wanneer je eigen query de juiste weg is.

## Where to next

- Next to it: K5.5
- Next to it: K5.6
- Apply: [Open Query](/query/new) Geef je vraag een naam en kies haar Resources: de Lenses die ze al beantwoorden, komen eerst.
