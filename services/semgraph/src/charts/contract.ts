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
  description: 'Kind of number: additive or unique for an average per day of a count, ratio for a mean or median of observations such as an amount per lead. Required until Domain Hub or the dbt YAML supplies it.',
  enum: ['additive', 'unique', 'ratio'],
};

export const UNIQUE_AGGREGATION = {
  description: 'Required for unique counts: daily (the uniques per day; never summed) or overPeriod (the uniques over the whole block, counted in the warehouse; only as a total).',
  enum: ['daily', 'overPeriod'],
};

export const DAY = { type: 'string', pattern: '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' };

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
