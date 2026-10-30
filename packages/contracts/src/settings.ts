import { z } from 'zod';

/** The name of a background of the set, or `random`, the default (DEC-UX-108). */
const background = z.string().regex(/^[a-z][a-z-]{0,39}$/);

/**
 * The settings of a User, kept in Data Hub as keys and values (DEC-UX-96), so that they follow the
 * User to another device and Data Hub knows the language to write to them in. A setting that is not
 * set has its default, which whoever reads it knows: Dutch, the theme of the system, a random
 * background, the panel open.
 */
export const USER_SETTINGS = {
  /** The language of the sentences of Data Hub (NFR-LOC-06); names stay English. */
  language: z.enum(['nl', 'en']),
  /** Light or dark, once the User switched it; before that, the theme of the system. */
  theme: z.enum(['light', 'dark']),
  /** The background by day, and by night: a background of the set of the theme, or `random`. */
  'background.light': background,
  'background.dark': background,
  /** Whether the panel is open (navigation rule 5 of the design). */
  'panel.open': z.boolean(),
  /** The layout of the page of a query: the query above the result, or next to it (DEC-UX-143). */
  'query.layout': z.enum(['horizontal', 'sideBySide']),
} as const;

/** An intro dismissed on the start screen of a section, with the version that was dismissed. */
const INTRO_KEY = /^intro\.[a-z][a-zA-Z]{0,39}$/;
const introVersion = z.number().int().min(1);

export type UserSettings = { [K in keyof typeof USER_SETTINGS]?: z.infer<(typeof USER_SETTINGS)[K]> } & {
  [intro: `intro.${string}`]: number | undefined;
};

export type SettingKey = keyof typeof USER_SETTINGS | `intro.${string}`;

/** The schema of a setting by its key, or nothing for a key Data Hub does not keep. */
export function settingSchema(key: string): z.ZodType | undefined {
  if (Object.hasOwn(USER_SETTINGS, key)) {
    return USER_SETTINGS[key as keyof typeof USER_SETTINGS];
  }
  return INTRO_KEY.test(key) ? introVersion : undefined;
}
