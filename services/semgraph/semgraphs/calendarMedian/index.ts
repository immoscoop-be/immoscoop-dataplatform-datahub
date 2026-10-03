import { CalendarChart } from '../../src/charts/calendar-chart.ts';
import { Median } from '../../src/charts/statistics.ts';

/** Per calendar period, the median of its daily values, with P25–P75. */
export class CalendarMedian extends CalendarChart {
  constructor() {
    super('calendarMedian', new Median());
  }
}
