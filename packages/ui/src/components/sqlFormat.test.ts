import { describe, expect, it } from 'vitest';
import { formatBigQuery } from './sqlFormat.js';

describe('Format, in the house layout of the Data Team (DEC-UX-228)', () => {
  it('writes keywords, functions, types and date parts in lower case, indented by 4, a call on one line up to 100 characters', () => {
    const sql = [
      '-- Vorken van 30 volle dagen',
      'WITH leads AS (',
      "  SELECT eventId, DIV(DATE_DIFF(CURRENT_DATE('Europe/Brussels'), DATE(collectorDatetime, 'Europe/Brussels'), DAY) - 1, 30) AS vork",
      '  FROM `immoscoop-dataplatform-398214.colleciones_dbt.intm_creditlead__attributed`',
      "  WHERE collectorDatetime >= TIMESTAMP(DATE_SUB(CURRENT_DATE('Europe/Brussels'), INTERVAL 30 * @aantal_vorken DAY), 'Europe/Brussels')",
      ')',
      "SELECT vork + 1 AS vork_nr, DATE_SUB(CURRENT_DATE('Europe/Brussels'), INTERVAL (vork + 1) * 30 DAY) AS vork_van, COUNT(DISTINCT eventId) AS leads",
      'FROM leads GROUP BY vork ORDER BY vork',
    ].join('\n');
    expect(formatBigQuery(sql)).toBe(
      [
        '-- Vorken van 30 volle dagen',
        'with',
        '',
        'leads as (',
        '    select',
        '        eventId,',
        "        div(date_diff(current_date('Europe/Brussels'), date(collectorDatetime, 'Europe/Brussels'), day) - 1, 30) as vork",
        '    from',
        '        `immoscoop-dataplatform-398214.colleciones_dbt.intm_creditlead__attributed`',
        '    where',
        "        collectorDatetime >= timestamp(date_sub(current_date('Europe/Brussels'), interval 30 * @aantal_vorken day), 'Europe/Brussels')",
        ')',
        '',
        'select',
        '    vork + 1 as vork_nr,',
        "    date_sub(current_date('Europe/Brussels'), interval (vork + 1) * 30 day) as vork_van,",
        '    count(distinct eventId) as leads',
        'from',
        '    leads',
        'group by',
        '    vork',
        'order by',
        '    vork',
      ].join('\n'),
    );
  });

  it('puts a blank line between CTEs, and never changes text in quotes, comments or names in backticks', () => {
    const sql = "with a as (select 'DAY' as x -- DAY stays\nfrom `p.DAY.t`), b as (select * from a) select * from b";
    expect(formatBigQuery(sql)).toBe(
      ['with', '', 'a as (', '    select', "        'DAY' as x -- DAY stays", '    from', '        `p.DAY.t`', '),', '', 'b as (', '    select', '        *', '    from', '        a', ')', '', 'select', '    *', 'from', '    b'].join('\n'),
    );
  });
});
