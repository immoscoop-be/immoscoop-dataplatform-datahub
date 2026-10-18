import type { NodeSummary } from './api.js';

const moment = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
const count = new Intl.NumberFormat('en-GB');

/** `18 Oct 2026, 08:31`, in the time zone of the browser. */
export function formatMoment(iso: string): string {
  return moment.format(new Date(iso));
}

export function formatCount(value: number): string {
  return count.format(value);
}

/** `14 Nodes`, `1 Node`. */
export function plural(value: number, one: string, many = `${one}s`): string {
  return `${formatCount(value)} ${value === 1 ? one : many}`;
}

/** The dbt project of a Node, by name when registry knows it. */
export function projectOf(node: Pick<NodeSummary, 'projectId' | 'projectName'>): string {
  return node.projectName ?? `project ${node.projectId}`;
}

/** The last part of a unique ID: `model.immoscoop_dataplatform_sql.orders` → `orders`. */
export function shortName(uniqueId: string): string {
  return uniqueId.slice(uniqueId.lastIndexOf('.') + 1);
}
