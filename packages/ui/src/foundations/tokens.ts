/**
 * A value of docs/design/tokens.css, read where JavaScript needs one, such as the narrowest window:
 * never written again as a number in the code (DEC-PF-28).
 */
export function token(name: `--${string}`, element: Element = document.documentElement): string {
  return getComputedStyle(element).getPropertyValue(name).trim();
}

/** A token in pixels, such as `900px`, as a number. */
export function tokenPixels(name: `--${string}`, element?: Element): number {
  const value = token(name, element);
  if (!/^-?\d+(\.\d+)?px$/.test(value)) {
    throw new Error(`${name} is not in pixels: "${value}"`);
  }
  return Number.parseFloat(value);
}
