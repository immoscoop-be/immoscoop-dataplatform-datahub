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
  import Button from '@datahub/ui/primitives/Button.svelte';
  import Loading from '@datahub/ui/primitives/Loading.svelte';
  import Segmented from '@datahub/ui/primitives/Segmented.svelte';
  import { listOf, tileLineOf } from '../lib/groups.js';
  import type { GroupSummary, Identity, Me } from '../lib/identity.js';
  import { GROUPS, groupPath, myPagePath, NEW_GROUP, type MyPageTab } from '../lib/routes.js';
  import { place, useScreenCommands } from '../lib/commands.svelte.js';
  import type { QuickRow } from '../lib/quick.js';
  import { can } from '../lib/permissions.js';
  import type { Catalogue } from '../lib/catalogue.js';
  import ExcelKeys from './ExcelKeys.svelte';
  import SlackTile from './SlackTile.svelte';

  /**
   * My page, behind the initials at the foot of the rail (DEC-UX-84): who the User is in Data Hub,
   * and their settings. Profile: the language of Data Hub (DEC-UX-85), the Slack account Data Hub finds them by, where
   * Slack is set up (DEC-UX-209), what they own (DEC-DH-78), and the tile Your
   * groups: the Groups they are in, with the way to Groups and New group (DEC-UX-200); Excel keys, with which Excel
   * gets the result of a Lens (FR-PL-01, FR-PL-02); Background: one choice for day and one for night (DEC-UX-108).
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
    slack,
  }: {
    me: Me;
    initials: string;
    tab: MyPageTab;
    language: Language;
    /** The Groups the User is in or manages, read when the page opens; undefined while they come, null when they did not. */
    groups: readonly GroupSummary[] | null | undefined;
    theme: Theme;
    backgroundChoice: string;
    onlanguage: (language: Language) => void;
    onbackground: (choice: string) => void;
    /** identity, for the Excel keys of the User. */
    identity: Pick<Identity, 'excelKeys' | 'makeExcelKey' | 'revokeExcelKey'>;
    /** catalogue, for the address Data Hub finds the User by in Slack (FR-LN-07). */
    slack: Pick<Catalogue, 'slack' | 'slackLookup' | 'slackCode' | 'slackConfirm' | 'slackReset'>;
  } = $props();

  // The names of the languages, each written in its own language, whatever the language of Data Hub.
  const LANGUAGES = [
    { value: 'nl', label: 'Nederlands' },
    { value: 'en', label: 'English' },
  ] as const;

  /** The Groups the User is in, for the tile Your groups (FR-UM-18). */
  const mine = $derived(groups?.filter((group) => group.isMember));
  /** How a Group of the User stands: it manages itself, what it manages, or who manages it (my-page). */
  function lineOf(group: GroupSummary): string {
    const line = tileLineOf(group, groups ?? []);
    const what =
      line.kind === 'itself'
        ? t('me.groups.itself')
        : line.kind === 'manages'
          ? t('me.groups.manages', { names: listOf(line.names, language) })
          : t('me.groups.managedBy', { group: line.name });
    return `${t('group.members', { count: group.memberCount })} · ${what}`;
  }

  // In the quick window: its other tabs, Groups, and a new Group for who may make one (DEC-UX-240).
  const TABS = [
    { id: 'profile', label: 'me.tab.profile', icon: 'user' },
    { id: 'keys', label: 'me.tab.keys', icon: 'key' },
    { id: 'background', label: 'me.tab.background', icon: 'sun-fill' },
  ] as const;
  useScreenCommands((go) => {
    const rows: QuickRow[] = [];
    for (const one of TABS) if (one.id !== tab) rows.push(place(`me:${one.id}`, one.icon, t('quick.show', { name: t(one.label) }), () => go(myPagePath(one.id)), { words: t('quick.tab.words') }));
    rows.push(place('me:groups', 'users-three', 'Groups', () => go(GROUPS), { meta: t('quick.me.groups.meta'), words: t('quick.me.groups.words') }));
    if (can(me.permissions, 'groups.manage')) rows.push(place('me:new-group', 'plus', t('group.new'), () => go(NEW_GROUP), { words: t('quick.group.new.words') }));
    return { group: 'My page', rows };
  });
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
      <SlackTile {slack} {language} />
      <SubTile round label={t('me.own.label')}>
        <p class="meta text own">{t('me.own.text')}</p>
      </SubTile>
      <SubTile round label={t('me.groups.label')}>
        <p class="meta text own">{t('me.groups.text')}</p>
        {#if groups === null}
          <p class="meta">{t('me.groups.failed')}</p>
        {:else if mine && mine.length === 0}
          <p class="meta">{t('me.groups.none')}</p>
        {:else if mine}
          <!-- About six rows, then the list scrolls within itself (DEC-UX-135). -->
          <div class="list">
            {#each mine as group (group.id)}
              <a class="row" href={groupPath(group.id)}>
                <span class="item-icon"><Icon name="users-three" /></span>
                <span class="row-text"><span class="item-title">{group.name}</span><span class="meta">{lineOf(group)}</span></span>
              </a>
            {/each}
          </div>
        {:else}
          <Loading />
        {/if}
        <div class="ways">
          <Button variant="outline" href={GROUPS}><Icon name="users-three" />Groups</Button>
          {#if can(me.permissions, 'groups.manage')}<Button variant="outline" href={NEW_GROUP}><Icon name="plus" />{t('group.new')}</Button>{/if}
        </div>
      </SubTile>
    </Grid>
  {:else if tab === 'keys'}
    <ExcelKeys {identity} canMake={can(me.permissions, 'excel.keys')} />
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
  .ways { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
  .line { max-width: 720px; margin: 4px 0 14px; }
  .list { max-height: 300px; overflow-y: auto; }
  .row { display: flex; align-items: center; gap: 10px; padding: 8px 6px; border-radius: var(--radius-md); color: inherit; text-decoration: none; }
  .row:hover { background: var(--tint-hover); }
  .row:focus-visible { outline: 2px solid var(--text-secondary); }
  .item-icon { width: 26px; height: 34px; display: flex; align-items: center; justify-content: center; font-size: 20px; flex-shrink: 0; color: var(--text-secondary); }
  .row-text { flex: 1; min-width: 0; display: flex; flex-direction: column; }
</style>
