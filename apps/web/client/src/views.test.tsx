import { cssVariablesResolver, theme } from '@datahub/ui';
import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { ChartDetail, Collection, Lineage, NodeDetail, Resource, SearchHit } from './api.js';
import { ChartList, ChartView, exampleImage, intentInWords } from './Charts.js';
import { audience, CollectionList, CollectionMark, CollectionView, ColourPicker, IconPicker, ownerUnitOptions, ResourceList } from './Collections.js';
import { MetaTable, metaRows } from './Meta.js';
import { LineageList, NodeView } from './Node.js';
import { ProjectList, SearchResults } from './Search.js';
import { SignIn } from './SignIn.js';

/** The HTML React renders, in the theme of the app, and the text a reader sees in it. */
function render(element: ReactNode) {
  const html = renderToString(
    <QueryClientProvider client={new QueryClient()}>
      <MantineProvider theme={theme} cssVariablesResolver={cssVariablesResolver} forceColorScheme="light">
        {element}
      </MantineProvider>
    </QueryClientProvider>,
  );
  return { html, text: html.replace(/<style[^>]*>.*?<\/style>/gs, '').replace(/<!--.*?-->/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ') };
}

const orders = { uniqueId: 'model.immoscoop_dataplatform_sql.orders', name: 'orders', resourceType: 'model', projectId: '9367', projectName: 'immoscoop_dataplatform_sql', description: 'One row per order.', relation: 'immoscoop-dataplatform.dbt_marts.orders' };

describe('the views of the registry', () => {
  it('shows each dbt project with the run that is its Current Version', () => {
    const { text } = render(
      <ProjectList
        projects={[
          { projectId: '9367', name: 'immoscoop_dataplatform_sql', runId: '56807581', processedAt: '2026-10-18T06:31:00Z', nodeCount: 1234 },
          { projectId: '17121', name: null, runId: null, processedAt: null, nodeCount: 0 },
        ]}
      />,
    );
    expect(text).toContain('immoscoop_dataplatform_sql');
    expect(text).toContain('Run 56807581 · 1,234 Nodes');
    expect(text).toContain('Project 17121 Nothing processed yet');
  });

  it('links every Node found, with the columns that matched', () => {
    const hits: SearchHit[] = [{ ...orders, matchedColumns: ['order_id', 'ordered_at'] }];
    const { html, text } = render(<SearchResults query="order" hits={hits} />);
    expect(text).toContain('1 Node found for “order”');
    expect(html).toContain('href="#/nodes/model.immoscoop_dataplatform_sql.orders"');
    expect(text).toContain('Columns: order_id, ordered_at');
    expect(render(<SearchResults query="nothing" hits={[]} />).text).toContain('Nothing found for “nothing”');
    expect(render(<SearchResults query="order" hits={hits} within="compilacion_colleciones_dbt" />).text).toContain('1 Node found for “order” in compilacion_colleciones_dbt');
    expect(render(<SearchResults query="nothing" hits={[]} within="compilacion_colleciones_dbt" />).text).toContain('Try part of the name, or all projects.');
  });

  it('shows a Node with its details and columns', () => {
    const node: NodeDetail = {
      ...orders,
      materialized: 'table',
      tags: ['marts'],
      filePath: 'models/marts/orders.sql',
      meta: {},
      columns: [{ name: 'order_id', dataType: 'STRING', description: 'The order.' }],
      tests: [{ name: 'relationships_orders_customer_id', columnName: 'customer_id', severity: 'error', targetNodeId: 'model.immoscoop_dataplatform_sql.customers', targetColumn: 'id' }],
    };
    const upstream: Lineage = { direction: 'upstream', truncated: false, nodes: [{ ...orders, distance: 0 }] };
    const downstream: Lineage = {
      direction: 'downstream',
      truncated: true,
      nodes: [
        { ...orders, distance: 0 },
        { ...orders, uniqueId: 'source.compilacion_colleciones_dbt.marts.orders', name: 'orders', resourceType: 'source', projectId: '17121', projectName: 'compilacion_colleciones_dbt', distance: 1 },
      ],
    };
    const { text } = render(<NodeView node={node} upstream={upstream} downstream={downstream} />);
    expect(text).toContain('model immoscoop_dataplatform_sql table');
    expect(text).toContain('Table immoscoop-dataplatform.dbt_marts.orders');
    expect(text).toContain('Columns · 1');
    expect(text).toContain('Tests · 1');
    expect(text).toContain('Lineage · 0 up, 1 down');
    // The first tab is open; the others are rendered once chosen.
    expect(text).toContain('order_id STRING The order.');
  });

  it('lists the lineage nearest first, with the Nodes of the other dbt project', () => {
    const lineage: Lineage = {
      direction: 'downstream',
      truncated: true,
      nodes: [
        { ...orders, distance: 0 },
        { ...orders, uniqueId: 'source.compilacion_colleciones_dbt.marts.orders', resourceType: 'source', projectId: '17121', projectName: 'compilacion_colleciones_dbt', distance: 1 },
      ],
    };
    const { html, text } = render(<LineageList title="Downstream" hint="What is built from this Node" lineage={lineage} />);
    expect(html).toContain('href="#/nodes/source.compilacion_colleciones_dbt.marts.orders"');
    expect(html).not.toContain('href="#/nodes/model.immoscoop_dataplatform_sql.orders"');
    expect(text).toContain('1 orders source · compilacion_colleciones_dbt');
    expect(text).toContain('And more, not shown.');
    expect(render(<LineageList title="Upstream" hint="" lineage={{ direction: 'upstream', truncated: false, nodes: [{ ...orders, distance: 0 }] }} />).text).toContain('Nothing');
  });

  it('explains on the sign-in page why the last sign-in did not work', () => {
    const { html, text } = render(<SignIn problem="Only active accounts of the company can sign in." />);
    expect(html).toContain('href="/auth/login"');
    expect(text).toContain('Only active accounts of the company can sign in.');
    expect(render(<SignIn />).text).not.toContain('You are not signed in');
  });
});

describe('the charts of semgraph', () => {
  const SEMGRAPH = 'https://semgraph.test';
  const example = (name: string, id = 'movingWindowAverage') => ({ name, title: `Credit leads (${name})`, href: `/semgraphs/${id}/examples/${name}` });
  const chart: ChartDetail = {
    id: 'movingWindowAverage',
    title: 'Moving window average',
    answers: 'How does this evolve, without the daily noise?',
    links: { learning: 'https://confluence.test/reading-card', figma: 'https://figma.test/file' },
    examples: [example('basic'), example('daily')],
    exampleQuestions: ['How have credit leads evolved over the last four weeks?'],
    doNotUseWhen: [{ intent: 'compareWithLastYear', use: 'periodComparison' }],
    schema: { properties: { size: {} } },
  };

  it('draws an example as asked, or in the theme and size chosen', () => {
    expect(exampleImage(SEMGRAPH, example('basic'))).toBe('https://semgraph.test/semgraphs/movingWindowAverage/examples/basic');
    expect(exampleImage(SEMGRAPH, example('basic'), { theme: 'dark', size: 'xl' })).toBe('https://semgraph.test/semgraphs/movingWindowAverage/examples/basic?theme=dark&size=xl');
    expect(intentInWords('compareWithLastYear')).toBe('Compare with last year');
  });

  it('shows every chart with the question it answers, and its first example', () => {
    const { html, text } = render(<ChartList catalog={{ semgraphs: [chart, { ...chart, id: 'kpiTile', title: 'KPI tile', examples: [] }], planned: ['funnel', 'survival'] }} semgraphUrl={SEMGRAPH} />);
    expect(html).toContain('href="#/charts/movingWindowAverage"');
    expect(html).toContain('src="https://semgraph.test/semgraphs/movingWindowAverage/examples/basic"');
    expect(text).toContain('Moving window average How does this evolve, without the daily noise? 2 examples');
    expect(text).toContain('KPI tile');
    expect(text).toContain('Still to come: funnel, survival.');
  });

  it('shows a chart with its questions, the chart to use instead, and all its examples', () => {
    const { html, text } = render(<ChartView chart={chart} titles={new Map([['periodComparison', 'Comparison with the previous period']])} semgraphUrl={SEMGRAPH} refusal={async () => undefined} />);
    expect(text).toContain('How have credit leads evolved over the last four weeks?');
    expect(text).toContain('Compare with last year: Comparison with the previous period');
    expect(html).toContain('href="#/charts/periodComparison"');
    expect(html).toContain('href="https://semgraph.test/semgraphs/movingWindowAverage"');
    expect(html).toContain('src="https://semgraph.test/semgraphs/movingWindowAverage/examples/daily"');
    expect(text).toContain('Credit leads (daily)');
    expect(html).toContain('aria-label="Size"');
    // The KPI tile has one size: no choice of size.
    expect(render(<ChartView chart={{ ...chart, schema: {} }} titles={new Map()} semgraphUrl={SEMGRAPH} refusal={async () => undefined} />).html).not.toContain('aria-label="Size"');
  });
});

describe('the metadata of a Node', () => {
  // As a model of Colleciónes has it in its dbt project.
  const meta = {
    model: { kind: 'history', grain: 'stateChange', layer: 'intermediate' },
    domain: {
      entity: 'leadSource',
      identifiers: [{ name: 'leadSourceId', type: 'string' }],
      performedBy: ['subject', 'user'],
      entityDescription: '',
      parents: null,
      deprecated: false,
      version: 2,
    },
  };

  it('gives every key a row, and puts the contents of an object or a list under it, indented', () => {
    expect(metaRows(meta).map((row) => `${'  '.repeat(row.depth)}${row.key}${row.value === undefined ? '' : ` = ${row.value}`}`)).toEqual([
      'model',
      '  kind = history',
      '  grain = stateChange',
      '  layer = intermediate',
      'domain',
      '  entity = leadSource',
      '  identifiers',
      '    1',
      '      name = leadSourceId',
      '      type = string',
      '  performedBy',
      '    1 = subject',
      '    2 = user',
      '  entityDescription = empty',
      '  parents = null',
      '  deprecated = false',
      '  version = 2',
    ]);
    expect(metaRows(meta).filter((row) => row.position).map((row) => row.key)).toEqual(['1', '1', '2']);
    expect(metaRows(meta).filter((row) => row.blank).map((row) => row.key)).toEqual(['entityDescription', 'parents']);
  });

  it('shows the rows as a table of keys and values, deeper keys further in', () => {
    const { html, text } = render(<MetaTable meta={meta} />);
    expect(text).toContain('Key Value model kind history grain stateChange layer intermediate domain entity leadSource identifiers 1 name leadSourceId');
    expect(html).toContain('padding-left:50px');
    expect(render(<MetaTable meta={{}} />).text).toContain('No metadata in the dbt project.');
  });
});

describe('the Collections', () => {
  const leads: Collection = {
    id: '6f1c2e9a-3b7d-4c1e-9a2b-5d8e7f6a1b2c',
    name: 'Leads',
    description: 'Leads of the agencies.',
    colour: 'rose',
    icon: null,
    ownerUnit: { id: 'g-digikom', email: 'digikom@thenextimmoscoop.be', name: 'DigiKom' },
    visibility: 'private',
    createdAt: '2026-10-19T08:00:00Z',
    canManage: true,
  };

  it('lists each Collection in its colour, with who owns it and who sees it', () => {
    const { html, text } = render(<CollectionList collections={[leads, { ...leads, id: 'other', name: 'Web visits', visibility: 'public', canManage: false }]} />);
    expect(html).toContain('href="#/collections/6f1c2e9a-3b7d-4c1e-9a2b-5d8e7f6a1b2c"');
    expect(html).toContain('border-top:4px solid #CC6677');
    expect(text).toContain('Leads Private Leads of the agencies. Owner Unit: DigiKom');
    expect(text).toContain('Web visits Public');
    expect(render(<CollectionList collections={[]} onCreate={() => {}} />).text).toContain('No Collections yet');
  });

  it('shows one Collection with its history, and the buttons to manage it only to those who may', () => {
    const log = [
      { logId: 'COL-004', text: 'Made private by An', at: '2026-10-19T09:00:00Z' },
      { logId: 'COL-001', text: 'Collection created by An', at: '2026-10-19T08:00:00Z' },
    ];
    const { text } = render(<CollectionView collection={leads} log={log} resources={[]} />);
    expect(text).toContain('Owner Unit DigiKom · digikom@thenextimmoscoop.be');
    expect(text).toContain(`Visibility Private ${audience('private')}`);
    expect(text).toContain('No Resources yet');
    expect(text).toContain('Made private by An');
    expect(text).toContain('Edit');
    expect(text).toContain('Dissolve');
    const reader = render(<CollectionView collection={{ ...leads, visibility: 'public', canManage: false }} resources={[]} />).text;
    expect(reader).not.toContain('Edit');
    expect(reader).toContain(audience('public'));
    expect(reader).toContain('No published Resources yet');
  });

  it('lists Resources with their Key, where they come from, and whether they are withdrawn', () => {
    const resource: Resource = {
      id: 'r-1',
      key: 'immoscoop-dataplatform.dbt_marts.orders',
      displayName: 'Orders',
      name: 'orders',
      resourceType: 'model',
      projectId: '9367',
      projectName: 'immoscoop_dataplatform_sql',
      nodeId: 'model.immoscoop_dataplatform_sql.orders',
      description: 'One row per order.',
      exposures: ['datahub_orders'],
      collectionId: leads.id,
      registeredAt: '2026-10-19T08:00:00Z',
      withdrawn: false,
    };
    const { html, text } = render(<ResourceList resources={[resource, { ...resource, id: 'r-2', displayName: 'Lines', withdrawn: true }]} empty="None." linkNodes />);
    expect(text).toContain('Orders model immoscoop-dataplatform.dbt_marts.orders One row per order. Exposed by datahub_orders in immoscoop_dataplatform_sql');
    expect(text).toContain('Lines model Withdrawn');
    expect(text).toContain('it is held until one does again');
    expect(html).toContain('href="#/nodes/model.immoscoop_dataplatform_sql.orders"');
    expect(render(<ResourceList resources={[resource]} empty="None." />).html).not.toContain('href="#/nodes/');
    expect(render(<ResourceList resources={[]} empty="None." />).text).toContain('None.');
  });

  it('marks a Collection with its icon on its colour, or with its colour alone', () => {
    const withIcon = render(<CollectionMark collection={{ colour: 'teal', icon: 'building-estate' }} />).html;
    expect(withIcon).toContain('aria-label="Teal, icon building estate"');
    expect(withIcon).toContain('<svg');
    expect(render(<CollectionMark collection={{ colour: 'rose', icon: null }} />).html).toContain('aria-label="Colour Rose"');
    expect(render(<CollectionList collections={[{ ...leads, icon: 'users' }]} />).html).toContain('aria-label="Rose, icon users"');
  });

  it('offers the icons as an optional, searchable choice', () => {
    const { html } = render(<IconPicker value="map-pin" onChange={() => {}} />);
    expect(html).toContain('value="Map pin"');
    expect(render(<IconPicker value={null} onChange={() => {}} />).html).toContain('placeholder="No icon"');
  });

  it('offers the palette as a choice of one colour', () => {
    const { html } = render(<ColourPicker value="teal" onChange={() => {}} />);
    expect(html.match(/role="radio"/g)).toHaveLength(9);
    expect(html).toMatch(/aria-checked="true"[^>]*aria-label="Teal"/);
  });

  it('offers the groups of the User as Owner Unit, and keeps the current one a Data Admin is not in', () => {
    const sales = { id: 'g-sales', email: 'sales@thenextimmoscoop.be', name: 'Sales' };
    expect(ownerUnitOptions([sales], leads.ownerUnit).map((option) => option.label)).toEqual(['DigiKom', 'Sales']);
    expect(ownerUnitOptions([sales, leads.ownerUnit], leads.ownerUnit).map((option) => option.label)).toEqual(['Sales', 'DigiKom']);
  });
});
