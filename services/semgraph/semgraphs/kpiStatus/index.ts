import { KpiStatusChart } from '../../src/charts/kpi-status.ts';

/** Where a KPI stands against its target and its fixed path, after Figma's Chart/KPI status (REQ-065, REQ-068, REQ-069). */
export class KpiStatus extends KpiStatusChart {
  constructor() {
    super('kpiStatus');
  }
}
