import { SIZE_NAMES } from '../core/size.ts';

/**
 * The fields every contract shares, written once (REQ-025). Each family adds its own: the periods of
 * a time axis, the categories of a bar chart, the bins of a distribution.
 */
export const METRIC = {
  description: 'Identifier of the metric, e.g. creditLeads. Used as title when no title is given.',
  type: 'string',
  pattern: '^[A-Za-z][A-Za-z0-9_]{0,63}$',
};

export const TITLE = {
  description: 'Title above the chart. States what is shown, not a conclusion.',
  type: 'string',
  minLength: 1,
  maxLength: 120,
};

export const MEASURE_TYPE = {
  description: 'Kind of number: additive or unique for a count; perUnit for a mean or median per unit where the spread between the units is the question, such as an amount per lead (REQ-070, REQ-074); ratio for a numerator divided by a denominator, only in movingWindowRatio and calendarRatio (REQ-074, REQ-076). Required until Domain Hub or the dbt YAML supplies it.',
  enum: ['additive', 'unique', 'perUnit', 'ratio'],
};

export const UNIQUE_AGGREGATION = {
  description: 'Required for unique counts: daily (the uniques per day; never summed) or overPeriod (the uniques over the whole block, counted in the warehouse; only as a total).',
  enum: ['daily', 'overPeriod'],
};

export const DAY = { type: 'string', pattern: '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' };

export const SIZE = {
  description: 'The size of the chart (REQ-085): card (360 px wide, next to a KPI tile), default (640 px), large (1280 px, a 16:9 slide) or xl (1920 px, a big screen or print). Only the width is chosen; the height follows from the content. The chart is built anew in every size, so everything written on it fits.',
  enum: [...SIZE_NAMES],
  default: 'default',
};

export const FORMAT = {
  description: 'Output format. Only svg is available in v0.',
  enum: ['svg', 'png', 'html', 'widget'],
  default: 'svg',
};

export const LOCALE = {
  description: 'Language of titles, labels and messages, e.g. en or nl-BE. Unknown locales fall back to English.',
  type: 'string',
  pattern: '^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$',
};

export const CONTEXT = {
  description: 'Provenance and status for the footer. Missing values are shown as unknown.',
  type: 'object',
  additionalProperties: false,
  properties: {
    domain: { type: 'string', minLength: 1, maxLength: 80 },
    dataset: { type: 'string', minLength: 1, maxLength: 80 },
    owner: { type: 'string', minLength: 1, maxLength: 80 },
    reliability: { type: 'string', minLength: 1, maxLength: 80 },
    definitionUrl: { type: 'string', minLength: 1, maxLength: 500 },
  },
};
