import { CalendarChart } from '../../src/charts/calendar-chart.ts';
import { Average } from '../../src/charts/statistics.ts';

/** Per calendar period, the mean of its daily values, with ±1 sd. */
export class CalendarAverage extends CalendarChart {
  constructor() {
    super('calendarAverage', new Average());
  }
}
