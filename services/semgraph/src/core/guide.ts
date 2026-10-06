/**
 * How a program or an agent uses the service. The OpenAPI description (REQ-084) and the instructions of the
 * MCP server (REQ-090) say the same, each with its own calls: the shared sentences live here once.
 */

export const SERVICE_SUMMARY =
  'semgraph draws a chart by what it means (a rolling average, a comparison between categories, a KPI against its target), not by its form. Each chart is a *semgraph* with its own contract; the service checks a request against the chart language and draws it as SVG, or refuses it when the chart would mislead.';

export const WAREHOUSE_STEP =
  'Compute the blocks in the warehouse: one row per window, calendar period, category or bin, with the fields of its statistic (`mean` with `sd` and `n`; `median` with `p25`, `p75` and `n`; `sum`; `numerator` and `denominator` for a ratio). The service never computes over days; it only checks and draws (REQ-058).';

export const EMPTY_IS_NOT_ZERO =
  '**Empty is not zero.** A block with `null`, or left out, has no data and is drawn as empty; `0` is a measured zero.';
