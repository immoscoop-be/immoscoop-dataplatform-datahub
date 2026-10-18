import type { ReactNode } from 'react';

/** A line icon on a 24-pixel grid, in the colour of the text around it. */
function Icon({ size = 18, children }: { size?: number; children: ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}

export const SearchIcon = ({ size }: { size?: number }) => (
  <Icon size={size}>
    <circle cx="10.5" cy="10.5" r="6.5" />
    <path d="m20 20-4.8-4.8" />
  </Icon>
);

export const BackIcon = ({ size }: { size?: number }) => (
  <Icon size={size}>
    <path d="M19 12H5" />
    <path d="m11 18-6-6 6-6" />
  </Icon>
);

export const SignOutIcon = ({ size }: { size?: number }) => (
  <Icon size={size}>
    <path d="M14 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-2" />
    <path d="M9 12h11" />
    <path d="m17 9 3 3-3 3" />
  </Icon>
);
