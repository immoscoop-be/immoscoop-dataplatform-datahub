import type { TopLevelSpec } from 'vega-lite';
import type { Translator } from './i18n.ts';
import type { IssueSpec } from './issues.ts';
import type { Tokens } from './tokens.ts';

/** One attribute of the closed vocabulary (vocabulary/attributes.yml). */
export interface Attribute {
  id: string;
  question?: string;
  values: string[];
  source: string[];
  askWhen?: Record<string, string>;
}

/** The values a semgraph fits for one attribute: a list, or an explicit "any". */
export type AttributeValues = string[] | 'any';

export interface SemgraphMetadata {
  id: string;
  title: string;
  answers: string;
  attributes: Record<string, AttributeValues>;
  exampleQuestions: string[];
  doNotUseWhen: { intent: string; use: string }[];
  data: { minimumPoints: number };
  links: { figma: string; learning: string };
}

/** Footer context that every semgraph request may carry. */
export interface RequestContext {
  domain?: string;
  dataset?: string;
  owner?: string;
  reliability?: string;
  definitionUrl?: string;
}

export interface DrawContext {
  t: Translator;
  tokens: Tokens;
  metadata: SemgraphMetadata;
}

/** An invisible area over the plot that shows a label on hover (native SVG title, no script). */
export interface HoverTarget {
  /** Left edge and width, in pixels from the left of the plot area. */
  x: number;
  width: number;
  label: string;
}

/** What a semgraph hands to the template: the Vega-Lite spec plus the texts around it. */
export interface Drawing {
  vegaLite: TopLevelSpec;
  /** Size of the Vega output; autosize is off, so this is exact. */
  width: number;
  height: number;
  /** Where the plot sits inside the Vega output, for overlays such as hover targets. */
  plotArea: { x: number; y: number; width: number; height: number };
  hover: HoverTarget[];
  title: string;
  readingCue: string;
  description: string;
  /** The reference day ("today") for the footer, as a day number. */
  asOf: number;
}

/**
 * The code of one semgraph. Everything smart happens here and in the core; Vega-Lite only draws
 * what `draw` gives it. Requests reach these functions only after they passed the JSON Schema.
 */
export interface SemgraphImplementation<Request, Computed> {
  readonly id: string;
  /** The JSON Schema of the request: the contract, also written to semgraphs/<id>/schema.json. */
  schema(): object;
  /** Input checks the schema cannot express, e.g. existing days and duplicates. */
  check(request: Request): IssueSpec[];
  compute(request: Request, context: { now: Date }): Computed;
  /** The chart-language rules: refusals, tolerated deviations and information. */
  rules(request: Request, computed: Computed, context: { metadata: SemgraphMetadata }): IssueSpec[];
  draw(request: Request, computed: Computed, context: DrawContext): Drawing;
}

/** The registry handles implementations without knowing their request types. */
export type AnySemgraphImplementation = SemgraphImplementation<any, any>;
