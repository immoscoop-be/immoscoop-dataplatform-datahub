// jsdom lays out nothing. What the canvas of the Lineage (Svelte Flow) and the SQL editor (CodeMirror) ask
// of a real browser is answered here with nothing: no size changes, no transform, no rectangles of text.

class NoResize {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

class NoTransform {
  readonly m22 = 1;
}

globalThis.ResizeObserver ??= NoResize as unknown as typeof ResizeObserver;
globalThis.DOMMatrixReadOnly ??= NoTransform as unknown as typeof DOMMatrixReadOnly;
const range = Range.prototype as Partial<Range>;
range.getClientRects ??= () => [] as unknown as DOMRectList;
