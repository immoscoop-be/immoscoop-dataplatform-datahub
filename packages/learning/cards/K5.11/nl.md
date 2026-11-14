---
number: K5.11
status: reviewed
minutes: 4
added: 2026-11-14
changed: 2026-11-14
gain: Je weet of je nog mag bouwen op een Resource die deprecated of ingetrokken is, en wat je in de plaats gebruikt.
translatedFrom: d40c0869874f
---

# Why now

> Deze Resource zegt deprecated. Kloppen de cijfers in mijn rapport nu niet meer?
> — Een collega van credit, tijdens het bouwen van een rapport

Haar Owner markeerde ze als deprecated, met een reden en een Resource om in de plaats te gebruiken. Deprecated verandert niets aan haar cijfers: ze werkt zoals voorheen, en haar reden zegt waarom niemand er nog op zou moeten beginnen bouwen.

Promise: wat deprecated en ingetrokken je vertellen, en wat je met elk doet.

# Core idea

Een **deprecated** Resource werkt nog, maar je bouwt er niet meer op, dus bouw wat nieuw is op de Resource die haar markering noemt; een ingetrokken Resource is weg voor iedereen behalve haar Owner Unit en het Data Team, en wat haar leest, stopt tot ze terugkomt.

## Bij Immoscoop

Het credit-team markeert Weekly lead volume als deprecated: "een lead die twee bronnen delen, telt hier dubbel", met Leads per week als de Resource om in de plaats te gebruiken. De Resource toont de markering op haar pagina, in haar Collection en in het paneel, en Claude noemt ze; de Lenses erop blijven werken, en het credit-team bouwt hun vervangers op Leads per week, als nieuwe queries die eigen Lenses worden. Een maand later biedt het Data Team Weekly lead volume in dbt niet meer aan Data Hub aan: ze is ingetrokken. Alleen het credit-team en het Data Team zien ze nog, met haar Collection, haar bekrachtigingen en haar geschiedenis; een Lens die haar nog las, is Broken. Was het een vergissing geweest, dan was ze teruggekomen zoals ze was.

# Check your understanding

## Een Resource die je Lens leest, is gemarkeerd als deprecated. Wat gebeurt er met de Lens?

- [ ] Hij stopt met werken
- [ ] Data Hub zet hem over naar de Resource om in de plaats te gebruiken
- [x] Hij blijft werken; bouw zijn vervanger op de Resource die de markering noemt, zolang hij nog werkt

Why: deprecated verbergt niets en blokkeert niets: het waarschuwt. Een Lens houdt zijn Resources; een op een andere Resource is een nieuwe query, die een eigen Lens kan worden.

## Een Resource die een collega vorige maand gebruikte, is nergens meer te vinden. Wat kan er gebeurd zijn?

- [ ] Ze is verwijderd, met heel haar geschiedenis
- [ ] Data Hub verbergt Resources die een maand niemand gebruikte
- [x] Ze is ingetrokken: alleen haar Owner Unit en het Data Team zien ze nog, en ze komt terug zoals ze was als ze terugkeert

Why: ingetrokken is niet verwijderd. Een Resource wordt ingetrokken als dbt ze niet meer aan Data Hub aanbiedt; ze houdt haar Collection, haar bekrachtigingen en haar geschiedenis, klaar om terug te komen.

## Je begint een nieuw rapport. Een Resource die past, is gemarkeerd als deprecated, met een andere om in de plaats te gebruiken. Waarop bouw je?

- [ ] Op de deprecated, want ze werkt nog
- [ ] Op geen van beide, tot het Data Team het bevestigt
- [x] Op de Resource die de markering noemt, want haar Owner raadt de deprecated af

Why: deprecated is de Owner die iedereen zegt er niets nieuws meer op te bouwen; wat je vandaag op een deprecated Resource bouwt, zet je morgen over.

# You can now

deprecated van ingetrokken onderscheiden, en vragen "wat zegt de markering in de plaats te gebruiken?" voor je op een Resource bouwt.

## Where to next

- Next to it: K5.7
- Next to it: K5.1
- Apply: [Open Collections](/collections) Open een Resource die je gebruikt en zoek de markering deprecated, met wat je in de plaats gebruikt.
