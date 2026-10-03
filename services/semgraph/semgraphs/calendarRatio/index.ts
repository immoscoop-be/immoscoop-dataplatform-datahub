import { CalendarChart } from '../../src/charts/calendar-chart.ts';
import { Ratio } from '../../src/charts/statistics.ts';

/** A share per calendar period: its numerator and denominator, the share as a line, the denominator as its base (REQ-076). */
export class CalendarRatio extends CalendarChart {
  constructor() {
    super('calendarRatio', new Ratio());
  }
}
