import { Table, Text } from '@mantine/core';

/** One line of the meta table: a key with its value, or with the keys of an object or list under it. */
export interface MetaRow {
  key: string;
  /** How deep it sits: 0 for the keys at the top. */
  depth: number;
  /** The value as text; absent for an object or a list, whose contents follow in the next rows. */
  value?: string;
  /** A position in a list rather than a name. */
  position: boolean;
  /** An empty text or a null, shown as such rather than as nothing. */
  blank: boolean;
}

/** Lays the meta of a Node out as rows, depth first: a list gets its positions as keys, from 1. */
export function metaRows(meta: Record<string, unknown>): MetaRow[] {
  const rows: MetaRow[] = [];
  const add = (key: string, value: unknown, depth: number, position: boolean) => {
    if (Array.isArray(value)) {
      rows.push({ key, depth, position, blank: false });
      value.forEach((item, index) => add(String(index + 1), item, depth + 1, true));
    } else if (value !== null && typeof value === 'object') {
      rows.push({ key, depth, position, blank: false });
      for (const [childKey, child] of Object.entries(value)) {
        add(childKey, child, depth + 1, false);
      }
    } else if (value === null || value === '') {
      rows.push({ key, depth, value: value === null ? 'null' : 'empty', position, blank: true });
    } else {
      rows.push({ key, depth, value: String(value), position, blank: false });
    }
  };
  for (const [key, value] of Object.entries(meta)) {
    add(key, value, 0, false);
  }
  return rows;
}

/** The meta of a Node from its dbt project, as a table of keys and values, nested by indentation. */
export function MetaTable({ meta }: { meta: Record<string, unknown> }) {
  const rows = metaRows(meta);
  if (rows.length === 0) {
    return <Text c="dimmed">No metadata in the dbt project.</Text>;
  }
  return (
    <Table.ScrollContainer minWidth={560}>
      <Table verticalSpacing={6} highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th w="32%">Key</Table.Th>
            <Table.Th>Value</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rows.map((row, index) => (
            <Table.Tr key={index}>
              <Table.Td style={{ paddingLeft: 10 + row.depth * 20, overflowWrap: 'anywhere' }} fw={row.value === undefined ? 600 : 500} c={row.position ? 'dimmed' : undefined}>
                {row.key}
              </Table.Td>
              <Table.Td style={{ overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }} c={row.blank ? 'dimmed' : undefined} fs={row.blank ? 'italic' : undefined}>
                {row.value ?? ''}
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}
