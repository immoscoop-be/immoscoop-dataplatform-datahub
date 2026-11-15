---
number: K5.14
status: draft
minutes: 4
added: 2026-11-15
changed: 2026-11-15
gain: Je beschrijft je tabel en elk van haar velden in de woorden van de business, zodat collega's buiten je team ze begrijpen zonder het jou te vragen.
translatedFrom: 8032915d54c6
---

# Why now

> Impressions: is dat hoeveel mensen onze site zagen?
> — Een collega van marketing, bij cijfers uit Search Console

De beschrijving uit dbt zegt hoe de tabel gemaakt is: dagelijkse impressions en clicks uit Search Console voor de hele site, uit de bulk export. Ze zegt niet wat een impression is, noch waarvoor de tabel dient, dus een collega buiten SEO houdt een impression voor een bezoeker.

Promise: wat de Business Description toevoegt naast de beschrijving uit dbt, voor de tabel en voor elk van haar velden, en wie ze leest.

# Core idea

De **Business Description** beschrijft in de woorden van de business waarvoor een tabel of een veld dient, naast de beschrijving uit dbt die zegt hoe het gemaakt is: een collega leest de jouwe eerst.

## Bij Immoscoop

Search Console impressions, whole site komt binnen in de Collection Attraction op 2 · Described, met SEO als Owner. SEO schrijft er de Business Description van: "Hoe vaak onze site in Google verschijnt, en hoe vaak mensen doorklikken, per dag, zoekopdracht, land, toestel en zoektype. Gebruik ze voor de trend van onze organische zichtbaarheid; ze telt verschijningen in Google, geen bezoekers op onze site." Voor het veld `data_date` zegt dbt "Date of the data"; SEO voegt toe: "De dag van de zoekopdrachten, in Pacific Time zoals Google telt: een dag eindigt negen uur na de onze." Op haar Overzicht en in haar Kolommen staat elke Business Description eerst, gemarkeerd als Van de Owner, met die uit dbt ernaast; Claude leest ze allebei, en zoeken vindt de Resource op de woorden van elk van beide. Voor ze gepubliceerd wordt, hebben haar Key Fields er ook een nodig; de andere velden zijn aangeraden.

# Check your understanding

## De beschrijving uit dbt van een veld verandert nadat jij er de Business Description voor schreef. Wat gebeurt er met de jouwe?

- [ ] De nieuwe tekst uit dbt vervangt ze
- [ ] Ze wordt verborgen tot je ze opnieuw bevestigt
- [x] Ze blijft zoals je ze schreef, naast de nieuwe, en een bericht toont je beide

Why: geen van beide beschrijvingen vervangt de andere. Verandert die uit dbt, dan krijgt de Owner een bericht met haar tekst ervoor en erna en de Business Description ernaast, zodat jij beslist of de jouwe nog klopt.

## Een Resource van je team heeft veertig velden en nog geen Business Description. Waar begin je?

- [ ] Bij elk veld, een voor een, voor al de rest
- [x] Bij de tabel, dan haar Key Fields; de andere velden als je kan
- [ ] Alleen bij de tabel: velden zijn werk van het Data Team

Why: de tabel en haar Key Fields leest een collega eerst, en die vraagt haar publicatie; de andere velden zijn aangeraden, en een veld zonder de jouwe toont nog altijd zijn beschrijving uit dbt.

## De beschrijving uit dbt van `lead_count` zegt "Number of credit leads". Een collega vraagt of iemand die twee keer aanvroeg twee keer telt. Waar hoort het antwoord?

- [ ] Nergens: de beschrijving uit dbt volstaat
- [ ] In de beschrijving uit dbt: het Data Team herschrijft ze in businesstaal
- [x] In de Business Description van het veld, naast die uit dbt

Why: dbt zegt hoe het veld gemaakt is; of iemand één of twee keer telt, is wat het betekent voor je werk, en dat zeg alleen jij. Op het veld geschreven beantwoordt het elke collega die het leest, en Claude, niet alleen wie het vroeg.

# You can now

in de woorden van de business opschrijven waarvoor een tabel en haar velden dienen, naast wat dbt zegt, en vragen "hoe zou een collega buiten mijn team dit lezen?" voor je ze publiceert.

## Where to next

- Next to it: 4.7.1
- Next to it: K5.15
- Apply: [Open Collections](/collections) Open een Resource van je team en lees haar Beschrijving en haar Kolommen zoals een collega buiten je team dat zou doen.
