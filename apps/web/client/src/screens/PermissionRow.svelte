<script lang="ts">
  import { NO_PASSWORD_MANAGER } from '@datahub/ui/foundations/fields.js';
  import Icon from '@datahub/ui/foundations/Icon.svelte';
  import { t } from '@datahub/ui/foundations/texts.svelte.js';
  import Segmented from '@datahub/ui/primitives/Segmented.svelte';
  import {
    PERMISSION_TEXTS,
    PERMISSIONS,
    sameSetting,
    shownValue,
    summaryOf,
    unitWord,
    valuesOf,
    valueText,
    type PermissionKey,
    type PermissionSetting,
    type PermissionValue,
  } from '../lib/permissions.js';

  /**
   * One Permission of a Permission group (Permission, FR-PL-05, FR-PL-09): its name, a sentence of what it allows,
   * and yes or no on the right, unless it is always on. While it is yes its values show under it, in a tinted block,
   * each with its label and a field of its kind, the kinds of a Parameter (DEC-UX-71): a whole number with its unit,
   * empty for no limit where that is allowed; a choice, as radio buttons; several choices, as chips; yes or no; a
   * text. Changed, it is marked until it is saved. Locked, for Admin, it shows its values as a sentence, with a lock.
   */
  let {
    key,
    setting,
    saved,
    locked = false,
    group,
    groupName,
    onchange,
  }: {
    key: PermissionKey;
    /** The Permission as it is being edited. */
    setting: PermissionSetting;
    /** The Permission as the group holds it. */
    saved: PermissionSetting;
    /** Admin: shown, never changed (FR-PL-08). */
    locked?: boolean;
    /** The id of the group, so that its radio buttons are its own. */
    group: string;
    /** The name of the group, for the hint of a note for Claude. */
    groupName: string;
    onchange: (setting: PermissionSetting) => void;
  } = $props();

  const text = $derived(PERMISSION_TEXTS[key]);
  const always = $derived('always' in PERMISSIONS[key]);
  const changed = $derived(!sameSetting(setting, saved));
  const values = $derived(valuesOf(key));

  function set(name: string, value: PermissionValue) {
    onchange({ ...setting, values: { ...setting.values, [name]: value } });
  }

  function toggle(name: string, option: string) {
    const chosen = Array.isArray(setting.values[name]) ? (setting.values[name] as string[]) : [];
    set(name, chosen.includes(option) ? chosen.filter((one) => one !== option) : [...chosen, option]);
  }

  /** A whole number as typed: empty is no limit where that is allowed, and nothing otherwise. */
  function typed(name: string, raw: string) {
    set(name, raw.trim() === '' ? null : Number(raw));
  }
</script>

<div class="permission" class:changed>
  <div>
    <div class="name">{t(text.name)}{#if changed}<span class="chg">{t('groups.changed')}</span>{/if}</div>
    <p class="about">{locked ? summaryOf(key, setting) || t(text.about) : t(text.about)}</p>
  </div>
  {#if locked}
    <span class="lock"><Icon name="lock-simple-fill" />{t(always ? 'permission.always' : setting.on ? 'permission.yes' : 'permission.no')}</span>
  {:else if always}
    <span class="meta always">{t('permission.always')}</span>
  {:else}
    <Segmented
      options={[
        { value: 'yes', label: t('permission.yes') },
        { value: 'no', label: t('permission.no') },
      ]}
      value={setting.on ? 'yes' : 'no'}
      label={t(text.name)}
      surface="sub"
      onchange={(answer) => onchange({ ...setting, on: answer === 'yes' })}
    />
  {/if}
  {#if !locked && (setting.on || always) && values.length > 0}
    <div class="values">
      {#each values as [name, spec] (name)}
        {@const label = t(valueText(key, name).label)}
        {@const hint = valueText(key, name).hint}
        {@const options = valueText(key, name).options ?? {}}
        <div class="value">
          <span class="label">{label}</span>
          {#if spec.kind === 'number'}
            <span class="field">
              <span class="number">
                <input {...NO_PASSWORD_MANAGER}
                  type="number"
                  min={spec.min}
                  max={spec.max}
                  step={spec.min < 1 ? 'any' : 1}
                  value={setting.values[name] ?? ''}
                  aria-label={label}
                  oninput={(event) => typed(name, event.currentTarget.value)}
                />{unitWord(spec.unit)}
                {#if saved.values[name] !== setting.values[name]}<span class="meta">{t('groups.was', { value: shownValue(key, name, saved.values[name]) })}</span>{/if}
              </span>
              {#if hint}<span class="hint">{t(hint)}</span>{/if}
            </span>
          {:else if spec.kind === 'choice'}
            <div class="options" role="radiogroup" aria-label={label}>
              {#each spec.options as option (option)}
                <label><input type="radio" name="{group}-{key}-{name}" value={option} checked={setting.values[name] === option} onchange={() => set(name, option)} />{t(options[option] ?? option)}</label>
              {/each}
            </div>
          {:else if spec.kind === 'several'}
            <div class="chips" role="group" aria-label={label}>
              {#each spec.options as option (option)}
                {@const on = Array.isArray(setting.values[name]) && (setting.values[name] as string[]).includes(option)}
                <button type="button" class="chip" class:on aria-pressed={on} onclick={() => toggle(name, option)}>{#if on}<Icon name="check" />{/if}{t(options[option] ?? option)}</button>
              {/each}
            </div>
          {:else if spec.kind === 'yesno'}
            <span>
              <Segmented
                options={[
                  { value: 'yes', label: t('permission.yes') },
                  { value: 'no', label: t('permission.no') },
                ]}
                value={setting.values[name] ? 'yes' : 'no'}
                {label}
                surface="solid"
                onchange={(answer) => set(name, answer === 'yes')}
              />
            </span>
          {:else if spec.kind === 'text'}
            <span class="field">
              <textarea {...NO_PASSWORD_MANAGER} rows="2" maxlength={spec.max} value={String(setting.values[name] ?? '')} aria-label={label} oninput={(event) => set(name, event.currentTarget.value)}></textarea>
              {#if hint}<span class="hint">{t(hint, { group: groupName })}</span>{/if}
            </span>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .permission { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 2px 16px; align-items: start; padding: 12px 8px; border-radius: var(--radius-md); }
  .permission + :global(.permission) { border-top: 1px solid var(--tint-hover); }
  .changed { background: color-mix(in srgb, var(--surface-sub) 70%, transparent); }
  .name { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; font-size: var(--text-small); font-weight: var(--weight-medium); }
  .about { margin: 3px 0 0; font-size: var(--text-meta); line-height: 1.45; color: var(--text-muted); }
  .chg { font-size: var(--text-meta); font-weight: var(--weight-regular); background: var(--surface-sub); color: var(--text-secondary); padding: 1px 8px; border-radius: var(--radius-pill); }
  .lock { display: inline-flex; align-items: center; gap: 4px; font-size: var(--text-meta); color: var(--text-muted); white-space: nowrap; }
  .always { white-space: nowrap; }
  .values { grid-column: 1 / -1; display: grid; gap: 10px; margin: 8px 0 0; padding: 12px 14px; border-radius: var(--radius-md); background: var(--surface-sub); }
  .value { display: grid; grid-template-columns: minmax(150px, 230px) minmax(0, 1fr); gap: 12px; align-items: start; font-size: var(--text-small); }
  .label { padding-top: 5px; line-height: 1.4; font-size: var(--text-meta); color: var(--text-muted); }
  .field { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
  .number { display: inline-flex; align-items: center; gap: 8px; color: var(--text-secondary); }
  .number input, textarea { font: var(--text-small) var(--font-family); color: var(--text-primary); background: var(--surface-solid); border: 1px solid var(--tint-active); border-radius: var(--radius-sm); padding: 5px 8px; }
  .number input { width: 84px; }
  textarea { width: 100%; max-width: 460px; box-sizing: border-box; resize: vertical; line-height: 1.5; }
  .hint { font-size: var(--text-meta); line-height: 1.5; color: var(--text-muted); }
  .options { display: flex; flex-direction: column; align-items: flex-start; gap: 6px; }
  .options label { display: flex; align-items: flex-start; gap: 8px; line-height: 1.45; cursor: pointer; }
  .options input { margin: 3px 0 0; accent-color: var(--text-primary); }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; padding-top: 2px; }
  .chip { display: inline-flex; align-items: center; gap: 5px; font: var(--text-meta) var(--font-family); padding: 3px 9px; border: 0; border-radius: var(--radius-pill); background: none; color: var(--text-muted); outline: 1px dashed var(--tint-active); cursor: pointer; }
  .chip.on { color: var(--text-primary); background: var(--surface-solid); outline: 1px solid var(--tint-active); }
  .chip:focus-visible { outline: 2px solid var(--text-secondary); }
  @media (max-width: 900px) { .value { grid-template-columns: minmax(0, 1fr); gap: 6px; } .permission { grid-template-columns: minmax(0, 1fr); } }
</style>
