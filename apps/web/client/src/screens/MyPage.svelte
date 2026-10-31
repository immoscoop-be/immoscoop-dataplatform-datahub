<script lang="ts">
  import BackgroundPicker from '@datahub/ui/components/BackgroundPicker.svelte';
  import type { Theme } from '@datahub/ui/foundations/backgrounds.js';
  import Icon from '@datahub/ui/foundations/Icon.svelte';
  import Sentence from '@datahub/ui/foundations/Sentence.svelte';
  import { t, type Language } from '@datahub/ui/foundations/texts.svelte.js';
  import Grid from '@datahub/ui/containers/Grid.svelte';
  import SubTile from '@datahub/ui/containers/SubTile.svelte';
  import Tabs from '@datahub/ui/containers/Tabs.svelte';
  import Avatar from '@datahub/ui/primitives/Avatar.svelte';
  import Segmented from '@datahub/ui/primitives/Segmented.svelte';
  import type { Group, Identity, Me } from '../lib/identity.js';
  import { myPagePath, type MyPageTab } from '../lib/routes.js';
  import ExcelKeys from './ExcelKeys.svelte';

  /**
   * My page, behind the initials at the foot of the rail (DEC-UX-84): who the User is in Data Hub,
   * and their settings. Profile: the language of Data Hub (DEC-UX-85) and the groups they own through
   * (DEC-DH-78); Excel keys, with which Excel gets the result of a Lens (FR-PL-01, FR-PL-02); Background: one
   * choice for day and one for night (DEC-UX-108).
   */
  let {
    me,
    initials,
    tab,
    language,
    groups,
    theme,
    backgroundChoice,
    onlanguage,
    onbackground,
    identity,
  }: {
    me: Me;
    initials: string;
    tab: MyPageTab;
    language: Language;
    /** The groups of the User, read from Workspace when the page opens; undefined while they come, null when they did not. */
    groups: readonly Group[] | null | undefined;
    theme: Theme;
    backgroundChoice: string;
    onlanguage: (language: Language) => void;
    onbackground: (choice: string) => void;
    /** identity, for the Excel keys of the User. */
    identity: Pick<Identity, 'excelKeys' | 'makeExcelKey' | 'revokeExcelKey'>;
  } = $props();

  // The names of the languages, each written in its own language, whatever the language of Data Hub.
  const LANGUAGES = [
    { value: 'nl', label: 'Nederlands' },
    { value: 'en', label: 'English' },
  ] as const;

</script>

<div class="head">
  <Avatar {initials} size="large" />
  <div class="who">
    <h1 class="page-title">{me.name}</h1>
    <p class="meta account"><Icon name="google-logo" /> {t('me.signedInWith', { email: me.email })}</p>
  </div>
</div>

<Tabs
  label={t('me.tabs')}
  top="22px"
  current={tab}
  tabs={[
    { id: 'profile', label: t('me.tab.profile'), href: myPagePath('profile') },
    { id: 'keys', label: t('me.tab.keys'), href: myPagePath('keys') },
    { id: 'background', label: t('me.tab.background'), href: myPagePath('background') },
  ]}
>
  {#if tab === 'profile'}
    <Grid min="320px">
      <SubTile round label={t('me.language.label')}>
        <!-- A name stays English, in a monospace font, in the sentence that explains it (NFR-LOC-03). -->
        <p class="meta text"><Sentence key="me.language.text" values={{ kind: 'Resource' }} names={{ name: 'creditLead' }} /></p>
        <Segmented options={LANGUAGES} value={language} label={t('me.language.label')} onchange={onlanguage} />
        <p class="meta follows">{t('me.language.cards')}</p>
      </SubTile>
      <SubTile round label={t('me.own.label')}>
        <p class="meta text own">{t('me.own.text')}</p>
        {#if groups === null}
          <p class="meta">{t('me.own.failed')}</p>
        {:else if groups && groups.length === 0}
          <p class="meta">{t('me.own.none')}</p>
        {:else if groups}
          <!-- About six rows, then the list scrolls within itself (DEC-UX-135). -->
          <div class="list">
            {#each groups as group (group.id)}
              <div class="row">
                <span class="item-icon"><Icon name="users-three" /></span>
                <span class="row-text"><span class="item-title">{group.name}</span><span class="meta">{group.email}</span></span>
              </div>
            {/each}
          </div>
        {/if}
        <p class="meta groups">{t('me.own.groups')}</p>
      </SubTile>
    </Grid>
  {:else if tab === 'keys'}
    <ExcelKeys {identity} />
  {:else}
    <p class="meta text line">{t('me.background.text', { theme })}</p>
    <BackgroundPicker {theme} choice={backgroundChoice} onchoose={onbackground} />
  {/if}
</Tabs>

<style>
  .head { display: flex; align-items: center; gap: 16px; margin-top: 6px; }
  .who { flex: 1; min-width: 0; }
  .account { display: flex; align-items: center; gap: 4px; margin: 4px 0 1em; }
  .meta { display: block; }
  .text { line-height: 1.5; margin: 4px 0 12px; }
  .own { margin-bottom: 10px; }
  .follows { margin: 12px 0 0; }
  .groups { margin: 10px 0 0; }
  .line { max-width: 720px; margin: 4px 0 14px; }
  .list { max-height: 300px; overflow-y: auto; }
  .row { display: flex; align-items: center; gap: 10px; padding: 8px 6px; border-radius: var(--radius-md); }
  .item-icon { width: 26px; height: 34px; display: flex; align-items: center; justify-content: center; font-size: 20px; flex-shrink: 0; color: var(--text-secondary); }
  .row-text { flex: 1; min-width: 0; display: flex; flex-direction: column; }
</style>
