---
number: K5.5
status: draft
minutes: 5
added: 2026-11-12
changed: 2026-11-12
gain: Je zoekt het verschil tussen twee cijfers waar het begint: wanneer en uit welke data elk gemaakt is, en wie je erover vraagt.
translatedFrom: ceaa64e40d43
---

# Why now

> Ik heb deze staafgrafieken op een printscreen, en dit getal uit een mail. Wat is het verschil?
> — Een collega, aan het Data Team

Niemand weet waar het printscreen genomen is, of waar het getal in de mail vandaan komt. Toch wordt het Data Team gevraagd het verschil tussen de twee te verklaren.

Promise: hoe je vindt waar een cijfer vandaan komt, en wie je erover vraagt.

# Core idea

Voor je iemand vraagt een cijfer te verklaren, weet je wanneer en uit welke data het gemaakt is; in Data Hub leidt de **Query ID** onder het resultaat naar allebei.

## Zoals een foto van een straat

Iemand toont je een foto van een straat en vraagt welke stad het is. Je bestudeert de huizen, de auto's en de uithangborden, en toch gok je.

## Bij Immoscoop

Een collega legt staafgrafieken van een printscreen naast een getal uit een mail, en vraagt het Data Team naar het verschil. Zonder te weten wanneer en uit welke data elk gemaakt is, ziet het Data Team het woord "de" en moet het raden in welke zin het stond. In Data Hub draagt elk resultaat zijn Query ID eronder, en die leidt naar wanneer de query liep, zijn SQL en de Resources die hij las. Een query hoort bij wie hem uitvoerde, dus vraag je het die collega; een Lens vind je in zijn Collection, met de Resources waarop hij gebouwd is, en elke Resource noemt haar Owner. Een cijfer zonder Query ID gaat terug naar wie het stuurde, met dezelfde vraag: wanneer, en uit welke data?

# Check your understanding

## Een slide van je manager toont minder leads voor oktober dan het cijfer dat jij rapporteerde. Wat doe je eerst?

- [ ] Beide cijfers naar het Data Team sturen en vragen waarom ze verschillen
- [x] Uitzoeken wanneer en uit welke data het cijfer op de slide gemaakt is, te beginnen bij wie de slide maakte
- [ ] Je eigen cijfer houden: de slide moet fout zijn

Why: twee cijfers verschillen om een reden die zit in waar ze vandaan komen: een andere dag, een andere tabel, een andere filter. Zolang niet beide herkomsten bekend zijn, kan het Data Team enkel raden welke reden het is, en jij ook.

## Een cijfer uit Data Hub draagt zijn Query ID. Wat vertelt je dat?

- [ ] Dat het cijfer klopt
- [ ] Dat het het cijfer van vandaag is
- [x] Uit welke run het komt: wanneer zijn query liep, en wat die las

Why: een Query ID benoemt één run van één query. Die zegt waar het cijfer vandaan komt, niet of het klopt, en dezelfde query op een andere dag kan een ander cijfer geven.

## Een collega stuurt je een cijfer uit Data Hub met zijn Query ID. Wie kan je de query erachter tonen?

- [x] De collega die hem uitvoerde, want een query hoort bij wie hem uitvoerde
- [ ] Iedereen: elke query in Data Hub is openbaar
- [ ] Niemand: eens een query gelopen is, is hij weg

Why: elke query is van zijn User, in diens paneel van Query, en Data Hub bewaart elke run met zijn Query ID zolang Data Hub bestaat. De collega die hem uitvoerde, opent hem en ziet wat hij las; het Data Team ziet ook elke query.

## Open een Lens in zijn Collection. Wie vraag je eerst naar een cijfer dat hij geeft?

Try it: [Open Collections](/collections)

- [ ] Het Data Team, dat elke Lens maakt
- [x] De Owner van de Resources waarop hij gebouwd is
- [ ] Niemand: een Lens heeft geen eigenaar

Why: collega's in heel Immoscoop maken Lenses, en de pagina van een Lens noemt de Resources waarop hij gebouwd is, elk met de Owner die voor haar data instaat. Daar begint een vraag over zijn cijfers.

# You can now

een cijfer herleiden naar wanneer en uit welke data het gemaakt is voor je iemand vraagt het te verklaren, en eerst vragen: wie vraag ik over deze query?

## Where to next

- Next to it: K5.1
- Next to it: 4.7.1
- Apply: [Open Collections](/collections) Open een Lens in zijn Collection, en zoek de Resources waarop hij gebouwd is en de Owner van elk.
