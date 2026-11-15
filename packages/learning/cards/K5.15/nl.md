---
number: K5.15
status: draft
minutes: 4
added: 2026-11-15
changed: 2026-11-15
gain: Je toont collega's waar ze beginnen in een tabel met veel velden en waarop ze haar Preview filteren, en de EDA wat ze eerst verkent.
translatedFrom: a17fda4a2fe4
---

# Why now

> Tien velden, en ik wil alleen Discover. Welke tellen, en waarop filter ik?
> — Een collega van marketing, die Search Console impressions voor het eerst opent

SEO weet dat vijf van de tien velden bijna elke vraag beantwoorden, en dat Discover mengen met web search de klassieke fout is. De collega weet dat niet, en de Resource zegt het pas als haar Owner die velden aangeduid heeft.

Promise: welke velden je aanduidt als Key Fields en als Parameters, en wat elk doet voor een collega, een Preview en de EDA.

# Core idea

**Key Fields** zijn de weinige velden van een Resource waar een collega eerst naar moet kijken en die haar EDA verkent; haar Parameters zijn de velden waarop haar Preview laat filteren.

## Bij Immoscoop

Search Console impressions, whole site heeft tien velden en één rij per dag, zoekopdracht, land, toestel en zoektype. SEO duidt vijf Key Fields aan: `data_date`, `query`, `search_type`, `impressions` en `clicks`. `country` en `device` horen bij de grain maar zijn geen Key Field, en `impressions` identificeert geen rij maar is er wel een: een Key Field is wat telt, niet wat een rij uniek maakt. Elk Key Field heeft een Business Description nodig voor de Resource gepubliceerd wordt, en de EDA verkent minstens deze vijf. SEO duidt één Parameter aan, `search_type`: haar Preview biedt dan zijn waarden aan om te kiezen, zoals web, discover en news, naast de nieuwste dagen, zodat een collega alleen Discover ziet zonder SQL te schrijven. Beide lijsten staan onder Bevragen op haar Overzicht, en Claude leest ze voor elke query op de Resource.

# Check your understanding

## Een Resource bevat één rij per pand per dag, geïdentificeerd door `listing_id` en `day`. Zijn die twee haar Key Fields?

- [ ] Ja: Key Fields zijn de velden die elke rij identificeren
- [x] Alleen als een collega er eerst naar moet kijken; wat elke rij identificeert, is haar grain
- [ ] Ja, en geen ander veld mag er een zijn

Why: de grain zegt wat één rij is; de Key Fields zeggen waar een collega begint. Een telling die geen rij identificeert, is vaak een Key Field, en een veld van de grain hoeft er geen te zijn.

## Een collega wil dat de Preview van een Resource van jou alleen de rijen van één land toont, zonder SQL te schrijven. Wat maakt dat mogelijk?

- [ ] `country` aanduiden als Key Field
- [x] `country` aanduiden als Parameter: de Preview biedt dan zijn waarden aan om te kiezen
- [ ] Niets: een Preview toont altijd de nieuwste rijen van alles

Why: een Preview biedt een keuze voor haar partitiekolom, haar eerste clusterkolom en elke Parameter van haar Resource, met tot 100 waarden om uit te kiezen. Key Fields veranderen niets aan een Preview: ze zeggen een collega, en de EDA, waar te kijken.

## Voor de zekerheid duid je twintig van de dertig velden van een Resource aan als Key Fields. Wat doet dat?

- [ ] Alleen goeds: meer Key Fields, meer hulp
- [ ] Data Hub houdt de vijf meest gebruikte en laat de rest vallen
- [x] Collega's zien niet meer waar te beginnen, elk van de twintig heeft een Business Description nodig voor je publiceert, en de EDA verkent ze alle twintig

Why: Key Fields werken omdat het er weinig zijn: ze zeggen waar te beginnen. Elk ervan vraagt een Business Description voor de publicatie, en de EDA dekt minstens ze allemaal.

# You can now

de weinige velden waarmee een collega moet beginnen aanduiden als Key Fields en die waarop ze filteren als Parameters, en vragen "welke velden beantwoorden bijna elke vraag die eraan gesteld wordt?" voor je kiest.

## Where to next

- Next to it: K5.14
- Next to it: K5.18
- Apply: [Open Collections](/collections) Open een Resource en bekijk haar Key Fields en Parameters onder Bevragen op haar Overzicht, en daarna de keuzes van haar Preview.
