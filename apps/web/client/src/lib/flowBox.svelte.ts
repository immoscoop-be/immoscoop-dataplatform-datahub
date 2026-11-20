import type { FlowStepId } from './flowBox.js';

/**
 * The Flow Box open in the app, if one is (DEC-UX-299): there is one at a time (DEC-UX-308), and nothing of it is
 * stored: it lives in the open app only and goes with a reload (DEC-UX-306).
 */
interface Open {
  /** The Resource it guides through describing and publishing. */
  readonly resource: string;
  readonly minimized: boolean;
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
  /** Opens it on a Resource, in place of one open on another (DEC-UX-308). */
  show(resource: string): void {
    open = { resource, minimized: false };
  },
  minimize(minimized: boolean): void {
    if (open) open = { ...open, minimized };
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
