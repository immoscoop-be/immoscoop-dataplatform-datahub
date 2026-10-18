import { KpiTileChart } from '../../src/charts/kpi-tile.ts';

/** One number with a mandatory comparison and a mini trend, after Figma's Chart/KPI tile (REQ-065, REQ-067). */
export class KpiTile extends KpiTileChart {
  constructor() {
    super('kpiTile');
  }
}
