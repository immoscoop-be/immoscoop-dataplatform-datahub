import { describe, expect, it } from 'vitest';
import { chartPath, contextPath, digPath, edaPath, probePath, editLensPath, GROUPS, groupPath, learningPath, messagePath, messagesOnPath, NEW_GROUP, newLensForPath, objectPath, queryRunsPath, resourcePath, route, seePath, usersPath } from './routes.js';

describe('the addresses of the web app', () => {
  it('opens on the start screen of Collections', () => {
    expect(route('/')).toEqual({ kind: 'redirect', to: '/collections' });
  });

  it('has a start screen per section, with or without a slash at the end', () => {
    for (const id of ['collections', 'query', 'learning']) {
      expect(route(`/${id}`)).toMatchObject({ kind: 'start', section: { id } });
      expect(route(`/${id}/`)).toMatchObject({ kind: 'start', section: { id } });
    }
    // Messages starts on the Message Centre (FR-CV-06).
    expect(route('/messages/')).toMatchObject({ kind: 'messages', id: null, section: { id: 'messages' } });
  });

  it('opens Charts on its first chart, and has a page per chart of semgraph (FR-CH-06, DEC-UX-182)', () => {
    expect(route('/charts')).toEqual({ kind: 'redirect', to: '/charts/movingWindowAverage' });
    expect(route('/charts/')).toEqual({ kind: 'redirect', to: '/charts/movingWindowAverage' });
    expect(route('/charts/kpiTile')).toMatchObject({ kind: 'chart', id: 'kpiTile', section: { id: 'charts' } });
    expect(route(chartPath('kpiStatus'))).toMatchObject({ kind: 'chart', id: 'kpiStatus' });
    expect(route('/charts/%E0%A4%A')).toEqual({ kind: 'notFound' });
    expect(route('/charts/kpiTile/examples')).toEqual({ kind: 'notFound' });
  });

  it('has the EDA of a Resource in the section EDA, a tab of it and the detail of an EDA-Probe at an address of their own (DEC-UX-321, DEC-UX-324)', () => {
    expect(route('/eda')).toMatchObject({ kind: 'start', section: { id: 'eda' } });
    expect(route('/eda/r-1')).toMatchObject({ kind: 'eda', id: 'r-1', tab: 'steps', probe: null, section: { id: 'eda' } });
    expect(route('/eda/r-1/profile')).toMatchObject({ kind: 'eda', id: 'r-1', tab: 'profile', probe: null });
    expect(route('/eda/r-1/overview/')).toMatchObject({ kind: 'eda', tab: 'overview' });
    expect(route('/eda/r-1/probes/nullsPerKeyField')).toMatchObject({ kind: 'eda', id: 'r-1', tab: 'steps', probe: 'nullsPerKeyField' });
    expect(edaPath('r-1')).toBe('/eda/r-1');
    expect(edaPath('r-1', 'profile')).toBe('/eda/r-1/profile');
    expect(probePath('r-1', 'grainHolds')).toBe('/eda/r-1/probes/grainHolds');
    // Steps is the address of the EDA itself; an EDA-Probe that does not exist, or a tab that does not, is no page.
    expect(route('/eda/r-1/steps')).toEqual({ kind: 'notFound' });
    expect(route('/eda/r-1/probes/rowsAndMore')).toEqual({ kind: 'notFound' });
    expect(route('/eda/r-1/probes')).toEqual({ kind: 'notFound' });
    expect(route('/eda/%E0%A4%A')).toEqual({ kind: 'notFound' });
  });

  it('has Dig into a selection of rows in the tab Steps, the selection in the query of its address (FR-ED-20)', () => {
    const selection = { where: [{ kind: 'saysNothing' as const, field: 'lead_channel' }, { kind: 'equals' as const, field: 'lead_source', value: 'app & more' }] };
    const path = digPath('r-1', selection, 'disguisedNulls');
    expect(path.startsWith('/eda/r-1/dig?from=disguisedNulls&selection=')).toBe(true);
    expect(route(path)).toMatchObject({ kind: 'eda', id: 'r-1', tab: 'steps', probe: null, dig: { selection, from: 'disguisedNulls' }, section: { id: 'eda' } });
    expect(route(digPath('r-1', selection))).toMatchObject({ kind: 'eda', dig: { selection, from: null } });
    // The query belongs to Dig into alone: elsewhere it changes nothing.
    expect(route('/eda/r-1?selection=x')).toMatchObject({ kind: 'eda', tab: 'steps', probe: null });
    expect(route('/eda/r-1?selection=x')).not.toHaveProperty('dig');
    expect(route('/resources/r1/gaps?error=x')).toMatchObject({ kind: 'resource', id: 'r1', at: 'gaps' });
    // No selection, or one eda would not dig into, is no page; an EDA-Probe that does not exist leads nowhere.
    expect(route('/eda/r-1/dig')).toEqual({ kind: 'notFound' });
    expect(route(`/eda/r-1/dig?selection=${encodeURIComponent('{"where":[]}')}`)).toEqual({ kind: 'notFound' });
    expect(route(`/eda/r-1/dig?selection=${encodeURIComponent('{"where":[{"kind":"like","field":"x"}]}')}`)).toEqual({ kind: 'notFound' });
    expect(route(digPath('r-1', selection).replace('dig?', 'dig?from=rowsAndMore&'))).toMatchObject({ dig: { from: null } });
  });

  it('has a page per Resource, in the section Collections', () => {
    expect(route('/resources/0d4b1f0e-2a8e')).toMatchObject({ kind: 'resource', id: '0d4b1f0e-2a8e', section: { id: 'collections' } });
    expect(route('/resources/%E0%A4%A')).toEqual({ kind: 'notFound' });
    expect(route('/resources/a/b')).toEqual({ kind: 'notFound' });
    // A spot on its page: a tab, or a part of its Overview, which a link from Claude opens (DEC-CL-19).
    expect(route('/resources/r1/gaps')).toMatchObject({ kind: 'resource', id: 'r1', at: 'gaps' });
    expect(route('/resources/r1/columns')).toMatchObject({ kind: 'resource', id: 'r1', at: 'columns' });
    expect(route('/resources/r1/gaps/messages')).toMatchObject({ kind: 'resource', id: 'r1', at: 'gaps', messages: true });
    expect(resourcePath('r1', 'behaviour')).toBe('/resources/r1/behaviour');
  });

  it('has a page per Collection, and an empty one to make a new Collection (FR-CO-12, FR-CO-25)', () => {
    expect(route('/collections/c-1')).toMatchObject({ kind: 'collection', id: 'c-1', section: { id: 'collections' } });
    expect(route('/collections/new')).toMatchObject({ kind: 'newCollection', section: { id: 'collections' } });
    expect(route('/collections/c-1/log')).toEqual({ kind: 'notFound' });
    expect(route('/collections/c-1/folders/f-1')).toMatchObject({ kind: 'folder', collection: 'c-1', id: 'f-1', section: { id: 'collections' } });
    expect(route('/collections/c-1/folders')).toEqual({ kind: 'notFound' });
  });

  it('has a page per query, and a new query, also on a Resource, in the section Query (FR-SR-41, FR-SR-46)', () => {
    expect(route('/query/9f1c')).toMatchObject({ kind: 'query', id: '9f1c', section: { id: 'query' } });
    expect(route('/query/new')).toMatchObject({ kind: 'newQuery', resource: null, section: { id: 'query' } });
    expect(route('/query/new/r-1')).toMatchObject({ kind: 'newQuery', resource: 'r-1', section: { id: 'query' } });
    expect(route('/query/%E0%A4%A')).toEqual({ kind: 'notFound' });
    // Its history, at all its runs or at one, as the panel opens it (DEC-UX-74).
    expect(route('/query/9f1c')).toMatchObject({ run: null });
    expect(route('/query/9f1c/runs')).toMatchObject({ kind: 'query', id: '9f1c', run: 'all' });
    expect(route('/query/9f1c/runs/14')).toMatchObject({ kind: 'query', id: '9f1c', run: 14 });
    expect(queryRunsPath('9f1c', 14)).toBe('/query/9f1c/runs/14');
    expect(route('/query/9f1c/runs/0')).toEqual({ kind: 'notFound' });
    expect(route('/query/9f1c/rows')).toEqual({ kind: 'notFound' });
  });

  it('makes a Lens from a query in Query, and has a page per Lens under Collections (DEC-UX-25, DEC-UX-66)', () => {
    expect(route('/query/9f1c/lens')).toMatchObject({ kind: 'newLens', query: '9f1c', section: { id: 'query' } });
    expect(route('/lenses/7c1f')).toMatchObject({ kind: 'lens', id: '7c1f', section: { id: 'collections' } });
    expect(route('/lenses/7c1f/about')).toEqual({ kind: 'notFound' });
    // Its Owner Unit edits it (FR-LE-06); "New Lens" on a Collection starts a new query for it (DEC-UX-123).
    expect(route(editLensPath('7c1f'))).toMatchObject({ kind: 'editLens', id: '7c1f', section: { id: 'collections' } });
    expect(route(newLensForPath('c-1'))).toMatchObject({ kind: 'newQuery', resource: null, forCollection: 'c-1', section: { id: 'query' } });
  });

  it('has the Message Centre, the Messages on an object and one Message in context (FR-CV-06, FR-CV-07, FR-CV-09)', () => {
    expect(route('/messages')).toMatchObject({ kind: 'messages', id: null, section: { id: 'messages' } });
    expect(route(messagePath('m-1'))).toMatchObject({ kind: 'messages', id: 'm-1', section: { id: 'messages' } });
    expect(route(messagesOnPath({ kind: 'resource', id: 'r-1' }))).toMatchObject({ kind: 'resource', id: 'r-1', messages: true });
    expect(route(contextPath({ kind: 'lens', id: '7c1f' }, 'm-2'))).toMatchObject({ kind: 'lens', id: '7c1f', message: 'm-2', section: { id: 'collections' } });
    expect(route(contextPath({ kind: 'collection', id: 'c-1' }, 'm-3'))).toMatchObject({ kind: 'collection', id: 'c-1', message: 'm-3' });
    // A query has no slide-in of its own; its Request opens on it in context.
    expect(route(contextPath({ kind: 'query', id: '9f1c' }, 'm-4'))).toMatchObject({ kind: 'query', id: '9f1c', run: null, message: 'm-4' });
    expect(route('/query/9f1c/messages')).toEqual({ kind: 'notFound' });
    expect(route('/messages/m-1/replies')).toEqual({ kind: 'notFound' });
    expect(route('/lenses/7c1f/edit/messages')).toEqual({ kind: 'notFound' });
  });

  it('has a page per Learning Card by its number, See it on its own, and its Messages (FR-LR-06, FR-LR-27, FR-LR-29)', () => {
    expect(route(learningPath('K3.4'))).toMatchObject({ kind: 'learningCard', id: 'K3.4', section: { id: 'learning' } });
    expect(route(seePath('1.2.2'))).toMatchObject({ kind: 'learningSee', id: '1.2.2', section: { id: 'learning' } });
    expect(route(messagesOnPath({ kind: 'learningCard', id: 'K3.4' }))).toMatchObject({ kind: 'learningCard', id: 'K3.4', messages: true });
    expect(route(contextPath({ kind: 'learningCard', id: '1.2.2' }, 'm-5'))).toMatchObject({ kind: 'learningCard', id: '1.2.2', message: 'm-5', section: { id: 'learning' } });
    expect(route('/learning/1.2.2/see/messages')).toEqual({ kind: 'notFound' });
    expect(route('/learning/1.2.2/check')).toEqual({ kind: 'notFound' });
    expect(route('/learning/%E0%A4%A')).toEqual({ kind: 'notFound' });
  });

  it('has My page, with the tabs Profile and Background (DEC-UX-84, DEC-UX-108)', () => {
    expect(route('/me')).toEqual({ kind: 'me', tab: 'profile' });
    expect(route('/me/background')).toEqual({ kind: 'me', tab: 'background' });
    expect(route('/me/keys')).toEqual({ kind: 'me', tab: 'keys' });
  });

  it('has Groups, outside the sections of the rail: the list, one Group opened, and a new one (FR-UM-13, FR-UM-18, DEC-UX-200)', () => {
    expect(route('/groups')).toEqual({ kind: 'groups', id: null });
    expect(route('/groups/')).toEqual({ kind: 'groups', id: null });
    expect(route(GROUPS)).toEqual({ kind: 'groups', id: null });
    expect(route('/groups/new')).toEqual({ kind: 'groups', id: null, making: true });
    expect(route(NEW_GROUP)).toEqual({ kind: 'groups', id: null, making: true });
    expect(route('/groups/7b0c6f2e-41d2')).toEqual({ kind: 'groups', id: '7b0c6f2e-41d2' });
    expect(groupPath('03ep 43')).toBe('/groups/03ep%2043');
    expect(route(groupPath('03ep 43'))).toEqual({ kind: 'groups', id: '03ep 43' });
    expect(route('/groups/%E0%A4%A')).toEqual({ kind: 'notFound' });
    expect(route('/groups/g-1/members')).toEqual({ kind: 'notFound' });
  });

  it('has Admin, which opens on its first tool, Webhooks (DEC-UX-130, OP-UX-52)', () => {
    expect(route('/admin')).toEqual({ kind: 'redirect', to: '/admin/webhooks' });
    expect(route('/admin/')).toEqual({ kind: 'redirect', to: '/admin/webhooks' });
    expect(route('/admin/webhooks')).toMatchObject({ kind: 'admin', tool: 'webhooks', section: { id: 'admin' } });
    expect(route('/admin/webhooks/')).toMatchObject({ kind: 'admin', tool: 'webhooks', section: { id: 'admin' } });
    expect(route('/admin/keys')).toMatchObject({ kind: 'admin', tool: 'keys', section: { id: 'admin' } });
    expect(route('/admin/tokens')).toEqual({ kind: 'notFound' });
  });

  it('has Users and Permission groups in Admin, Users also with one User opened, and opens on the first tool the User may (FR-PL-06, FR-PL-09)', () => {
    expect(route('/admin/users')).toMatchObject({ kind: 'admin', tool: 'users' });
    expect(route('/admin/users/1234%205')).toMatchObject({ kind: 'admin', tool: 'users', user: '1234 5' });
    expect(route('/admin/permission-groups')).toMatchObject({ kind: 'admin', tool: 'permissionGroups' });
    expect(route('/admin', ['users', 'permissionGroups'])).toEqual({ kind: 'redirect', to: '/admin/users' });
    expect(usersPath('42')).toBe('/admin/users/42');
  });

  it('leads a Message about a User to My page, and one to the Data Team to that User on Users (FR-PL-12)', () => {
    expect(objectPath({ kind: 'user', id: '42' }, 'MSG-USR-01')).toBe('/me');
    expect(objectPath({ kind: 'user', id: '42' }, 'MSG-USR-02')).toBe('/admin/users/42');
    // A Project shared with the User, or deleted, opens its page; taken out of it, Query (MSG-QRY-03 to MSG-QRY-05).
    expect(objectPath({ kind: 'user', id: '42' }, 'MSG-QRY-03', { projectId: 'p1' })).toBe('/query/projects/p1');
    expect(objectPath({ kind: 'user', id: '42' }, 'MSG-QRY-05', { projectId: 'p1' })).toBe('/query/projects/p1');
    expect(objectPath({ kind: 'user', id: '42' }, 'MSG-QRY-04', { projectId: 'p1' })).toBe('/query');
    expect(route('/query/projects/p1')).toMatchObject({ kind: 'project', id: 'p1' });
    expect(route('/query/projects')).toMatchObject({ kind: 'projects' });
    expect(objectPath({ kind: 'user', id: '42' }, 'MSG-USR-03')).toBe('/admin/users/42');
  });

  it('shows the one page for what does not exist, or may not be seen, at every other address (DEC-UX-32)', () => {
    for (const path of ['/me/profile', '/me/tokens', '/collections/c-1/edit', '/lenses', '/x']) {
      expect([path, route(path)]).toEqual([path, { kind: 'notFound' }]);
    }
  });
});
