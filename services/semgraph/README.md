# immoscoop-ptditt-semgraph

Semantic chart service: renders charts by meaning (e.g. `movingWindowAverage`), not form, following the Immoscoop
chart language. The rules live in the service: the caller sends raw values, and the service computes, validates
and draws, with title, reading cue and footer.

- Analysis (functional and technical): [ptditt - Tooling - Grafiekserver](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1352106324)
- Chart language, the source of truth for every visual rule: [Figma, file grafiektaal](https://www.figma.com/design/X9FMecd5iH6jIced8nZQf6)

## Status: v0

Four semgraphs on a time axis of daily data, end to end as SVG over REST, in English and Dutch (nl-BE), packaged
as one Docker image:

| Semgraph | Per slot | Drawn as |
| --- | --- | --- |
| `movingWindowAverage` | per day, the mean of the window ending on it | dot over a thin bar, ±1 sd |
| `movingWindowMedian` | per day, the median of the window ending on it | dot in a wide bar, P25–P75 |
| `calendarAverage` | per ISO week, month, quarter or year, the mean of its days | dot over a thin bar, ±1 sd |
| `calendarMedian` | per ISO week, month, quarter or year, the median of its days | dot in a wide bar, P25–P75 |

MCP, PNG, the interactive HTML page, the widget, the choice aid (`/choose`) and the other semgraphs come later, on
the same core.

![movingWindowAverage example](test/golden/movingWindowAverage-basic.svg)
![calendarAverage per week, with the running week hollow](test/golden/calendarAverage-weeks.svg)

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
  "message": "For unique counts you have to choose: uniques counted per day, or uniques over the whole period. Those are two different metrics.",
  "alternative": "Add uniqueAggregation daily when the values are daily uniques. …",
  "learnMore": "https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1354629146"
}
```

SVG responses also carry `Semgraph-Language-Version` and `Semgraph-Tokens-Version`, `nosniff` and a strict
Content-Security-Policy.

## The contract

All four share one contract, composed by their classes and written to `semgraphs/<id>/schema.json`
(`npm run schemas`; a test fails when a file is out of date). The request from the analysis, plus `measureType`
(required until Domain Hub or the dbt YAML supplies it):

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

| Field | Moving window | Calendar |
| --- | --- | --- |
| `window` | days per window, 2–364 (multiples of 7) | – |
| `unit` | – | `week` (ISO, Monday–Sunday), `month`, `quarter`, `year` |
| `horizon` | days on the axis, 2–728 | periods on the axis, 2–120 |
| `spread` | average: `stddev` or `none`; median: `iqr` or `none` | same |

Shared and optional: `title`; `uniqueAggregation` (`daily` or `overPeriod`, required for unique counts);
`valueAxis` (`zero`, the default, or `zoom`); `context` for the footer (`domain`, `dataset`, `owner`,
`reliability`, `definitionUrl`); `locale`; `format` (`svg`). `data` holds at most 4000 days. Unknown fields are
rejected, so a typo never silently becomes a default and no extra columns (such as personal data) get in. See for
example [`semgraphs/calendarMedian/schema.json`](semgraphs/calendarMedian/schema.json).

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
   tick of a moving window reads "today" when that is yesterday, and the date otherwise.
2. Slots: a moving window has one slot per day, summarizing the `window` days that end on it. A calendar chart has
   one slot per period, ending with the period of the last complete day. While that period is not over, it is
   **running**: its value covers the days so far, the dot is hollow, and the label says "running" (on hover:
   "running: 3 of 7 days").
3. Statistics, the same for both families: the mean with the sample standard deviation (n − 1, as `STDDEV` in
   BigQuery), or the median with P25–P75 (linear interpolation, as `PERCENTILE_CONT`). Tests compare with
   BigQuery's output, also per ISO week. A slot with a missing day has no point: one missing day leaves a gap of
   `window` points in a moving window, and removes its whole period in a calendar chart.
4. Rules: refusal for a measure type the metadata does not allow, unique counts without `uniqueAggregation`,
   uniques over the period, fewer than `minimumPoints` values in the days the chart uses, or no complete slot at
   all. Tolerated deviation for a window that is not a multiple of 7, or a mean or median without its spread.
5. Drawing: the centre as a dot, filled when final and hollow while running; a thin bar for ±1 sd or a wide
   rounded bar for P25–P75, in the light tint of the focus colour; missing stretches as an outlined area labelled
   "no data"; the last value (bold) with its spread (detail); both axes labelled; a darker, thicker baseline.
6. Value axis: from zero by default. With `"valueAxis": "zoom"` it starts at a round value just below the data,
   which the chart language allows for positions such as averages and medians; the baseline then starts with a
   short zigzag and the first axis value is bold. When the round start is zero anyway, it stays at zero.
7. The footer: domain › dataset · owner; reliability · as-of date · definition; "How do I read this chart?".
   Missing context is printed as unknown: absence is never polished away.
8. Hover, without script: every day has an invisible area with a native SVG `<title>` and a grey dotted guide line
   (a guide, not data) that appears on hover. The label says what the day shows, e.g.
   `23 sep (−7d) · 43,7 ± 12,2 · venster 17–23 sep`, or why it has no value:
   `17 Sep (−13d) · no data: 15 Sep is missing · window 11–17 Sep`. This works when the SVG is opened directly or inlined in a page,
   not inside `<img>`, Slack or e-mail; richer interaction belongs to the interactive page and the widget.
9. Many values: while each slot has room for its bar plus some air (8 pixels for a mean, 13 for a median's wide
   bar), each slot is a dot with its bar. Beyond that the dots would overlap, so the mean becomes a line and the spread a band around it, in the same
   colours (the learning material: spread "as a band around a line or as a line around a point"). Lines and bands
   never bridge a gap, a lone slot between two gaps keeps its dot, and a running period keeps its hollow dot and
   bar. A moving window keeps at most eight labels, in multiples of the window (7, 14, 28, 91, … days); a calendar
   chart labels every period that fits ("W40", "sep", "K3 2026", "2026"), naming the year at the start and where
   it changes. See `examples/long-horizon.json` (182 days).

## How it is built

The charts are classes, so nothing is written twice:

```text
TimeAxisChart (src/charts/time-axis-chart.ts)    contract, reference day, strict slots, rules, value axis
├── MovingWindowChart                             slots per day over a rolling window, relative axis
│   ├── MovingWindowAverage   ── uses Average
│   └── MovingWindowMedian    ── uses Median
└── CalendarChart                                 slots per ISO week, month, quarter or year, running period
    ├── CalendarAverage       ── uses Average
    └── CalendarMedian        ── uses Median

Statistic (src/charts/statistics.ts)              centre, spread, bar width, labels
├── Average                                       mean, ±1 sd (n − 1), thin bar
└── Median                                        median, P25–P75, wide bar
```

The statistic is its own hierarchy, used by both families: with single inheritance alone, the mean and median code
would have to be written once per family. A family decides which days a slot summarizes and how slots are
labelled; the statistic decides centre and spread; the base class does the rest, including the Vega-Lite spec.
A new semgraph on a time axis is a class of a few lines, plus its `metadata.yml` and texts.

```text
vocabulary/attributes.yml              closed vocabulary of the 9 attributes
semgraphs/catalog.yml                  all semgraphs of the catalogue: available or planned
semgraphs/<id>/                        index.ts (the class), metadata.yml, schema.json (generated), examples
src/charts/                            the chart classes, statistics, calendar periods and scales
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
choice aid cannot end at exactly one semgraph. Two attributes were added so the new semgraphs stay
distinguishable: `periodType` (rolling or calendar, asked when the time axis is calendar) and `centralTendency`
(mean or median). A test runs checks 1–4 on the first fill of the analysis, with these attributes and the new
semgraphs: fifteen in all.

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
7. The switch from dots to a line with a band, and the dotted hover guide.
8. The two new attributes `periodType` and `centralTendency`, and their values for the semgraphs of the analysis
   (`any` where they do not matter); see `test/fixtures/analysis-attributes.yml`.
9. Calendar periods are strict too: a week, month, quarter or year with a missing day has no point. A running
   period is hollow and covers the days so far; ISO weeks run from Monday to Sunday.
10. The zoomed axis (zigzag and bold first value), and `uniqueAggregation` values `daily` and `overPeriod`.

## Notes for consumers

- An SVG embedded with `<img>` cannot follow its links and does not use the fonts of the page. Inline the SVG, or
  open it directly, to keep the links in the footer working.
- Fonts are referenced by name (Poppins, Nunito, with fallbacks); the final typography is still open.
