---
number: K5.6
status: draft
minutes: 4
added: 2026-11-12
changed: 2026-11-12
gain: Je ziet hoeveel data een query leest voor hij loopt, en vreest niet langer dat je geld over de balk gooit.
translatedFrom: 44938aa7fd7f
---

# Why now

> Verbruik ik hier niet te veel data mee? Ik wil geen geld over de balk gooien.
> — Een collega buiten data, vlak voor een query

Elke query leest data in BigQuery, en lezen kost geld. Zolang je niet ziet hoeveel een query leest, voelt elke query als een risico.

Promise: hoe je ziet wat een query zal lezen voor hij loopt, en wat een waarschuwing van je vraagt.

# Core idea

De **Pre-flight** toont wat een query zal lezen voor hij loopt, zodat je ziet wat je doet: zolang hij geen waarschuwing geeft, doe je niets fout.

## Zoals een prepaid belkaart

Je ziet je beltegoed voor je belt, en er komt een waarschuwing als het bijna op is. Tot dan bel je gewoon.

## Bij Immoscoop

Een collega die met de ruwe eventdata werkte, voerde ooit een heel dure query uit. Data Hub meet elke query voor hij loopt: de Pre-flight zegt wat hij zal lezen, in MB of GB, niet in euro. Standaard loopt een query die tot 100 MB leest meteen; van 100 MB tot 1 GB keur je hem zelf goed, na een waarschuwing; boven 1 GB loopt hij pas als het Data Team een aanvraag aanvaard heeft.

# Check your understanding

## De Pre-flight van je query zegt dat hij hoogstens 40 MB leest, en toont geen waarschuwing. Wat vertelt je dat?

- [ ] Nog niets: wat een query kost, zie je pas achteraf
- [ ] Hij kan nog altijd geld over de balk gooien: vraag het Data Team voor je hem uitvoert
- [x] Hij blijft onder de eerste drempel: voer hem uit, je doet niets fout

Why: de Pre-flight meet een query voor hij loopt, dus je weet wat hij leest voor hij iets kost. Zonder waarschuwing blijft hij binnen wat je vrij mag uitvoeren.

## De knop Uitvoeren is rood geworden: de Pre-flight zegt dat je query hoogstens 600 MB leest, en vraagt je hem goed te keuren. Wat doe je?

- [ ] Goedkeuren: de knop laat het toe, dus het is in orde
- [ ] De query sluiten: een rode knop betekent dat je iets fout deed
- [x] Lezen wat de waarschuwing zegt en wat minder zou lezen, en dan beslissen of je vraag zoveel nodig heeft

Why: tussen de twee drempels is de keuze aan jou. De pop-out op de knop zegt wat minder leest, zoals een filter op een kortere periode. Goedkeuren nadat je het gelezen hebt, is in orde; erlangs klikken zonder te lezen is het enige wat je vermijdt.

## Met de drempels zoals ze standaard staan, zou een query 3 GB lezen. Wat gebeurt er?

- [ ] Hij loopt, en de rekening komt later
- [ ] Hij loopt na een waarschuwing, zoals elke grote query
- [x] Hij loopt niet tot iemand van het Data Team er een aanvraag voor aanvaard heeft

Why: standaard kijkt het Data Team eerst boven 1 GB. Je stuurt de query naar hen, met een woordje over waarom als je wil, en hun antwoord komt terug in je Message Centre; eens aanvaard, loopt die query voor jou.

## Je verandert vijf keer de periode van een query, om te zien wat elke versie leest. Wat kostte dat?

- [ ] Vijf query's: elke controle leest de data
- [x] Niets: de Pre-flight meet een query zonder de data te lezen
- [ ] Alleen de laatste versie, die je hield

Why: de Pre-flight vraagt BigQuery wat de query zou lezen, zonder het te lezen, en dat kost niets. Pas een uitvoering leest de data.

# You can now

vragen "hoe zwaar is dit?" voor je een query uitvoert, het antwoord in zijn Pre-flight vinden, en hem zonder zorgen uitvoeren zolang er geen waarschuwing komt.

## Where to next

- Next to it: K5.1
- Apply: [Open Query](/query/new) Schrijf een query en lees de balk eronder: wat hij leest, tegen de twee drempels van de meter.
