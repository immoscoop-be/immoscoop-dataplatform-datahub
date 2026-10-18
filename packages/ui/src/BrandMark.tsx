import { brand } from './theme.js';

export interface BrandMarkProps {
  /** Width and height in pixels. */
  size?: number;
}

/** The mark of Data Hub: two overlapping circles, the basic shape of the Immoscoop brand. */
export function BrandMark({ size = 28 }: BrandMarkProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <circle cx="12" cy="16" r="9" fill={brand.magenta} />
      <circle cx="20" cy="16" r="9" fill="none" stroke={brand.bordeaux} strokeWidth="2.5" />
    </svg>
  );
}
