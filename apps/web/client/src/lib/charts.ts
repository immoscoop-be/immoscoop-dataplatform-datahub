import type { Theme } from '@datahub/ui/foundations/backgrounds.js';
import type { Language } from '@datahub/ui/foundations/texts.svelte.js';
import type { Config } from './config.js';

/**
 * Charts, the gallery of semgraph (FR-CH-06, DEC-UX-182). The page reads semgraph itself, without Access Token,
 * as any page may (TR-PF-34): what it says of its charts, in the language of the User, and each example as it
 * draws it, in the theme of the page.
 */

/** An example of a chart, as semgraph lists it: the theme or size it sets when it only shows a mode or a size. */
export interface ExampleLink {
  name: string;
  /** The title of its chart, in the language of the example. */
  title: string;
  theme?: string;
  size?: string;
}

/** A chart in the overview of semgraph. */
export interface ListedChart {
  id: string;
  title: string;
  /** The question it answers. */
  answers: string;
}

export interface ChartsOverview {
  charts: ListedChart[];
  /** The charts semgraph only plans, by id. */
  planned: string[];
}

/** One chart, as semgraph describes it. */
export interface Chart extends ListedChart {
  exampleQuestions: string[];
  /** When another chart fits better: why, and which. */
  doNotUseWhen: { intent: string; use: string }[];
  /** How many blocks it needs at least, when semgraph says. */
  minimumPoints: number | null;
  examples: ExampleLink[];
}

/** An example as semgraph drew it: a picture, with its deviations and cautions; refused, with the code of why; or not at all. */
export type Drawing =
  | { readonly kind: 'drawn'; readonly src: string; readonly deviations: readonly string[]; readonly cautions: readonly string[] }
  | { readonly kind: 'refused'; readonly code: string }
  | { readonly kind: 'failed' };

/**
 * The groups of the panel, by the question the charts answer, in the order of the design (DEC-UX-182). A chart
 * semgraph adds is placed in one of them first; a test fails until it is.
 */
export const CHART_GROUPS = [
  {
    id: 'overTime',
    label: 'charts.group.overTime',
    charts: ['movingWindowAverage', 'movingWindowMedian', 'movingWindowRatio', 'calendarAverage', 'calendarMedian', 'calendarRatio'],
  },
  { id: 'comparing', label: 'charts.group.comparing', charts: ['periodComparison', 'categoryComparison'] },
  { id: 'target', label: 'charts.group.target', charts: ['kpiTile', 'kpiStatus'] },
  { id: 'spread', label: 'charts.group.spread', charts: ['distribution'] },
] as const satisfies readonly { id: string; label: string; charts: readonly string[] }[];

export type ChartGroup = (typeof CHART_GROUPS)[number];

/** Charts opens on the first chart of its panel (DEC-UX-182). */
export const FIRST_CHART: string = CHART_GROUPS[0].charts[0];

/** The sentence of each reason semgraph gives not to use a chart; a test fails when it gives one without. */
export const INTENTS: Readonly<Record<string, string>> = {
  compareWithLastYear: 'charts.intent.compareWithLastYear',
  showOneCurrentValue: 'charts.intent.showOneCurrentValue',
  compareCategories: 'charts.intent.compareCategories',
  showMeanPerUnit: 'charts.intent.showMeanPerUnit',
  showTotalSoFar: 'charts.intent.showTotalSoFar',
  compareWithTarget: 'charts.intent.compareWithTarget',
  showEvolution: 'charts.intent.showEvolution',
  showPartsOfWhole: 'charts.intent.showPartsOfWhole',
};

/** The group a chart is in. */
export function groupOf(id: string): ChartGroup | undefined {
  return CHART_GROUPS.find((group) => (group.charts as readonly string[]).includes(id));
}

/** The groups with the charts semgraph offers, in the order of the design; a group without any is left out. */
export function grouped(charts: readonly ListedChart[]): { group: ChartGroup; charts: ListedChart[] }[] {
  return CHART_GROUPS.map((group) => ({
    group,
    charts: group.charts.flatMap((id) => charts.filter((chart) => chart.id === id)),
  })).filter((entry) => entry.charts.length > 0);
}

/** The examples Charts lists: not those that only show a theme or a size, as every example is drawn in the theme of the page. */
export function shownExamples(examples: readonly ExampleLink[]): ExampleLink[] {
  return examples.filter((example) => example.theme === undefined && example.size === undefined);
}

/** An example by its name, as a name: "long-horizon" is "Long horizon". */
export function exampleLabel(name: string): string {
  const words = name.replaceAll('-', ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** The locale of semgraph for the language of the User. */
function localeOf(language: Language): string {
  return language === 'nl' ? 'nl-BE' : 'en';
}

export class ChartMissing extends Error {
  constructor(id: string) {
    super(`semgraph offers no chart ${id}`);
  }
}

export interface Charts {
  overview(language: Language): Promise<ChartsOverview>;
  /** One chart; ChartMissing when semgraph does not offer it. */
  chart(id: string, language: Language): Promise<Chart>;
  /** An example as semgraph draws it in the theme of the page; never throws. */
  draw(id: string, example: string, theme: Theme): Promise<Drawing>;
  /** Where the icon of a chart is, a picture in currentColor (REQ-060 of semgraph). */
  iconUrl(id: string): string;
}

export function createCharts(config: Pick<Config, 'semgraphUrl'>, request: typeof fetch = (input, init) => fetch(input, init)): Charts {
  const at = (path: string) => new URL(path, config.semgraphUrl).href;
  const read = async (path: string): Promise<Response> => {
    const response = await request(at(path));
    if (!response.ok && response.status !== 404) {
      throw new Error(`semgraph answered ${response.status} to GET ${path}`);
    }
    return response;
  };
  return {
    async overview(language) {
      const response = await read(`/semgraphs?locale=${localeOf(language)}`);
      const body = (await response.json()) as { semgraphs: ListedChart[]; planned?: string[] };
      return {
        charts: body.semgraphs.map(({ id, title, answers }) => ({ id, title, answers })),
        planned: body.planned ?? [],
      };
    },
    async chart(id, language) {
      const response = await read(`/semgraphs/${encodeURIComponent(id)}?locale=${localeOf(language)}`);
      if (response.status === 404) {
        throw new ChartMissing(id);
      }
      const body = (await response.json()) as Omit<Chart, 'minimumPoints'> & { data?: { minimumPoints?: number } };
      return {
        id: body.id,
        title: body.title,
        answers: body.answers,
        exampleQuestions: body.exampleQuestions ?? [],
        doNotUseWhen: body.doNotUseWhen ?? [],
        minimumPoints: body.data?.minimumPoints ?? null,
        examples: (body.examples ?? []).map(({ name, title, theme, size }) => ({ name, title, ...(theme ? { theme } : {}), ...(size ? { size } : {}) })),
      };
    },
    async draw(id, example, theme) {
      try {
        const response = await request(at(`/semgraphs/${encodeURIComponent(id)}/examples/${encodeURIComponent(example)}?theme=${theme}`));
        if (response.status === 422) {
          const body = (await response.json()) as { issues?: { level: string; code: string }[] };
          const reason = body.issues?.find((issue) => issue.level === 'refusal') ?? body.issues?.[0];
          return { kind: 'refused', code: reason?.code ?? '' };
        }
        if (!response.ok) {
          console.error(`semgraph did not draw ${id}/${example}: ${response.status}`);
          return { kind: 'failed' };
        }
        const codes = (header: string) => (response.headers.get(header) ?? '').split(',').map((code) => code.trim()).filter(Boolean);
        // A picture: nothing of semgraph runs in the page.
        return {
          kind: 'drawn',
          src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(await response.text())}`,
          deviations: codes('semgraph-deviations'),
          cautions: codes('semgraph-cautions'),
        };
      } catch (error) {
        console.error('semgraph did not answer', error);
        return { kind: 'failed' };
      }
    },
    iconUrl: (id) => at(`/semgraphs/${encodeURIComponent(id)}/icon`),
  };
}
