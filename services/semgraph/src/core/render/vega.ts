import * as vega from 'vega';
import { compile, type TopLevelSpec } from 'vega-lite';

// Without node-canvas Vega estimates text widths. Pin that choice, so output never changes
// because a canvas package happens to be installed. (textMetrics is missing from Vega's types.)
(vega as unknown as { textMetrics: { canvas(use: boolean): void } }).textMetrics.canvas(false);

const refuse = () => Promise.reject(new Error('semgraph: Vega may not load external resources'));

/** All data is inline; Vega may not read files or fetch URLs. */
const LOCKED_LOADER = { load: refuse, sanitize: refuse, http: refuse, file: refuse };

export interface VegaOutput {
  svg: string;
  /** Warnings from Vega-Lite and Vega. Tests fail on any; in production they are logged. */
  warnings: string[];
}

/** Draws a Vega-Lite spec headless and returns the SVG. Vega-Lite only draws what it gets. */
export async function renderVegaLite(spec: TopLevelSpec): Promise<VegaOutput> {
  const warnings: string[] = [];
  const logger = collectingLogger(warnings);
  const { spec: vegaSpec } = compile(spec, { logger });
  const view = new vega.View(vega.parse(vegaSpec), {
    renderer: 'none',
    logger,
    loader: LOCKED_LOADER as unknown as vega.Loader,
  });
  try {
    const svg = await view.toSVG();
    return { svg, warnings };
  } finally {
    view.finalize();
  }
}

function collectingLogger(sink: string[]) {
  let level = vega.Warn;
  const logger = {
    level(value?: number) {
      if (value === undefined) return level;
      level = value;
      return logger;
    },
    error(...args: unknown[]) {
      sink.push(`error: ${args.map(String).join(' ')}`);
      return logger;
    },
    warn(...args: unknown[]) {
      sink.push(`warn: ${args.map(String).join(' ')}`);
      return logger;
    },
    info() {
      return logger;
    },
    debug() {
      return logger;
    },
  };
  return logger as unknown as vega.LoggerInterface;
}
