import { CategoryChart } from '../../src/charts/category-chart.ts';

/** Categories as bars, after Figma's Chart/Bar: the total, the mean or the median per category. */
export class CategoryComparison extends CategoryChart {
  constructor() {
    super('categoryComparison');
  }
}
