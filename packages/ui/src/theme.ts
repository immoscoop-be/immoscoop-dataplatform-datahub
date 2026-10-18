import { Badge, createTheme, Title, type CSSVariablesResolver, type MantineColorsTuple } from '@mantine/core';

/** The six colours of the Immoscoop brandbook. */
export const brand = {
  /** Primary, with bordeaux: actions and the brand mark. */
  magenta: '#DD2C88',
  /** Primary: titles and highlights. */
  bordeaux: '#640038',
  /** Background, alternating with white. */
  lightPink: '#FEF0F6',
  /** Accent; in the company's own tools it may cover larger areas. */
  teal: '#3CB8B1',
  /** Text. */
  grey: '#2D333A',
  /** Background, alternating with white. */
  lightGrey: '#EEF2F4',
} as const;

// Mantine needs ten shades per colour. They are interpolated in OKLab between the brand colours,
// with each brand colour at the shade Mantine uses by default (6), or at the end of its scale.

/** Light pink → magenta (6) → bordeaux, so hover and pressed states stay within the brand. */
const magenta: MantineColorsTuple = ['#FEF0F6', '#FDD3E3', '#FAB6D0', '#F598BE', '#EF7AAB', '#E7589A', '#DD2C88', '#B31D6C', '#8A0D51', '#640038'];
/** Light pink → bordeaux (6) → darker. */
const bordeaux: MantineColorsTuple = ['#FEF0F6', '#E6C8D3', '#CDA1B2', '#B47B91', '#9A5672', '#803154', '#640038', '#51002E', '#3F0024', '#2E001A'];
const teal: MantineColorsTuple = ['#EEF9F8', '#D4EEEC', '#BAE4E0', '#9FD9D4', '#83CEC8', '#63C3BD', '#3CB8B1', '#2F918C', '#236D68', '#174A47'];
/**
 * Light grey (1) → the text grey (9). Mantine draws borders with shade 4, and dimmed text with
 * shade 6, which keeps a contrast of 4.8:1 on white.
 */
const gray: MantineColorsTuple = ['#F7F9FA', '#EEF2F4', '#E1E6E9', '#D5DBDF', '#C8CFD4', '#99A0A6', '#6C737A', '#565D64', '#41474E', '#2D333A'];

/** Poppins for titles and text; the fallbacks only show while it loads. */
const POPPINS = 'Poppins, system-ui, -apple-system, "Segoe UI", sans-serif';

/** The Mantine theme of Data Hub, from the Immoscoop brandbook (DEC-PF-22, TR-PF-29). */
export const theme = createTheme({
  primaryColor: 'magenta',
  primaryShade: 6,
  colors: { magenta, bordeaux, teal, gray },
  black: brand.grey,
  white: '#FFFFFF',
  fontFamily: POPPINS,
  headings: { fontFamily: POPPINS, fontWeight: '600' },
  defaultRadius: 'md',
  cursorType: 'pointer',
  components: {
    // The brandbook writes text in grey or, for a softer contrast, in bordeaux.
    Title: Title.extend({ defaultProps: { c: 'bordeaux.6' } }),
    // Badges mostly carry names from dbt and BigQuery, which keep their own case.
    Badge: Badge.extend({ defaultProps: { tt: 'none' } }),
  },
});

/**
 * Text links take the darker magenta: the brand magenta itself has a contrast of only 4.4:1 on
 * white, just under the 4.5:1 that running text needs. Buttons keep the brand magenta.
 */
export const cssVariablesResolver: CSSVariablesResolver = () => ({
  variables: {},
  light: { '--mantine-color-anchor': 'var(--mantine-color-magenta-7)' },
  dark: {},
});
