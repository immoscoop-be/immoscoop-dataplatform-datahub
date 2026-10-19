import { Anchor, Badge, Box, Code, DataList, Group, SimpleGrid, Stack, Table, Tabs, Text, Title } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { Api, Lineage, NodeDetail } from './api.js';
import { plural, projectOf, shortName } from './format.js';
import { BackIcon } from './icons.js';
import { MetaTable } from './Meta.js';
import { hrefFor, type SearchRoute } from './route.js';
import { Loading, Problem } from './Search.js';

/** One Node of a dbt project, with its columns, tests and lineage across both projects. */
export function NodePage({ api, uniqueId, backTo }: { api: Api; uniqueId: string; /** The search to go back to. */ backTo: Omit<SearchRoute, 'page'> }) {
  const node = useQuery({ queryKey: ['node', uniqueId], queryFn: () => api.node(uniqueId) });
  const upstream = useQuery({ queryKey: ['lineage', uniqueId, 'upstream'], queryFn: () => api.lineage(uniqueId, 'upstream') });
  const downstream = useQuery({ queryKey: ['lineage', uniqueId, 'downstream'], queryFn: () => api.lineage(uniqueId, 'downstream') });

  return (
    <Stack gap="xl" maw={980}>
      <Anchor href={hrefFor({ page: 'search', ...backTo })} size="sm" c="dimmed">
        <Group gap={6}>
          <BackIcon size={16} />
          {backTo.query ? `Results for “${backTo.query}”` : 'Search'}
        </Group>
      </Anchor>
      {node.isPending || upstream.isPending || downstream.isPending ? (
        <Loading rows={3} />
      ) : node.isError ? (
        <Problem title="This Node could not be read">{node.error.message}</Problem>
      ) : upstream.isError || downstream.isError ? (
        <Problem title="The lineage could not be read">{(upstream.error ?? downstream.error)?.message ?? ''}</Problem>
      ) : (
        <NodeView node={node.data} upstream={upstream.data} downstream={downstream.data} />
      )}
    </Stack>
  );
}

export interface NodeViewProps {
  node: NodeDetail;
  upstream: Lineage;
  downstream: Lineage;
}

export function NodeView({ node, upstream, downstream }: NodeViewProps) {
  const reached = (lineage: Lineage) => lineage.nodes.filter((other) => other.distance > 0).length;
  return (
    <Stack gap="xl">
      <Stack gap="sm">
        <Group gap="xs">
          <Badge variant="light" color="teal">
            {node.resourceType}
          </Badge>
          <Badge variant="light" color="gray">
            {projectOf(node)}
          </Badge>
          {node.materialized && (
            <Badge variant="outline" color="gray">
              {node.materialized}
            </Badge>
          )}
        </Group>
        <Title order={1} style={{ overflowWrap: 'anywhere' }}>
          {node.name}
        </Title>
        {node.description ? (
          <Text maw={720} style={{ whiteSpace: 'pre-line' }}>
            {node.description}
          </Text>
        ) : (
          <Text c="dimmed">No description.</Text>
        )}
      </Stack>
      <DataList size="sm" orientation="horizontal" labelWidth={120}>
        {node.relation && <Detail label="Table" value={<Code>{node.relation}</Code>} />}
        {node.filePath && <Detail label="File" value={<Code>{node.filePath}</Code>} />}
        {node.tags.length > 0 && <Detail label="Tags" value={node.tags.join(', ')} />}
        <Detail label="Unique ID" value={<Code>{node.uniqueId}</Code>} />
      </DataList>
      <Tabs defaultValue="columns" keepMounted={false}>
        <Tabs.List>
          <Tabs.Tab value="columns">Columns · {node.columns.length}</Tabs.Tab>
          <Tabs.Tab value="tests">Tests · {node.tests.length}</Tabs.Tab>
          <Tabs.Tab value="lineage">
            Lineage · {reached(upstream)} up, {reached(downstream)} down
          </Tabs.Tab>
          <Tabs.Tab value="metadata">Metadata</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="columns" pt="lg">
          <Columns node={node} />
        </Tabs.Panel>
        <Tabs.Panel value="tests" pt="lg">
          <Tests node={node} />
        </Tabs.Panel>
        <Tabs.Panel value="lineage" pt="lg">
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing={48}>
            <LineageList title="Upstream" hint="What this Node is built from" lineage={upstream} />
            <LineageList title="Downstream" hint="What is built from this Node" lineage={downstream} />
          </SimpleGrid>
        </Tabs.Panel>
        <Tabs.Panel value="metadata" pt="lg">
          <MetaTable meta={node.meta} />
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}

export function Detail({ label, value }: { label: string; value: ReactNode }) {
  return (
    <DataList.Item>
      <DataList.ItemLabel>{label}</DataList.ItemLabel>
      <DataList.ItemValue style={{ overflowWrap: 'anywhere' }}>{value}</DataList.ItemValue>
    </DataList.Item>
  );
}

function Columns({ node }: { node: NodeDetail }) {
  if (node.columns.length === 0) {
    return <Text c="dimmed">No columns known.</Text>;
  }
  return (
    <Table.ScrollContainer minWidth={560}>
      <Table verticalSpacing="sm" highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th w="28%">Name</Table.Th>
            <Table.Th w="16%">Type</Table.Th>
            <Table.Th>Description</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {node.columns.map((column) => (
            <Table.Tr key={column.name}>
              <Table.Td fw={500} style={{ overflowWrap: 'anywhere' }}>
                {column.name}
              </Table.Td>
              <Table.Td c="dimmed" ff="monospace" fz="xs">
                {column.dataType ?? ''}
              </Table.Td>
              <Table.Td>{column.description || <Text span c="dimmed" size="sm">No description</Text>}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}

function Tests({ node }: { node: NodeDetail }) {
  if (node.tests.length === 0) {
    return <Text c="dimmed">No tests.</Text>;
  }
  return (
    <Table.ScrollContainer minWidth={560}>
      <Table verticalSpacing="sm" highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Test</Table.Th>
            <Table.Th>Column</Table.Th>
            <Table.Th>Refers to</Table.Th>
            <Table.Th>Severity</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {node.tests.map((test) => (
            <Table.Tr key={test.name}>
              <Table.Td style={{ overflowWrap: 'anywhere' }}>{test.name}</Table.Td>
              <Table.Td>{test.columnName ?? ''}</Table.Td>
              <Table.Td>
                {test.targetNodeId && (
                  <Anchor href={hrefFor({ page: 'node', uniqueId: test.targetNodeId })} size="sm">
                    {shortName(test.targetNodeId)}
                    {test.targetColumn ? `.${test.targetColumn}` : ''}
                  </Anchor>
                )}
              </Table.Td>
              <Table.Td c="dimmed">{test.severity ?? ''}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}

/** The Nodes one way along the lineage, nearest first; those of the other dbt project included. */
export function LineageList({ title, hint, lineage }: { title: string; hint: string; lineage: Lineage }) {
  const others = lineage.nodes.filter((other) => other.distance > 0);
  return (
    <Stack gap="sm">
      <Box>
        <Title order={2} size="h4">
          {title}
        </Title>
        <Text size="sm" c="dimmed">
          {hint}
        </Text>
      </Box>
      {others.length === 0 ? (
        <Text size="sm" c="dimmed">
          Nothing
        </Text>
      ) : (
        <Stack gap={0}>
          {others.map((other) => (
            <Group key={other.uniqueId} gap="sm" wrap="nowrap" py={8} style={{ borderTop: '1px solid var(--mantine-color-gray-2)' }}>
              <Badge circle variant="light" color="gray" size="lg" title={`${plural(other.distance, 'step')} away`}>
                {other.distance}
              </Badge>
              <Box miw={0}>
                <Anchor href={hrefFor({ page: 'node', uniqueId: other.uniqueId })} size="sm" fw={600} style={{ overflowWrap: 'anywhere' }}>
                  {other.name}
                </Anchor>
                <Text size="xs" c="dimmed">
                  {other.resourceType} · {projectOf(other)}
                </Text>
              </Box>
            </Group>
          ))}
          {lineage.truncated && (
            <Text size="sm" c="dimmed" pt="sm">
              And more, not shown.
            </Text>
          )}
        </Stack>
      )}
    </Stack>
  );
}
