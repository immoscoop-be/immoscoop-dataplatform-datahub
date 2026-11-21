import { describe, expect, it } from 'vitest';
import { LEADS, WEEKLY } from '../testing.js';
import { settingOf } from './index.js';

describe('what an EDA-Probe is set on when it runs (DEC-ED-13, DEC-ED-17)', () => {
  it('sets each on what it applies to by default, in the order of the Resource Card', () => {
    expect(settingOf('grainHolds', WEEKLY, {})).toEqual({ fields: ['week_start', 'lead_source'], params: {} });
    expect(settingOf('nullsPerKeyField', WEEKLY, {})).toEqual({ fields: ['week_start', 'lead_source', 'lead_count', 'lead_channel'], params: {} });
    expect(settingOf('volumeOverTime', WEEKLY, {})).toEqual({ fields: ['week_start'], params: {} });
    expect(settingOf('distributionOfNumbers', WEEKLY, {})).toEqual({ fields: ['lead_count'], params: {} });
    expect(settingOf('volumeOverTime', LEADS, {})).toEqual({ fields: ['created_at'], params: {} });
    // Date range on the date its role names; Distribution of categories on the texts among the Key Fields, mapped ones too.
    expect(settingOf('dateRange', WEEKLY, {})).toEqual({ fields: ['week_start'], params: {} });
    expect(settingOf('dateRange', LEADS, {})).toEqual({ fields: ['created_at'], params: {} });
    expect(settingOf('distributionOfCategories', WEEKLY, {})).toEqual({ fields: ['lead_source', 'lead_channel'], params: {} });
    expect(settingOf('distributionOfCategories', LEADS, {})).toEqual({ fields: ['lead_id', 'channel'], params: {} });
  });

  it('takes the fields chosen, of the kind it reads, in the order of the Resource Card', () => {
    expect(settingOf('nullsPerKeyField', WEEKLY, { fields: ['lead_origin', 'week_start'] })).toEqual({ fields: ['week_start', 'lead_origin'], params: {} });
    expect(settingOf('volumeOverTime', WEEKLY, { fields: ['loaded_at', 'week_start'], params: { measure: null } })).toEqual({ fields: ['week_start', 'loaded_at'], params: { measure: null } });
    expect(settingOf('distributionOfNumbers', WEEKLY, { fields: ['unique_applicants', 'lead_count'] })).toEqual({ fields: ['lead_count', 'unique_applicants'], params: {} });
    expect(settingOf('distributionOfNumbers', WEEKLY, { fields: ['lead_channel'] })).toEqual({ problem: 'invalid', message: 'lead_channel is not a number, which Distribution of numbers is set on.' });
    expect(settingOf('volumeOverTime', WEEKLY, { fields: ['lead_count'] })).toMatchObject({ problem: 'invalid', message: expect.stringMatching(/not a date/) });
    expect(settingOf('nullsPerKeyField', WEEKLY, { fields: ['nope'] })).toEqual({ problem: 'invalid', message: 'nope is no field of this Resource.' });
    expect(settingOf('nullsPerKeyField', WEEKLY, { fields: [] })).toEqual({ problem: 'invalid', message: 'Choose at least one field.' });
    expect(settingOf('dateRange', WEEKLY, { fields: ['loaded_at', 'week_start'] })).toEqual({ fields: ['week_start', 'loaded_at'], params: {} });
    expect(settingOf('dateRange', WEEKLY, { fields: ['lead_source'] })).toEqual({ problem: 'invalid', message: 'lead_source is not a date, which Date range is set on.' });
    expect(settingOf('distributionOfCategories', WEEKLY, { fields: ['lead_origin', 'lead_source'] })).toEqual({ fields: ['lead_source', 'lead_origin'], params: {} });
    expect(settingOf('distributionOfCategories', WEEKLY, { fields: ['lead_count'] })).toEqual({ problem: 'invalid', message: 'lead_count is not a text, which Distribution of categories is set on.' });
    // The grain holds reads the grain as recorded, all of it.
    expect(settingOf('grainHolds', WEEKLY, { fields: ['week_start'] })).toMatchObject({ problem: 'invalid' });
    expect(settingOf('grainHolds', WEEKLY, { fields: ['lead_source', 'week_start'] })).toEqual({ fields: ['week_start', 'lead_source'], params: {} });
  });

  it('checks the parameters of each, and that a probe without any gets none', () => {
    expect(settingOf('grainHolds', WEEKLY, { params: { deep: true } })).toEqual({ problem: 'invalid', message: 'This EDA-Probe has no parameter deep.' });
    expect(settingOf('volumeOverTime', WEEKLY, { params: { measure: 'unique_applicants' } })).toMatchObject({ problem: 'invalid', message: expect.stringMatching(/role addsUp/) });
    expect(settingOf('volumeOverTime', LEADS, { params: { measure: 'price' } })).toMatchObject({ problem: 'invalid', message: 'Only an aggregate or a fact has a field that adds up.' });
    expect(settingOf('volumeOverTime', LEADS, { params: { mayBeEmpty: 'weekends' } })).toEqual({ fields: ['created_at'], params: { mayBeEmpty: 'weekends' } });
    expect(settingOf('volumeOverTime', LEADS, { params: { mayBeEmpty: 'mondays' } })).toMatchObject({ problem: 'invalid' });
    expect(settingOf('dateRange', WEEKLY, { params: { unit: 'month' } })).toEqual({ problem: 'invalid', message: 'This EDA-Probe has no parameter unit.' });
    expect(settingOf('distributionOfCategories', WEEKLY, { params: { weighedBy: null } })).toEqual({ fields: ['lead_source', 'lead_channel'], params: { weighedBy: null } });
    expect(settingOf('distributionOfCategories', WEEKLY, { params: { weighedBy: 'unique_applicants' } })).toMatchObject({ problem: 'invalid', message: expect.stringMatching(/a unique count never adds up/) });
    expect(settingOf('distributionOfCategories', LEADS, { params: { weighedBy: 'price' } })).toMatchObject({ problem: 'invalid', message: expect.stringMatching(/Only an aggregate or a fact/) });
  });

  it('says why it cannot run: not run yet, not offered, no grain, no date of its role, no Key Field', () => {
    expect(settingOf('disguisedNulls', WEEKLY, {})).toEqual({ problem: 'blocked', message: 'Data Hub does not run Disguised nulls yet (OP-ED-09).' });
    const untyped = { ...WEEKLY, resource: { ...WEEKLY.resource, modelType: null } };
    expect(settingOf('nullsPerKeyField', untyped, {})).toMatchObject({ problem: 'blocked', message: expect.stringMatching(/without a model type/) });
    const fields = WEEKLY.resource.fields.map((field) => ({ ...field, grain: false, role: null, keyField: false }));
    const bare = { ...WEEKLY, resource: { ...WEEKLY.resource, fields } };
    expect(settingOf('grainHolds', bare, {})).toMatchObject({ problem: 'blocked', message: expect.stringMatching(/records its grain first/) });
    expect(settingOf('volumeOverTime', bare, { fields: ['loaded_at'] })).toMatchObject({ problem: 'blocked', message: expect.stringMatching(/date of its model type/) });
    expect(settingOf('dateRange', bare, { fields: ['loaded_at'] })).toMatchObject({ problem: 'blocked', message: expect.stringMatching(/date of its model type/) });
    expect(settingOf('distributionOfCategories', bare, {})).toMatchObject({ problem: 'blocked', message: expect.stringMatching(/choose its fields/) });
    expect(settingOf('distributionOfCategories', bare, { fields: ['lead_channel'] })).toEqual({ fields: ['lead_channel'], params: {} });
    expect(settingOf('nullsPerKeyField', bare, {})).toMatchObject({ problem: 'blocked', message: expect.stringMatching(/choose its fields/) });
    expect(settingOf('nullsPerKeyField', bare, { fields: ['lead_origin'] })).toEqual({ fields: ['lead_origin'], params: {} });
  });
});
