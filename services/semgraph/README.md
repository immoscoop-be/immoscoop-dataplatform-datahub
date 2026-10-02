# immoscoop-ptditt-semgraph

Semantic chart service: renders charts by meaning (e.g. `movingWindowAverage`), not form, following the Immoscoop
chart language. The rules live in the service: the caller sends raw values, and the service computes, validates
and draws, with title, reading cue and footer.

- Analysis (functional and technical): [ptditt - Tooling - Grafiekserver](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1352106324)
- Chart language, the source of truth for every visual rule: [Figma, file grafiektaal](https://www.figma.com/design/X9FMecd5iH6jIced8nZQf6)

## Status: v0, a walking skeleton

One semgraph, `movingWindowAverage`, end to end as SVG over REST, in English and Dutch (nl-BE), packaged as one
Docker image. MCP, PNG, the interactive HTML page, the widget, the choice aid (`/choose`) and the other semgraphs
come later, on the same core.

![movingWindowAverage example](test/golden/movingWindowAverage-basic.svg)

## Run it

Requires Node 24 (`.nvmrc`; Node ≥ 22.18 also works). Node runs the TypeScript sources directly, so there is no
build step.

```sh
npm ci
npm start                 # http://localhost:8080
npm test                  # unit, API, conformance and golden SVG tests
npm run typecheck
npm run render:examples   # every example to out/*.svg, to compare with Figma
```

With Docker:

```sh
docker build -t semgraph .
docker run --rm -p 8080:8080 semgraph
```

Then open <http://localhost:8080/semgraphs/movingWindowAverage/examples/basic> in a browser, or:

```sh
curl -X POST http://localhost:8080/render \
  -H 'content-type: application/json' \
  --data @semgraphs/movingWindowAverage/examples/basic.json > basic.svg
```

The container is stateless, needs no secrets and listens on `PORT` (default 8080). It has no login of its own:
that comes from the platform it is deployed on (still to be agreed), so do not expose it publicly.
`LOG_LEVEL` sets the log level (default `info`).

## API

| Call | Does |
| --- | --- |
| `GET /healthz` | `{status, version, languageVersion, tokensVersion}` |
| `GET /semgraphs` | available semgraphs (title, the question they answer) and the planned ones; `?locale=` |
| `GET /semgraphs/{id}` | metadata, JSON Schema, links to Figma and learning material, examples |
| `POST /validate` | checks a request without drawing; always 200 with `{outcome, issues}` |
| `POST /render` | draws the chart: 200 SVG, 422 refusal, 400 invalid request |
| `GET /semgraphs/{id}/examples/{name}` | renders one of the example requests, for a demo in the browser |

Every request ends in one of four outcomes:

| Outcome | `/render` | Meaning |
| --- | --- | --- |
| `ok` | 200 SVG | The chart follows the chart language and carries the version label. |
| `deviation` | 200 SVG | Tolerated deviation: drawn, with "Outside the chart language: …" in the footer and no version label. The codes are in the `Semgraph-Deviations` header. |
| `refused` | 422 JSON | The chart would mislead, so it is not drawn. |
| `invalid` | 400 JSON | The request itself is not valid. |

Issues always have the same shape, in the language of `locale`:

```json
{
  "level": "refusal",
  "code": "uniqueAggregationRequired",
  "field": "/uniqueAggregation",
  "message": "For unique counts you have to choose: the average of the daily uniques, or the uniques over the whole window. Those are two different metrics.",
  "alternative": "Add uniqueAggregation dailyAverage for the average of the daily uniques. …",
  "learnMore": "https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1354629146"
}
```

SVG responses also carry `Semgraph-Language-Version` and `Semgraph-Tokens-Version`, `nosniff` and a strict
Content-Security-Policy.

## movingWindowAverage

The request from the analysis, plus `measureType` (required until Domain Hub or the dbt YAML supplies it):

```json
{
  "semgraph": "movingWindowAverage",
  "metric": "creditLeads",
  "measureType": "additive",
  "window": 7,
  "spread": "stddev",
  "horizon": 28,
  "format": "svg",
  "locale": "nl-BE",
  "data": [
    { "day": "2026-09-01", "value": 42 },
    { "day": "2026-09-02", "value": 38 }
  ]
}
```

Optional: `title`, `uniqueAggregation` (`dailyAverage` or `overWindow`, required for unique counts), and
`context` for the footer (`domain`, `dataset`, `owner`, `reliability`, `definitionUrl`). The full contract is
[`semgraphs/movingWindowAverage/schema.json`](semgraphs/movingWindowAverage/schema.json). Unknown fields are
rejected, so a typo never silently becomes a default and no extra columns (such as personal data) get in.

**Zero is not missing.** `0` is a measured zero; `null` or an absent day means "no data", drawn as missing and
never as zero. A `GROUP BY day` in BigQuery returns no row for a day without events, so complete the days first,
and only use 0 where nothing happening really means zero:

```sql
WITH days AS (
  SELECT day
  FROM UNNEST(GENERATE_DATE_ARRAY(
    DATE_SUB(CURRENT_DATE('Europe/Brussels'), INTERVAL 40 DAY),
    DATE_SUB(CURRENT_DATE('Europe/Brussels'), INTERVAL 1 DAY))) AS day
)
SELECT FORMAT_DATE('%F', day) AS day, COALESCE(counts.value, 0) AS value
FROM days
LEFT JOIN (
  SELECT DATE(created_at, 'Europe/Brussels') AS day, COUNT(*) AS value
  FROM `project.dataset.table`
  GROUP BY day
) AS counts USING (day)
ORDER BY day
```

What the service does:

1. "Today" is the last day in the data, but never the running day in Brussels, which is not complete yet. The 0
   tick reads "today" when that is yesterday, and the date otherwise.
2. Per day on the relative axis, the mean and the sample standard deviation (n − 1, the same as `STDDEV` in
   BigQuery; a test compares with BigQuery's output) over exactly the same window. A window with a missing day has
   no point: one missing day leaves a gap of `window` points.
3. Rules: refusal for a measure type the metadata does not allow, unique counts without `uniqueAggregation`,
   uniques over the window, fewer than `minimumPoints` values in the horizon + window − 1 days the chart uses, or
   no complete window at all. Tolerated deviation for a window that is not a multiple of 7, or a mean without
   spread.
4. Drawing: the mean as a dot over a thin bar of ±1 sd in the light tint of the focus colour, missing stretches as
   an outlined area labelled "no data", the last day's value (bold) with its spread (detail), both axes labelled,
   a value axis from zero with a darker, thicker baseline.
5. The footer: domain › dataset · owner; reliability · as-of date · definition; "How do I read this chart?".
   Missing context is printed as unknown: absence is never polished away.

## How it is built

```text
vocabulary/attributes.yml              closed vocabulary of the 7 attributes
semgraphs/catalog.yml                  all 12 semgraphs of the catalogue: available or planned
semgraphs/<id>/                        metadata.yml, schema.json, examples, and the code:
                                         rules.ts (chart-language rules), compute.ts, chart.ts (Vega-Lite spec)
locales/en.yml, nl-BE.yml              every text; other locales fall back to English
tokens/ptditt-grafiektaal-tokens.json  style values; PROVISIONAL until the export from Figma is agreed
src/core/pipeline.ts                   schema -> input checks -> compute -> rules -> draw -> template
src/core/render/                       Vega-Lite to SVG (headless, no external loading) and the template
src/core/conformance.ts                the conformance checks, run by the tests and at start-up
src/app.ts, src/routes/                the REST layer (Fastify); an MCP layer will call the same pipeline
```

Everything smart happens in our code; Vega-Lite only draws what it gets. The axis ticks and labels, which value is
labelled, and how the spread is drawn are computed before Vega-Lite sees anything.

The conformance checks from the analysis run in CI and at start-up; the service does not start when they fail:
attributes and values only from the vocabulary, every applicable attribute filled (`any` explicitly), every pair of
semgraphs disjoint in at least one attribute, valid `askWhen`, and an English base text for every key. Check 3 is
stricter than "differs": `[additive, unique]` and `[unique]` differ, but both fit a unique count, and then the
choice aid cannot end at exactly one semgraph. A test runs checks 1–4 on the first fill of all twelve semgraphs
from the analysis.

## Provisional choices, to confirm

Only the cover page of the Figma file was readable when v0 was built. These choices still need checking against
the pages Anatomy and Line charts, and with the team:

1. Missing points as an outlined area labelled "no data" (the cover says "an outlined area is missing data"), and
   no line between the dots.
2. A strict window (an incomplete window has no point), rather than a hollow dot for an incomplete window.
3. `minimumPoints` counts the values in the horizon + window − 1 days the chart uses; n − 1; a value axis from
   zero; no rule of its own for the horizon.
4. Conformance check 3 sharpened to "disjoint".
5. The form of reading cue, footer and version label ("chart language v0"), still open in Figma.
6. All token values except focus, text, text/muted, surface and badge, which come from Figma.

## Notes for consumers

- An SVG embedded with `<img>` cannot follow its links and does not use the fonts of the page. Inline the SVG, or
  open it directly, to keep the links in the footer working.
- Fonts are referenced by name (Poppins, Nunito, with fallbacks); the final typography is still open.
