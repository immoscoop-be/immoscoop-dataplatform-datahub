import type { SettingKey, UserSettings } from '@datahub/contracts/settings';

/**
 * The settings of the User, kept in Data Hub (DEC-UX-96): read once when Data Hub starts, and
 * written to identity when one changes. The screen follows a change at once; a change that could
 * not be saved stays for this visit and is told to the console.
 */
export class Settings {
  values = $state<UserSettings>({});
  readonly #save: (key: SettingKey, value: unknown) => Promise<void>;
  readonly #remove: (key: SettingKey) => Promise<void>;

  constructor(
    initial: UserSettings,
    save: (key: SettingKey, value: unknown) => Promise<void>,
    remove: (key: SettingKey) => Promise<void> = async () => {},
  ) {
    this.values = initial;
    this.#save = save;
    this.#remove = remove;
  }

  set<K extends SettingKey>(key: K, value: NonNullable<UserSettings[K]>): void {
    if (this.values[key] === value) {
      return;
    }
    this.values = { ...this.values, [key]: value };
    this.#save(key, value).catch((error: unknown) => {
      console.error(`The setting ${key} could not be saved`, error);
    });
  }

  /** Forgets a setting, such as a dismissed intro the User shows again. */
  forget(key: SettingKey): void {
    if (!(key in this.values)) {
      return;
    }
    const { [key]: _forgotten, ...rest } = this.values;
    this.values = rest;
    this.#remove(key).catch((error: unknown) => {
      console.error(`The setting ${key} could not be forgotten`, error);
    });
  }
}
