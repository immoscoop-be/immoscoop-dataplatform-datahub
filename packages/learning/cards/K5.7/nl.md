---
number: K5.7
status: draft
minutes: 4
added: 2026-11-14
changed: 2026-11-14
gain: Je weet wat een rode stip betekent, wie het herstelt, en dat het vaak vanzelf weer werkt.
translatedFrom: cdfe4b3f8371
---

# Why now

> Mijn rapport heeft vanochtend een rode stip. Heb ik iets kapotgemaakt?
> — Een collega van marketing, op een maandagochtend

Vannacht verdween een kolom die het rapport leest uit de data, omdat ze in dbt een andere naam kreeg. Het rapport toonde geen foute cijfers: het stopte.

Promise: wat de rode stip betekent, wie het herstelt, en waarom het vaak vanzelf weer werkt.

# Core idea

Wat iets leest dat niet meer bestaat, is **Broken**: het stopt liever dan cijfers te tonen waar het niet meer voor instaat, en het werkt weer zodra wat het leest terug is, of zodra zijn query leest wat ervoor in de plaats kwam.

## Bij Immoscoop

Het Data Team geeft de kolom `lead_channel` van Weekly lead volume in dbt een andere naam. Na de volgende run is de Lens Leads per source name, die `lead_channel` leest, Broken: niemand kan hem nog laten draaien, hij draagt overal waar hij staat een rode stip, en de rapporten waar hij in zit, zijn ook Broken. Het credit-team, zijn Owner Unit, krijgt het bericht "De lens Leads per source name werkt niet meer", dat de kolom noemt die niet meer bestaat. Het team past de query van de Lens aan naar de nieuwe naam, en de rode stip verdwijnt. Was de kolom teruggekomen, dan had de Lens vanzelf weer gewerkt.

# Check your understanding

## Een rapport dat je gebruikt, heeft sinds vanochtend een rode stip. Wat is er gebeurd?

- [ ] De cijfers erin kloppen nu niet meer
- [ ] Jij hebt het kapotgemaakt door gisteren een filter te wijzigen
- [x] Iets wat het leest, bestaat niet meer, dus het draait niet tot dat terug is of zijn query aangepast is

Why: een rapport dat Broken is, toont helemaal geen cijfers in plaats van foute. Houd je de aanwijzer op de rode stip, dan zie je wat niet meer bestaat; niets wat jij aan het rapport deed, heeft het veroorzaakt.

## Het Data Team gaf een kolom die je eigen query leest een andere naam. Wat doet Data Hub?

- [ ] Het past je SQL aan naar de nieuwe naam
- [ ] Niets: de query blijft draaien met de oude naam
- [x] Het markeert je query als Broken en laat het je weten; jij past de SQL aan, of hij werkt weer als de oude naam terugkomt

Why: een kolom met een nieuwe naam is voor Data Hub een kolom die verdwenen is, en een nieuwe. Data Hub herschrijft je SQL nooit: jij beslist of de nieuwe kolom betekent wat de oude betekende.

## Wie herstelt een Lens die Broken is?

- [ ] Het Data Team, altijd
- [ ] Elke collega die hem gebruikt
- [x] Zijn Owner Unit past zijn query aan, of niemand hoeft iets te doen als wat ontbreekt terugkomt

Why: de Owner Unit staat in voor de Lens, dus zij krijgt het bericht en past de query aan; komt wat ontbreekt terug, dan herstelt Data Hub niets, de Lens draait gewoon weer.

## Eén Lens van een rapport met vijf is Broken. Wat met het rapport?

- [ ] De andere vier Lenses tonen nog, zonder de kapotte
- [x] Het rapport is Broken tot die Lens weer werkt, of tot zijn Owner de Lens eruit haalt
- [ ] Het rapport houdt de laatste cijfers van die Lens

Why: een rapport lees je als geheel, dus een ontbrekend deel doet alles stoppen in plaats van een half verhaal te vertellen.

# You can now

aan een rode stip zien wat niet meer bestaat en wie het herstelt, en vragen "komt het terug, of passen we de query aan?" voor iemand iets opnieuw bouwt.

## Where to next

- Next to it: K5.1
- Deeper: 4.3.2
- Apply: [Open je berichten](/messages) Bekijk of iets van jou Broken is, en wat niet meer bestaat.
