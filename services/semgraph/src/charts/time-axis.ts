import { color, type Tokens } from '../core/tokens.ts';

/** A label under the time axis, in the middle of its block; a second line names the year. */
export interface AxisLabel {
  rel: number;
  lines: string[];
}

const TICK_LENGTH = 6;
/** A year change pokes a little into the plot and reaches further down. */
const YEAR_TICK = { above: 4, below: 8 };
const LABEL_TOP = 10;
const LABEL_LINE = 12;
/** Room the time axis needs under the plot: ticks and two lines of labels. */
export const AXIS_HEIGHT = LABEL_TOP + 2 * LABEL_LINE + 2;
/** Narrower blocks have no boundaries of their own: their ticks sit under the labels. */
const MIN_BLOCK_WIDTH = 12;

interface AxisInput {
  /** Number of blocks; block `rel` runs from rel − 0.5 to rel + 0.5, the last one is 0. */
  count: number;
  slotWidth: number;
  labels: AxisLabel[];
  /** Blocks that start a new year on a calendar axis. */
  yearStarts: number[];
  /** The x encoding of the chart, so the axis uses the same scale. */
  x: object;
  plotHeight: number;
  tokens: Tokens;
}

/**
 * The time axis as Figma draws it: every point is a block of time, not a moment, so the ticks mark
 * the boundaries between blocks and each label sits in the middle of its block (REQ-029). The year
 * is named on a second line, on the first label and at every year change, and a year change gets a
 * longer, darker tick (REQ-000). Vega-Lite draws the baseline; these layers draw the rest.
 */
export function timeAxis({ count, slotWidth, labels, yearStarts, x, plotHeight, tokens }: AxisInput) {
  const first = -(count - 1);
  const yearBoundaries = new Set(yearStarts.filter((rel) => rel > first).map((rel) => rel - 0.5));
  const positions = slotWidth >= MIN_BLOCK_WIDTH
    ? Array.from({ length: count + 1 }, (_, index) => first - 0.5 + index)
    : labels.map((label) => label.rel);
  const datasets = {
    axisTicks: positions.filter((rel) => !yearBoundaries.has(rel)).map((rel) => ({ rel })),
    axisYearTicks: [...yearBoundaries].map((rel) => ({ rel })),
    axisLabels: labels,
  };
  const layers = [
    {
      data: { name: 'axisTicks' },
      mark: { type: 'rule', color: color(tokens, 'axis'), strokeWidth: tokens.stroke.axis },
      encoding: { x, y: { value: plotHeight }, y2: { value: plotHeight + TICK_LENGTH } },
    },
    {
      data: { name: 'axisYearTicks' },
      mark: { type: 'rule', color: color(tokens, 'baseline'), strokeWidth: tokens.stroke.axis },
      encoding: { x, y: { value: plotHeight - YEAR_TICK.above }, y2: { value: plotHeight + YEAR_TICK.below } },
    },
    {
      data: { name: 'axisLabels' },
      mark: {
        type: 'text',
        align: 'center',
        baseline: 'top',
        fontSize: tokens.size.axisLabel,
        lineHeight: LABEL_LINE,
        color: color(tokens, 'text/muted'),
      },
      encoding: { x, y: { value: plotHeight + LABEL_TOP }, text: { field: 'lines' } },
    },
  ];
  return { datasets, layers };
}
