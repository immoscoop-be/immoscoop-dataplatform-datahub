/** What a marker inside an Explained asks of it: a tap on the marker opens its pop-out (Explain on rest). */
export interface ExplainedHost {
  tap: () => void;
}

export const EXPLAINED = Symbol('explained');
