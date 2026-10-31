// The backgrounds of Data Hub and the photos of the sign-in, a set per theme (DEC-UX-36,
// DEC-UX-109). The pictures are those of the design, in docs/design/backgrounds: the build takes them
// from there, so each lives once.

export type Theme = 'light' | 'dark';

/**
 * - `gradient`: the soft clouds by day, the slow gradient by night (DEC-UX-78), in CSS
 * - `picture`: a painted picture, or a photo shown as it is (DEC-UX-34, DEC-UX-110), in which the wind
 *   can play (DEC-UX-153)
 * - `flow`: the flowing gradient, drawn with WebGL (DEC-UX-80)
 * - `lights`: the flowing lights, drawn with WebGL (DEC-UX-109)
 */
export type BackgroundKind = 'gradient' | 'picture' | 'flow' | 'lights';

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
  /** A photo in which the wind plays: mist drifts over its sky and snow blows over its ground (DEC-UX-153). */
  readonly wind?: Wind;
}

/**
 * Where the wind plays in a photo, each as a fraction of its height. The window shows the part of
 * `span`, from the height of `focus`, whole: a photo taller than the window stands in the middle, its
 * sides fading into a blur of itself. Mist drifts over it down to `sky`, and snow blows over it from
 * `ground` down.
 */
export interface Wind {
  /** Its width divided by its height. */
  readonly ratio: number;
  readonly span: number;
  readonly focus: number;
  readonly sky: number;
  readonly ground: number;
}

/** The pictures of the wind: two veils of mist and the low veils of blown snow; the flakes are drawn. */
export const WIND_LAYERS = {
  mistFar: new URL('../../../../docs/design/backgrounds/wind/mist-far.webp', import.meta.url).href,
  mistNear: new URL('../../../../docs/design/backgrounds/wind/mist-near.webp', import.meta.url).href,
  drift: new URL('../../../../docs/design/backgrounds/wind/drift.webp', import.meta.url).href,
} as const;

// Each address is written out, so that the build finds the picture and takes it along.
const PAINTED = {
  ski: new URL('../../../../docs/design/backgrounds/painted/light/ski-lift.jpg', import.meta.url).href,
  alpenglow: new URL('../../../../docs/design/backgrounds/painted/light/alpenglow.jpg', import.meta.url).href,
  spring: new URL('../../../../docs/design/backgrounds/painted/light/spring-snow.jpg', import.meta.url).href,
  fusilli: new URL('../../../../docs/design/backgrounds/painted/light/fusilli.jpg', import.meta.url).href,
  piste: new URL('../../../../docs/design/backgrounds/painted/light/piste.jpg', import.meta.url).href,
  concrete: new URL('../../../../docs/design/backgrounds/painted/light/concrete.jpg', import.meta.url).href,
  village: new URL('../../../../docs/design/backgrounds/painted/dark/village-lights.jpg', import.meta.url).href,
};
const PHOTO = {
  alpenglow: new URL('../../../../docs/design/backgrounds/photos/light/alpenglow.jpg', import.meta.url).href,
  spring: new URL('../../../../docs/design/backgrounds/photos/light/spring-snow.jpg', import.meta.url).href,
  village: new URL('../../../../docs/design/backgrounds/photos/dark/village-lights.jpg', import.meta.url).href,
  spindrift: new URL('../../../../docs/design/backgrounds/photos/light/spindrift.jpg', import.meta.url).href,
};

/** Every background, in the order My page offers them: the gradient, the flowing ones, then the pictures. */
export const BACKGROUNDS: readonly Background[] = [
  { id: 'gradient', kind: 'gradient', themes: ['light', 'dark'] },
  { id: 'flow', kind: 'flow', themes: ['light', 'dark'] },
  { id: 'periwinkle', kind: 'lights', themes: ['light'], name: 'Periwinkle' },
  { id: 'sunrise', kind: 'lights', themes: ['light'], name: 'Sunrise' },
  { id: 'apricot', kind: 'lights', themes: ['light'], name: 'Apricot' },
  { id: 'blush', kind: 'lights', themes: ['light'], name: 'Blush' },
  { id: 'sky', kind: 'lights', themes: ['light'], name: 'Sky' },
  { id: 'aurora', kind: 'lights', themes: ['dark'], name: 'Aurora' },
  { id: 'ember', kind: 'lights', themes: ['dark'], name: 'Embers' },
  { id: 'dusk', kind: 'lights', themes: ['dark'], name: 'Dusk' },
  { id: 'horizon', kind: 'lights', themes: ['dark'], name: 'Horizon' },
  { id: 'ski', kind: 'picture', themes: ['light'], name: 'Ski lift', picture: PAINTED.ski },
  { id: 'alpenglow', kind: 'picture', themes: ['light'], name: 'Alpenglow', picture: PAINTED.alpenglow },
  { id: 'spring', kind: 'picture', themes: ['light'], name: 'Spring snow', picture: PAINTED.spring },
  { id: 'fusilli', kind: 'picture', themes: ['light'], name: 'Fusilli', picture: PAINTED.fusilli, cover: true },
  { id: 'piste', kind: 'picture', themes: ['light'], name: 'Fresh piste', picture: PAINTED.piste, cover: true, previewPosition: '50% 35%' },
  { id: 'concrete', kind: 'picture', themes: ['light'], name: 'Concrete', picture: PAINTED.concrete, cover: true },
  {
    id: 'spindrift',
    kind: 'picture',
    themes: ['light'],
    name: 'Spindrift',
    picture: PHOTO.spindrift,
    cover: true,
    previewPosition: '50% 45%',
    wind: { ratio: 3 / 4, span: 0.8, focus: 0.6, sky: 0.27, ground: 0.66 },
  },
  { id: 'village', kind: 'picture', themes: ['dark'], name: 'Lights on', picture: PAINTED.village },
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

/** A photo of the sign-in, as it is, placed on its focus point (DEC-UX-35, DEC-UX-36). */
export interface Photo {
  readonly id: string;
  readonly theme: Theme;
  readonly picture: string;
  readonly position: string;
}

/** The photos of the sign-in: Alpenglow and Spring snow by day, Lights on by night. Their stories are in the translation files. */
export const PHOTOS: readonly Photo[] = [
  { id: 'alpenglow', theme: 'light', picture: PHOTO.alpenglow, position: '50% 82%' },
  { id: 'spring', theme: 'light', picture: PHOTO.spring, position: '30% 22%' },
  { id: 'village', theme: 'dark', picture: PHOTO.village, position: '50% 40%' },
];

/** A photo of the set of the theme, picked at random, as the backgrounds are (DEC-UX-94). */
export function choosePhoto(theme: Theme, random: () => number = Math.random): Photo {
  const set = PHOTOS.filter((candidate) => candidate.theme === theme);
  return set[Math.floor(random() * set.length)] as Photo;
}
