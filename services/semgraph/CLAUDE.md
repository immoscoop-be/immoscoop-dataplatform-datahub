# Werken in deze repository

semgraph is de grafiekserver van de grafiektaal: zie [README.md](README.md) voor de opbouw en
[docs/requirements](docs/requirements/README.md) voor wat hij moet doen.

## Requirements

Elke functionele requirement heeft een nummer `REQ-xxx`.

- **Waar ze binnenkomen.** Nieuwe requirements staan op Confluence:
  [Requirements grafiektaal](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1359872021). Ook een opdracht
  in een gesprek of issue die daar nog niet staat, is een requirement. Geef ze het volgende vrije nummer en zet ze
  op Confluence, met de datum van de opdracht en de opdracht als bron.
- **Bron van waarheid.** Zolang een requirement niet geïmplementeerd is, is Confluence de bron. Eens ze
  geïmplementeerd is, is dat deze repository: `docs/requirements/REQ-xxx.md`. Een latere wijziging begint dus hier,
  als een nieuwe requirement die naar de oude verwijst, en niet op Confluence.
- **Volgorde.** Spreken requirements elkaar tegen, dan geldt de recentste beslissing. Dat is de datum (en het
  tijdstip) van beslissing, niet het nummer.

## Een nieuwe requirement: eerst scherp, dan bouwen

Leg elke nieuwe requirement naast drie bronnen voor je iets implementeert:

1. de geïmplementeerde requirements in `docs/requirements/`;
2. de open requirements op Confluence;
3. de regels in Figma ([bestand grafiektaal](https://www.figma.com/design/X9FMecd5iH6jIced8nZQf6)) en de
   [analyse](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1352106324).

Spreekt ze iets tegen, of laat ze meer dan één redelijke uitvoering toe:

- **Meld het voor je code schrijft.** Citeer de botsende requirements letterlijk, met nummer en datum, en zeg wat
  elke keuze in de code verandert.
- **Trek het in discussie.** Stel een concrete vraag met een voorstel, en wacht op het antwoord. "De recentste
  wint" bepaalt je voorstel, maar vervangt de discussie niet: een nieuwere requirement kan het oudere geval over
  het hoofd gezien hebben.
- **Implementeer pas als de requirement scherp is.** De uitkomst van de discussie wordt een nieuwe of aangescherpte
  requirement: een nieuwe rij op Confluence die naar de oude verwijst.
- **Is maar een deel scherp?** Implementeer dat deel. Zet de rest bij de open punten in
  `docs/requirements/README.md`, met de vraag erbij.

## Verwijzen naar requirements

- **Commitboodschappen** noemen de nummers, bv. `REQ-006: mean as diamond`.
- **In de code** staat het nummer waar een regel uit een requirement komt en iemand zou vragen "waarom zo?", bv.
  `// REQ-001: ...`. Niet op elke regel.
- **Tests.** `test/requirements.test.ts` heeft per requirement een test, die over elk voorbeeld van elke semgraph
  loopt. Andere tests mogen het nummer in hun naam dragen.

## Eens geïmplementeerd

1. Maak `docs/requirements/REQ-xxx.md` aan of werk het bij volgens het sjabloon in
   [docs/requirements/README.md](docs/requirements/README.md). Daarin staan de tekst zoals beslist, hoe ze
   geïmplementeerd is, code, tests, branch, commits en PR.
2. Werk het register in `docs/requirements/README.md` bij.
3. Vul op Confluence de rij aan met branch, commit en PR (links naar GitHub) en de link naar het bestand in de repo.

## Ontwikkelen

- Node 24 (`.nvmrc`) voert de TypeScript rechtstreeks uit. De commando's:
  - `npm test` en `npm run typecheck`;
  - `npm run schemas` na een wijziging aan een contract;
  - `UPDATE_GOLDEN=1 npm test` na een bewuste wijziging aan de tekening. Bekijk eerst de SVG's (`npm run render:examples`).
- Alles wat slim is gebeurt in onze code; Vega-Lite tekent enkel wat het krijgt.
- Geen codeduplicatie: een nieuwe grafiek is een subklasse (REQ-014).
- Commit en push enkel naar de afgesproken branch.
