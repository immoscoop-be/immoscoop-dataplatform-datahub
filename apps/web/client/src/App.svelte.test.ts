import { fireEvent, render, screen, within } from '@testing-library/svelte';
import { setLanguage } from '@datahub/ui/foundations/texts.svelte.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App.svelte';
import type { Config } from './lib/config.js';

const CONFIG: Config = {
  identityUrl: 'https://identity.test',
  catalogueUrl: 'https://catalogue.test',
  registryUrl: 'https://registry.test',
  semgraphUrl: 'https://semgraph.test',
};

const ME = { sub: '1', email: 'max@thenextimmoscoop.be', name: 'Max Verstraete', groups: [] as string[], roles: [] as string[] };

interface Saved {
  method: string;
  path: string;
  body?: unknown;
}

/** A Resource that waits for a Collection, as catalogue gives it. */
const SAVED_SEARCHES = {
  id: 'r1',
  key: 'immoscoop-dataplatform-398214.dbt_prod_stacks.saved_searches',
  displayName: 'Saved searches',
  name: 'saved_searches',
  resourceType: 'model',
  projectId: '9367',
  projectName: 'immoscoop_dataplatform_sql',
  description: 'One row per saved search.',
  exposures: ['datahub_savedSearches'],
  collectionId: null,
  level: 1,
  registeredAt: '2026-10-21T08:00:00Z',
  withdrawn: false,
  fields: [
    { name: 'search_id', position: 1, dataType: 'STRING', description: '' },
    { name: 'filters', position: 2, dataType: 'STRING', description: '' },
  ],
  leftOut: [],
};

const DATA = { id: 'g1', email: 'data@thenextimmoscoop.be', name: 'Data' };
const SALES = { id: 'g2', email: 'sales@thenextimmoscoop.be', name: 'Sales' };

/** A Collection of the group Data, with one Resource in it that is not published yet. */
const CREDIT = {
  id: 'c1',
  name: 'Credit leads',
  description: 'The credit leads Immoscoop sends to KBC.',
  icon: 'coins',
  ownerUnit: DATA,
  visibility: 'public',
  createdAt: '2026-09-03T08:00:00Z',
  createdBy: 'An Claes',
  canManage: true,
  resources: [{ id: 'r2', displayName: 'Weekly lead volume', level: 2, published: false, withdrawn: false }],
  lastChange: { logId: 'COL-006', params: { resource: 'Weekly lead volume', actor: 'Dirk Vos' }, at: '2026-10-27T08:00:00Z' },
};

/** A public Collection of another group. */
const LISTINGS = {
  ...CREDIT,
  id: 'c2',
  name: 'Listings',
  description: 'Every listing on the site.',
  icon: 'buildings',
  ownerUnit: SALES,
  canManage: false,
  resources: [],
  lastChange: null,
};

const WEEKLY = {
  ...SAVED_SEARCHES,
  id: 'r2',
  key: 'immoscoop-dataplatform-398214.dbt_prod_leads.weekly_lead_volume',
  displayName: 'Weekly lead volume',
  name: 'weekly_lead_volume',
  collectionId: 'c1',
  level: 2,
  lastChange: { logId: 'COL-030', params: { collection: 'Credit leads', actor: 'Dirk Vos' }, at: '2026-10-27T08:00:00Z' },
};

/** The server of the web app, identity and catalogue, as the page meets them: with or without a session. */
function serve({
  signedIn = true,
  settings = {} as Record<string, unknown>,
  roles = [] as string[],
  groups = [] as string[],
} = {}): Saved[] {
  const calls: Saved[] = [];
  vi.stubGlobal('fetch', async (input: string, init: RequestInit = {}) => {
    const method = init.method ?? 'GET';
    const path = input.replace(CONFIG.identityUrl, '').replace(CONFIG.catalogueUrl, '');
    const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
    if (path === '/auth/token') {
      return signedIn ? json({ access_token: 'token', expires_in: 3600 }) : json({ error: 'no_session' }, 401);
    }
    calls.push({ method, path, ...(init.body ? { body: JSON.parse(init.body as string) } : {}) });
    if (path === '/me') {
      return json({ ...ME, roles, groups });
    }
    const dataTeam = roles.includes('datateam');
    if (path === '/collections' && method === 'GET') {
      return json({ collections: [CREDIT, LISTINGS] });
    }
    if (path === '/collections' && method === 'POST') {
      const body = JSON.parse(init.body as string) as { name: string; ownerUnit: string };
      return json({ ...CREDIT, ...body, id: 'c-new', ownerUnit: DATA, resources: [], lastChange: null }, 201);
    }
    if (path === '/collections/c1') {
      return method === 'PATCH' ? json({ ...CREDIT, ...JSON.parse(init.body as string) }) : json(CREDIT);
    }
    if (path === '/collections/c2') {
      return json(LISTINGS);
    }
    if (path === '/collections/c2/resources') {
      return json({ resources: [] });
    }
    if (path === '/collections/c-new') {
      return json({ ...CREDIT, id: 'c-new', name: 'Search behaviour', resources: [], lastChange: null });
    }
    if (path === '/collections/c1/resources') {
      return json({ resources: method === 'POST' ? [WEEKLY, { ...SAVED_SEARCHES, collectionId: 'c1', lastChange: null }] : [WEEKLY] });
    }
    if (path === '/collections/c-new/resources') {
      return json({ resources: [] });
    }
    if (/^\/collections\/(c1|c2|c-new)\/log$/.test(path)) {
      return json({ entries: [{ logId: 'COL-001', params: { actor: 'An Claes', name: 'Credit leads' }, at: '2026-09-03T08:00:00Z' }] });
    }
    if (path === '/groups') {
      return dataTeam ? json({ groups: [DATA, SALES] }) : json({ error: 'forbidden' }, 403);
    }
    if (path === '/resources?collection=none') {
      return dataTeam ? json({ resources: [SAVED_SEARCHES] }) : json({ error: 'forbidden' }, 403);
    }
    if (path === '/resources/r1' && dataTeam) {
      return json({ resource: SAVED_SEARCHES });
    }
    if (path === '/resources/r1/log' && dataTeam) {
      return json({
        entries: [
          { logId: 'RES-002', params: { level: '1', reason: 'fields-undescribed' }, at: '2026-10-21T08:00:00Z' },
          { logId: 'RES-001', params: { exposure: 'datahub_savedSearches', key: SAVED_SEARCHES.key, run: '7' }, at: '2026-10-21T08:00:00Z' },
        ],
      });
    }
    if (path === '/me/settings') {
      return json({ settings });
    }
    if (path === '/me/groups') {
      return json({ groups: [{ id: 'g1', email: 'data@thenextimmoscoop.be', name: 'Data' }] });
    }
    if (path.startsWith('/me/settings/') && (method === 'PUT' || method === 'DELETE')) {
      return new Response(null, { status: 204 });
    }
    return json({ error: 'not_found' }, 404);
  });
  return calls;
}

/** The address the page opens on. */
function open(path: string): void {
  history.replaceState(null, '', path);
}

beforeEach(() => {
  // The narrowest window, as tokens.css gives it, and a wide window with a light system and no wish for less motion.
  document.documentElement.style.setProperty('--app-min-width', '900px');
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} }));
  // Random picks the first of each set: the gradient, which needs no WebGL, and the first photo.
  vi.spyOn(Math, 'random').mockReturnValue(0);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  setLanguage('nl');
  open('/');
});

describe('the web app, signed out', () => {
  it('shows the sign-in, which returns to the page it started from (FR-UM-01)', async () => {
    serve({ signedIn: false });
    open('/query');
    render(App, { config: CONFIG });
    const signIn = await screen.findByRole('link', { name: /Aanmelden met Google/ });
    expect(signIn.getAttribute('href')).toBe('/auth/login?next=%2Fquery');
    expect(screen.queryByRole('navigation')).toBeNull();
  });

  it('names a refused account, and lets the User choose another (FR-UM-02)', async () => {
    serve({ signedIn: false });
    open('/collections#account=max%40gmail.com');
    render(App, { config: CONFIG });
    const again = await screen.findByRole('link', { name: /Aanmelden met een ander account/ });
    expect(again.getAttribute('href')).toBe('/auth/login?next=%2Fcollections&choose=account');
    expect(screen.getByRole('alert').querySelector('b')?.textContent).toBe('max@gmail.com');
    expect(location.hash).toBe('');
  });

  it('explains a sign-in that went wrong', async () => {
    serve({ signedIn: false });
    open('/collections?error=access_denied');
    render(App, { config: CONFIG });
    expect((await screen.findByRole('alert')).textContent).toContain('Enkel actieve accounts van het bedrijf');
    expect(location.search).toBe('');
  });
});

describe('the web app, signed in', () => {
  it('opens on Collections, with the rail and its panel', async () => {
    serve();
    open('/');
    render(App, { config: CONFIG });
    const collections = await screen.findByRole('link', { name: 'Collections' });
    expect(collections.getAttribute('aria-current')).toBe('page');
    expect(location.pathname).toBe('/collections');
    expect(screen.getByRole('complementary', { name: 'Collections' }).inert).toBe(false);
    expect(screen.getByRole('link', { name: 'Mijn pagina' }).textContent).toBe('MV');
    expect(document.title).toBe('Data Hub — Collections');
  });

  it('slides the panel in and out with the item of its section, and remembers it (navigation rule 5)', async () => {
    const calls = serve();
    open('/collections');
    render(App, { config: CONFIG });
    await fireEvent.click(await screen.findByRole('link', { name: 'Collections' }));
    expect(screen.getByRole('complementary', { hidden: true }).inert).toBe(true);
    expect(calls).toContainEqual({ method: 'PUT', path: '/me/settings/panel.open', body: { value: false } });
  });

  it('goes to another section with its panel open', async () => {
    serve({ settings: { 'panel.open': false } });
    open('/collections');
    render(App, { config: CONFIG });
    await fireEvent.click(await screen.findByRole('link', { name: 'Grafieken' }));
    expect(location.pathname).toBe('/charts');
    expect(screen.getByRole('complementary', { name: 'Grafieken' }).inert).toBe(false);
    expect(within(screen.getByRole('main')).getByRole('heading', { level: 1, name: 'Grafieken' })).toBeTruthy();
  });

  it('switches between light and dark, and remembers it', async () => {
    const calls = serve();
    render(App, { config: CONFIG });
    await fireEvent.click(await screen.findByRole('button', { name: 'Wissel tussen licht en donker' }));
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(calls).toContainEqual({ method: 'PUT', path: '/me/settings/theme', body: { value: 'dark' } });
  });

  it('opens My page behind the initials, where the language of Data Hub is chosen (DEC-UX-85)', async () => {
    const calls = serve();
    open('/collections');
    render(App, { config: CONFIG });
    await fireEvent.click(await screen.findByRole('link', { name: 'Mijn pagina' }));
    expect(location.pathname).toBe('/me');
    expect(screen.getByRole('heading', { level: 1, name: 'Max Verstraete' })).toBeTruthy();
    expect(await screen.findByText('data@thenextimmoscoop.be')).toBeTruthy();
    expect(screen.queryByRole('complementary', { hidden: true })).toBeNull();
    await fireEvent.click(screen.getByRole('radio', { name: 'English' }));
    expect(screen.getByRole('tab', { name: 'Profile' })).toBeTruthy();
    expect(document.documentElement.lang).toBe('en');
    expect(calls).toContainEqual({ method: 'PUT', path: '/me/settings/language', body: { value: 'en' } });
  });

  it('keeps a background per theme (DEC-UX-108)', async () => {
    const calls = serve({ settings: { language: 'en' } });
    open('/me/background');
    render(App, { config: CONFIG });
    await fireEvent.click(await screen.findByRole('radio', { name: /Fresh piste/ }));
    expect(calls).toContainEqual({ method: 'PUT', path: '/me/settings/background.light', body: { value: 'piste' } });
    expect(screen.getByRole('radio', { checked: true }).textContent).toContain('Fresh piste');
  });

  it('shows one page for what does not exist or may not be seen (DEC-UX-32)', async () => {
    serve();
    open('/collections/secret');
    render(App, { config: CONFIG });
    expect(await screen.findByRole('heading', { level: 1, name: 'Hier is niets voor jou' })).toBeTruthy();
  });
});

describe('the web app, for the Data Team', () => {
  it('shows the Resources without a Collection on top of the panel of Collections (FR-SR-35, DEC-UX-16)', async () => {
    serve({ roles: ['datateam'] });
    open('/collections');
    render(App, { config: CONFIG });
    const resource = await screen.findByRole('link', { name: /Saved searches/ });
    expect(resource.getAttribute('href')).toBe('/resources/r1');
    expect(screen.getByText('Zonder Collection')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Toon wat Zonder Collection bevat' }).getAttribute('aria-expanded')).toBe('true');
  });

  it('opens the page of a waiting Resource: where it came from, its description and its maturity (FR-SR-07, FR-SR-09)', async () => {
    serve({ roles: ['datateam'] });
    open('/collections');
    render(App, { config: CONFIG });
    await fireEvent.click(await screen.findByRole('link', { name: /Saved searches/ }));
    expect(location.pathname).toBe('/resources/r1');
    const main = within(screen.getByRole('main'));
    expect(await main.findByRole('heading', { level: 1, name: 'Saved searches' })).toBeTruthy();
    expect(main.getByText(SAVED_SEARCHES.key)).toBeTruthy();
    const notice = screen.getByRole('status');
    expect(notice.textContent).toContain('Nog in geen Collection.');
    expect(notice.textContent).toContain('Hij kwam binnen op 21 okt via de exposure datahub_savedSearches in immoscoop_dataplatform_sql.');
    expect(main.getByText('One row per saved search.')).toBeTruthy();
    expect(main.getByText('2 van de 2 kolommen hebben nog geen beschrijving')).toBeTruthy();
    expect(await main.findByText('Geregistreerd via de exposure datahub_savedSearches')).toBeTruthy();
    expect(document.title).toBe('Data Hub — Saved searches');
    expect(screen.getByRole('link', { name: /Saved searches/ }).getAttribute('aria-current')).toBe('page');
  });

  it('shows the page for what may not be seen to anyone else (FR-SR-31, DEC-UX-32)', async () => {
    serve();
    open('/resources/r1');
    render(App, { config: CONFIG });
    expect(await screen.findByRole('heading', { level: 1, name: 'Hier is niets voor jou' })).toBeTruthy();
    expect(screen.queryByText('Zonder Collection')).toBeNull();
  });
});

describe('the web app, with Collections', () => {
  it('lists every Collection the User sees in the panel, All or Yours, each unfolding to its Resources (FR-CO-18, FR-CO-22, DEC-UX-87)', async () => {
    serve({ groups: ['g1'] });
    open('/collections');
    render(App, { config: CONFIG });
    const panel = within(await screen.findByRole('complementary', { name: 'Collections' }));
    const credit = await panel.findByRole('link', { name: /Credit leads/ });
    expect(credit.getAttribute('href')).toBe('/collections/c1');
    expect(credit.textContent).toContain('1 Resource');
    // Only the Collections of the User say whether they are public or private.
    expect(credit.textContent).toContain('Publiek');
    expect(panel.getByRole('link', { name: /Listings/ }).textContent).not.toContain('Publiek');
    await fireEvent.click(panel.getByRole('button', { name: 'Toon wat Credit leads bevat' }));
    const weekly = panel.getByRole('link', { name: /Weekly lead volume/ });
    expect(weekly.getAttribute('href')).toBe('/resources/r2');
    // Not published: a lighter name, and hover says so.
    expect(weekly.querySelector('[title]')?.getAttribute('title')).toBe('Weekly lead volume · niet gepubliceerd');

    await fireEvent.click(panel.getByRole('radio', { name: 'Van jou' }));
    expect(panel.queryByRole('link', { name: /Listings/ })).toBeNull();
    expect(panel.getByRole('link', { name: /Credit leads/ })).toBeTruthy();
  });

  it('searches the Collections and their Resources together, unfolding where a Resource matches (FR-CO-24)', async () => {
    serve();
    open('/collections');
    render(App, { config: CONFIG });
    const panel = within(await screen.findByRole('complementary', { name: 'Collections' }));
    await panel.findByRole('link', { name: /Credit leads/ });
    await fireEvent.input(panel.getByRole('searchbox'), { target: { value: 'weekly' } });
    expect(panel.getByRole('link', { name: /Weekly lead volume/ })).toBeTruthy();
    expect(panel.queryByRole('link', { name: /Listings/ })).toBeNull();
    await fireEvent.input(panel.getByRole('searchbox'), { target: { value: 'nothing like it' } });
    expect(panel.getByText('Niets komt overeen met je zoekopdracht.')).toBeTruthy();
  });

  it('opens on the intro until the User dismisses it, then shows it again on request (Start screen per section)', async () => {
    const calls = serve({ groups: ['g1'] });
    open('/collections');
    render(App, { config: CONFIG });
    const main = within(await screen.findByRole('main'));
    expect(await main.findByRole('heading', { level: 2, name: 'Wat zijn Collections?' })).toBeTruthy();
    // Yours, and what changed lately, with who did it.
    expect((await main.findAllByRole('link', { name: /Credit leads/ }))[0]?.textContent).toContain('Van Data');
    expect(main.getByText('Weekly lead volume toegevoegd door Dirk Vos')).toBeTruthy();
    await fireEvent.click(main.getByRole('button', { name: 'Verberg de intro' }));
    expect(calls).toContainEqual({ method: 'PUT', path: '/me/settings/intro.collections', body: { value: 1 } });
    await fireEvent.click(main.getByRole('button', { name: 'Toon de intro' }));
    expect(calls).toContainEqual({ method: 'DELETE', path: '/me/settings/intro.collections' });
    expect(main.getByRole('heading', { level: 2, name: 'Wat zijn Collections?' })).toBeTruthy();
  });

  it('opens the page of a Collection from the panel: what it is, what needs attention, its Resources and its history (FR-CO-25 to FR-CO-27)', async () => {
    serve({ groups: ['g1'] });
    open('/collections');
    render(App, { config: CONFIG });
    const panel = within(await screen.findByRole('complementary', { name: 'Collections' }));
    await fireEvent.click(await panel.findByRole('link', { name: /Credit leads/ }));
    expect(location.pathname).toBe('/collections/c1');
    const main = within(await screen.findByRole('main'));
    expect(await main.findByRole('heading', { level: 1, name: 'Credit leads' })).toBeTruthy();
    expect(main.getByText('Owner: Data')).toBeTruthy();
    expect(main.getByText(/^Aangemaakt op 3 sep\.? door An Claes$/)).toBeTruthy();
    expect(main.getByRole('region', { name: 'Vraagt aandacht' }).textContent).toContain(
      '1 Resource is nog niet gepubliceerd: Weekly lead volume. Tot de Owner hem publiceert, zien enkel Data en het Data Team hem.',
    );
    const row = within(main.getByRole('table', { name: 'Resources' })).getByRole('link', { name: /Weekly lead volume/ }).closest('tr')!;
    expect(row.textContent).toContain('2 · Described');
    expect(row.textContent).toContain('Toegevoegd aan de Collection Credit leads door Dirk Vos');
    expect(main.getByText('Collection aangemaakt door An Claes')).toBeTruthy();
    expect(document.title).toBe('Data Hub — Credit leads');
    // It unfolds in the panel, with an outline.
    expect(panel.getByRole('button', { name: 'Toon wat Credit leads bevat' }).getAttribute('aria-expanded')).toBe('true');
    expect(panel.getByRole('link', { name: /Credit leads/ }).getAttribute('aria-current')).toBe('page');
    // Only the Data Team adds Resources.
    expect(main.queryByRole('button', { name: /Resources toevoegen/ })).toBeNull();
  });

  it('shows a colleague no actions and no Resource that is not published (DEC-CO-12, DEC-CO-15)', async () => {
    serve();
    open('/collections/c2');
    render(App, { config: CONFIG });
    const main = within(await screen.findByRole('main'));
    expect(await main.findByRole('heading', { level: 1, name: 'Listings' })).toBeTruthy();
    expect(main.queryByRole('button', { name: /Bewerken/ })).toBeNull();
    expect(main.queryByRole('region', { name: 'Vraagt aandacht' })).toBeNull();
    expect(main.getByText('Nog geen gepubliceerde Resources in deze Collection.')).toBeTruthy();
  });

  it('makes a Collection on an empty page, with a required icon and one of the groups of the User (FR-CO-12, DEC-CO-25)', async () => {
    const calls = serve({ groups: ['g1'] });
    open('/collections');
    render(App, { config: CONFIG });
    const panel = within(await screen.findByRole('complementary', { name: 'Collections' }));
    await fireEvent.click(panel.getByRole('link', { name: 'Nieuwe Collection' }));
    expect(location.pathname).toBe('/collections/new');
    const main = within(await screen.findByRole('main'));
    await fireEvent.input(main.getByRole('textbox', { name: 'Naam' }), { target: { value: 'Search behaviour' } });
    await fireEvent.input(main.getByRole('textbox', { name: /Beschrijving/ }), { target: { value: 'What visitors search for.' } });
    await fireEvent.click(main.getByRole('button', { name: 'Bewaren' }));
    expect(main.getByText('Kies een icoon: het is het enige wat de Collection onderscheidt.')).toBeTruthy();
    expect(calls.some((call) => call.method === 'POST')).toBe(false);

    await fireEvent.click(await main.findByRole('radio', { name: 'binoculars' }));
    expect((main.getByRole('combobox', { name: /Owner Unit/ }) as HTMLSelectElement).value).toBe('g1');
    await fireEvent.click(main.getByRole('radio', { name: 'Publiek' }));
    expect(main.getByText('Elke collega ziet de Collection, en de Resources erin zodra ze gepubliceerd zijn.')).toBeTruthy();
    await fireEvent.click(main.getByRole('button', { name: 'Bewaren' }));
    await vi.waitFor(() => expect(location.pathname).toBe('/collections/c-new'));
    expect(calls).toContainEqual({
      method: 'POST',
      path: '/collections',
      body: { name: 'Search behaviour', description: 'What visitors search for.', icon: 'binoculars', ownerUnit: 'g1', visibility: 'public' },
    });
  });

  it('edits a Collection in place, and sends only what changed (FR-CO-30)', async () => {
    const calls = serve({ groups: ['g1'] });
    open('/collections/c1');
    render(App, { config: CONFIG });
    const main = within(await screen.findByRole('main'));
    await fireEvent.click(await main.findByRole('button', { name: /Bewerken/ }));
    expect(main.getByText('Enkel groepen waar je zelf in zit. De Owner Unit staat in voor de Resources van de Collection.')).toBeTruthy();
    // It still holds a Resource, so it cannot be dissolved (FR-CO-10).
    expect((main.getByRole('button', { name: 'Opheffen' }) as HTMLButtonElement).disabled).toBe(true);
    await fireEvent.input(main.getByRole('textbox', { name: /Beschrijving/ }), { target: { value: 'Every credit lead.' } });
    await fireEvent.click(main.getByRole('button', { name: 'Bewaren' }));
    await vi.waitFor(() => expect(calls).toContainEqual({ method: 'PATCH', path: '/collections/c1', body: { description: 'Every credit lead.' } }));
  });
});

describe('the web app, for the Data Team, with Collections', () => {
  it('hands a Collection to any group of the domain (FR-CO-35)', async () => {
    serve({ roles: ['datateam'] });
    open('/collections/c1');
    render(App, { config: CONFIG });
    const main = within(await screen.findByRole('main'));
    await fireEvent.click(await main.findByRole('button', { name: /Bewerken/ }));
    const owner = main.getByRole('combobox', { name: /Owner Unit/ }) as HTMLSelectElement;
    await vi.waitFor(() => expect([...owner.options].map((option) => option.value)).toEqual(['g1', 'g2']));
    expect(main.getByText(/Elke groep van het domein/)).toBeTruthy();
  });

  it('adds Resources without a Collection from the page of a Collection, in a sheet (FR-CO-31)', async () => {
    const calls = serve({ roles: ['datateam'] });
    open('/collections/c1');
    render(App, { config: CONFIG });
    const main = within(await screen.findByRole('main'));
    await fireEvent.click((await main.findAllByRole('button', { name: /Resources toevoegen/ }))[0]!);
    const sheet = within(screen.getByRole('dialog', { name: 'Resources toevoegen aan Credit leads' }));
    expect(sheet.getByText(/^Kwam binnen op 21 okt\.? via de exposure datahub_savedSearches$/)).toBeTruthy();
    const add = sheet.getByRole('button', { name: 'Toevoegen' }) as HTMLButtonElement;
    expect(add.disabled).toBe(true);
    await fireEvent.click(sheet.getByRole('checkbox'));
    await fireEvent.click(sheet.getByRole('button', { name: '1 Resource toevoegen' }));
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(calls).toContainEqual({ method: 'POST', path: '/collections/c1/resources', body: { resources: ['r1'] } });
  });
});
