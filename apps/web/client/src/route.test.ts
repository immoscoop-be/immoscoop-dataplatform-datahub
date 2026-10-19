import { describe, expect, it } from 'vitest';
import { hrefFor, parseHash, type Route } from './route.js';

describe('the address of a page', () => {
  it('reads the search, a Node, and the start', () => {
    expect(parseHash('#/search?q=orders%20daily')).toEqual({ page: 'search', query: 'orders daily' });
    expect(parseHash('#/nodes/model.immoscoop_dataplatform_sql.orders')).toEqual({ page: 'node', uniqueId: 'model.immoscoop_dataplatform_sql.orders' });
    expect(parseHash('')).toEqual({ page: 'search', query: '' });
    expect(parseHash('#/')).toEqual({ page: 'search', query: '' });
  });

  it('keeps the dbt project of a search, and only a numeric one', () => {
    expect(parseHash('#/search?q=orders&project=17121')).toEqual({ page: 'search', query: 'orders', project: '17121' });
    expect(parseHash('#/search?project=9367')).toEqual({ page: 'search', query: '', project: '9367' });
    expect(parseHash('#/search?q=orders&project=colleciones')).toEqual({ page: 'search', query: 'orders' });
    expect(hrefFor({ page: 'search', query: '' })).toBe('#/');
  });

  it('reads the charts and one chart', () => {
    expect(parseHash('#/charts')).toEqual({ page: 'charts' });
    expect(parseHash('#/charts/')).toEqual({ page: 'charts' });
    expect(parseHash('#/charts/movingWindowAverage')).toEqual({ page: 'chart', id: 'movingWindowAverage' });
  });

  it('still opens the links of the first page, which held only the unique ID', () => {
    expect(parseHash('#source.compilacion.raw%20leads')).toEqual({ page: 'node', uniqueId: 'source.compilacion.raw leads' });
  });

  it('survives an address that is not encoded properly', () => {
    expect(parseHash('#/nodes/model.p.100%')).toEqual({ page: 'node', uniqueId: 'model.p.100%' });
  });

  it('writes every Route back to the address it was read from', () => {
    const routes: Route[] = [
      { page: 'search', query: '' },
      { page: 'search', query: 'leads & visits' },
      { page: 'search', query: 'orders', project: '17121' },
      { page: 'search', query: '', project: '9367' },
      { page: 'node', uniqueId: 'model.p.a/b#c' },
      { page: 'charts' },
      { page: 'chart', id: 'kpiTile' },
    ];
    for (const route of routes) {
      expect(parseHash(hrefFor(route))).toEqual(route);
    }
  });
});
