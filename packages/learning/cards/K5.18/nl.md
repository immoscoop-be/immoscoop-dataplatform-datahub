---
number: K5.18
status: draft
minutes: 4
added: 2026-11-15
changed: 2026-11-15
gain: Je weet wat een Data Admin over je Resource vastlegt, waarom je het nakijkt, en hoe je het laat rechtzetten.
translatedFrom: e3b9bf284aa3
---

# Why now

> Publiceren vraagt naar een modeltype, een grain en mappings. Moet ik die zelf invullen?
> — Een collega van SEO, voor het publiceren van een Resource

Een Data Admin legt ze vast, in Data Hub, en ze houden geen publicatie tegen; op de Resource staat het eerste als haar modeltype. Toch bepalen ze hoe iedereen op de tabel telt en ze joint, en niemand weet beter dan haar Owner of ze kloppen.

Promise: wat de Data Admin vastlegt, waarom je het nakijkt, en hoe je het laat rechtzetten.

# Core idea

De **Data Admin** legt het modeltype, de grain en de mappings van een Resource vast; haar Owner kijkt ze na, want de EDA en elke join vertrekken ervan.

## Bij Immoscoop

Een Data Admin legt Weekly lead volume vast als een `aggregate` met één rij per `week_start` en `lead_source`, en mapt `lead_source` op `leadSource.leadSourceId`. Haar Overzicht toont dan "modeltype: aggregate" en "grain: week_start × lead_source", gemarkeerd als Van het Data Team, en zegt dat ze via de leadbron linkt met Lead sources. Het credit-team, haar Owner, leest ze na. Had de grain één rij per week gezegd, dan nam een collega, of Claude, de leadtelling van één rij voor de hele week; was `lead_source` niet gemapt, dan noemden haar Overzicht en Claude geen enkele Resource waarmee ze linkt. Wat niet klopt, vraagt het credit-team het Data Team recht te zetten in een vraag op de Resource: alleen een Data Admin past het aan, in Data Hub, en Claude kan het niet.

# Check your understanding

## Claude ziet dat de grain die voor je Resource vastligt een veld mist. Wat gebeurt er dan?

- [ ] Claude zet ze recht, zodra jij akkoord gaat
- [ ] Jij zet ze recht op het Overzicht, zoals de Business Description
- [x] Je vraagt het aan het Data Team, zelf of via Claude in een bericht, en een Data Admin zet ze recht in Data Hub

Why: het modeltype, de grain en de mappings legt alleen een Data Admin vast, in de web-app. Claude kan de vraag schrijven zodra jij akkoord gaat; daarna kijk jij na wat de Data Admin vastlegde.

## Voor je Resource liggen nog geen modeltype en geen grain vast, en je wil ze publiceren. Wat geldt er?

- [ ] Je kan ze niet publiceren tot een Data Admin ze vastlegt
- [ ] Niets voor jou: ze zijn de zaak van het Data Team
- [x] Je mag ze publiceren, maar vraag ze nu al: de EDA, die haar naar 4 · Explored brengt, vertrekt ervan

Why: ze houden geen publicatie tegen, maar wat één rij is, bepaalt hoe iedereen op de Resource telt en wat haar EDA nakijkt. Data Hub toetst een grain niet aan de data, dus haar Owner, die de rijen kent, is wie ze naleest.

## Een veld van je Resource bevat de identiteit van een kantoor, maar er ligt geen mapping voor vast. Wat missen collega's?

- [ ] Niets: Data Hub linkt het vanzelf via de naam van het veld
- [x] Haar Overzicht, en Claude, noemen geen enkele Resource waarmee ze via het kantoor joint
- [ ] Niets: het betekent alleen dat de Resource nog niet gepubliceerd kan worden

Why: een mapping linkt de Resource met elke Resource die dezelfde Entity draagt, en daar begint een join. Data Hub linkt op mappings, niet op namen: een naam die overeenkomt met het Domain Model laat het er alleen een voorstellen, die een Data Admin bevestigt. Een mapping is aangeraden, niet verplicht, dus vraag ze wanneer collega's op dat veld zullen joinen.

# You can now

het modeltype, de grain en de mappings nakijken die een Data Admin voor je Resource vastlegde, en vragen "is één rij echt wat hier staat?" voor de EDA of iemand anders erop telt.

## Where to next

- Deeper: 2.3.6
- Next to it: 2.3.5
- Apply: [Open Collections](/collections) Open een Resource van je team en bekijk haar modeltype, haar grain en haar Entities op haar Overzicht.
