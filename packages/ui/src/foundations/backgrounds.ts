// The backgrounds of Data Hub, a set per theme, which the sign-in picks from too (DEC-UX-109,
// DEC-UX-173). The pictures are those of the design, in docs/design/backgrounds: the build takes them
// from there, so each lives once.

export type Theme = 'light' | 'dark';

/**
 * - `gradient`: the soft clouds by day, the slow gradient by night (DEC-UX-78), in CSS
 * - `picture`: a painted picture, or a photo shown as it is (DEC-UX-34, DEC-UX-110)
 * - `flow`: the flowing gradient, drawn with WebGL (DEC-UX-80)
 * - `lights`: the flowing lights, drawn with WebGL (DEC-UX-109)
 * - `painted`: painted shapes, many kinds of shapes and colours, drawn with WebGL (DEC-UX-198)
 */
export type BackgroundKind = 'gradient' | 'picture' | 'flow' | 'lights' | 'painted';

export interface Background {
  /** What the settings of the User keep (DEC-UX-108). */
  readonly id: string;
  readonly kind: BackgroundKind;
  readonly themes: readonly Theme[];
  /** The name of a picture or a light, never translated; the gradients are named in the translation files. */
  readonly name?: string;
  /** The address of the picture. */
  readonly picture?: string;
  /** A photo shown as it is covers the window, rather than drifting over it (DEC-UX-110). */
  readonly cover?: boolean;
  /** Where the small picture on My page looks, when not in the middle. */
  readonly previewPosition?: string;
}

// Each address is written out, so that the build finds the picture and takes it along.
const CONCRETE = new URL('../../../../docs/design/backgrounds/painted/light/concrete.jpg', import.meta.url).href;

/** Every background, in the order My page offers them: the gradient, the flowing ones, then the pictures. */
export const BACKGROUNDS: readonly Background[] = [
  { id: 'gradient', kind: 'gradient', themes: ['light', 'dark'] },
  { id: 'flow', kind: 'flow', themes: ['light', 'dark'] },
  { id: 'periwinkle', kind: 'lights', themes: ['light'], name: 'Periwinkle' },
  { id: 'sunrise', kind: 'lights', themes: ['light'], name: 'Sunrise' },
  { id: 'apricot', kind: 'lights', themes: ['light'], name: 'Apricot' },
  { id: 'blush', kind: 'lights', themes: ['light'], name: 'Blush' },
  { id: 'sky', kind: 'lights', themes: ['light'], name: 'Sky' },
  { id: 'iris', kind: 'painted', themes: ['light'], name: 'Iris' },
  { id: 'aurora', kind: 'lights', themes: ['dark'], name: 'Aurora' },
  { id: 'ember', kind: 'lights', themes: ['dark'], name: 'Embers' },
  { id: 'dusk', kind: 'lights', themes: ['dark'], name: 'Dusk' },
  { id: 'horizon', kind: 'lights', themes: ['dark'], name: 'Horizon' },
  { id: 'concrete', kind: 'picture', themes: ['light'], name: 'Concrete', picture: CONCRETE, cover: true },
];

/** The choice that picks a background at random: the default (DEC-UX-108). */
export const RANDOM = 'random';

export function backgroundsOf(theme: Theme): readonly Background[] {
  return BACKGROUNDS.filter((background) => background.themes.includes(theme));
}

/**
 * The background of a theme: the one the User chose for it, or one of its set at random when they
 * chose Random or nothing, or chose one that is not in the set (any more).
 */
export function chooseBackground(theme: Theme, choice: string | undefined, random: () => number = Math.random): Background {
  const set = backgroundsOf(theme);
  const chosen = choice && choice !== RANDOM ? set.find((background) => background.id === choice) : undefined;
  return chosen ?? (set[Math.floor(random() * set.length)] as Background);
}
