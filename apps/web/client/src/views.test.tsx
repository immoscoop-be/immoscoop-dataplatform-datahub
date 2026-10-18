import { cssVariablesResolver, theme } from '@datahub/ui';
import { MantineProvider } from '@mantine/core';
import type { ReactNode } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Lineage, NodeDetail, SearchHit } from './api.js';
import { LineageList, NodeView } from './Node.js';
import { ProjectList, SearchResults } from './Search.js';
import { SignIn } from './SignIn.js';

/** The HTML React renders, in the theme of the app, and the text a reader sees in it. */
function render(element: ReactNode) {
  const html = renderToString(
    <MantineProvider theme={theme} cssVariablesResolver={cssVariablesResolver} forceColorScheme="light">
      {element}
    </MantineProvider>,
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
  });

  it('shows a Node with its details and columns', () => {
    const node: NodeDetail = {
      ...orders,
      materialized: 'table',
      tags: ['marts'],
      filePath: 'models/marts/orders.sql',
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
