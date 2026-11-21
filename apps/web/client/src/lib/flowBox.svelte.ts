import type { FlowStepId } from './flowBox.js';

/**
 * The flows of the Flow Box (DEC-UX-299): describing and publishing a Resource (FR-MR-20), and setting up the EDA of a
 * Resource (DEC-UX-327, FR-ED-14). Both are about a Resource.
 */
export type FlowKind = 'publish' | 'eda';

/**
 * The Flow Box open in the app, if one is (DEC-UX-299): which flow, of which object, and whether it is minimized. There
 * is one at a time (DEC-UX-308), and nothing of it is stored: it lives in the open app only and goes with a reload
 * (DEC-UX-306, TR-ED-09).
 */
interface Open {
  readonly flow: FlowKind;
  /** The Resource it guides through its flow. */
  readonly resource: string;
  /** Minimized, as the User left it. */
  readonly minimized: boolean;
  /**
   * The guide of an EDA shows folded to its strip on the tab Steps of its EDA, as that page shows the same, until the
   * User opens it there (DEC-UX-327); elsewhere it shows as the User left it.
   */
  readonly foldsOnSteps: boolean;
}

/** A step the Flow Box led to: the page opens its place for editing, its field in focus and marked (DEC-UX-303). */
interface Aim {
  readonly resource: string;
  readonly step: FlowStepId;
}

let open: Open | null = $state(null);
let aim: Aim | null = $state(null);

export const flowBox = {
  get open(): Open | null {
    return open;
  },
  get aim(): Aim | null {
    return aim;
  },
  /**
   * Opens a flow on a Resource, in place of the one open (DEC-UX-308): publishing by default. The guide of an EDA opened
   * by starting it folds on the tab Steps of its EDA; opened by Guide me, it shows open there too.
   */
  show(resource: string, flow: FlowKind = 'publish', { foldsOnSteps = false }: { foldsOnSteps?: boolean } = {}): void {
    open ={ flow, resource, minimized: false, foldsOnSteps: flow === 'eda' && foldsOnSteps };
  },
  /** Minimizes or maximizes it; maximized on the tab Steps of its EDA, it stays open there from then on. */
  minimize(minimized: boolean, onSteps = false): void {
    if (open) open = { ...open, minimized, foldsOnSteps: open.foldsOnSteps && (minimized || !onSteps) };
  },
  /** Whether it shows as its strip: as the User left it, and folded on the tab Steps of its EDA until opened there. */
  folded(onSteps = false): boolean {
    return open !== null && (open.minimized || (onSteps && open.foldsOnSteps));
  },
  close(): void {
    open = null;
    aim = null;
  },
  /** Leads the page of a Resource to the place of a step. */
  aimAt(resource: string, step: FlowStepId): void {
    aim = { resource, step };
  },
  /** The step the page of this Resource is led to, among those it holds, taken once. */
  take<S extends FlowStepId>(resource: string, steps: readonly S[]): S | null {
    const now = aim;
    if (!now || now.resource !== resource || !(steps as readonly FlowStepId[]).includes(now.step)) return null;
    aim = null;
    return now.step as S;
  },
};

/** Marks a place the Flow Box led to for a moment, as its field takes the focus (DEC-UX-303). */
export function markPlace(element: Element | null | undefined): void {
  if (!element) return;
  element.classList.remove('flow-marked');
  void (element as HTMLElement).offsetWidth;
  element.classList.add('flow-marked');
  element.addEventListener('animationend', () => element.classList.remove('flow-marked'), { once: true });
}
