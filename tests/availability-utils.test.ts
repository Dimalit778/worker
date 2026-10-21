import { describe, expect, it } from 'vitest';
import {
  applyPreference,
  assertWeeklyMinimums,
  chunkWeeks,
  copyWeek,
  datesInRange,
  deriveAvailabilityStatus,
  displayAvailabilityStatus,
  nextPreference,
  normalizeEntries,
  parseDraftEntries,
  validateAvailabilityEntries,
} from '@/features/availability/utils';

describe('deriveAvailabilityStatus', () => {
  it('maps form state to the four statuses', () => {
    expect(deriveAvailabilityStatus(null)).toBe('NOT_SUBMITTED');
    expect(deriveAvailabilityStatus({ submittedAt: null, hasDraft: false })).toBe('NOT_SUBMITTED');
    expect(deriveAvailabilityStatus({ submittedAt: null, hasDraft: true })).toBe('DRAFT');
    expect(deriveAvailabilityStatus({ submittedAt: new Date(), hasDraft: false })).toBe('SUBMITTED');
    expect(deriveAvailabilityStatus({ submittedAt: new Date(), hasDraft: true })).toBe('UNSUBMITTED_CHANGES');
  });

  it('never shows submitted while there are local unsaved edits', () => {
    expect(displayAvailabilityStatus('SUBMITTED', true)).toBe('UNSUBMITTED_CHANGES');
    expect(displayAvailabilityStatus('SUBMITTED', false)).toBe('SUBMITTED');
    expect(displayAvailabilityStatus('DRAFT', true)).toBe('DRAFT');
  });
});

describe('preferences', () => {
  it('cycles empty → available → preferred → unavailable → empty', () => {
    expect(nextPreference(undefined)).toBe('AVAILABLE');
    expect(nextPreference('AVAILABLE')).toBe('PREFERRED');
    expect(nextPreference('PREFERRED')).toBe('UNAVAILABLE');
    expect(nextPreference('UNAVAILABLE')).toBeUndefined();
  });

  it('normalizes legacy booleans and parses stored drafts', () => {
    expect(normalizeEntries({ a: true, b: false, c: 'PREFERRED' })).toEqual({
      a: 'AVAILABLE',
      b: 'UNAVAILABLE',
      c: 'PREFERRED',
    });
    expect(parseDraftEntries(null)).toBeNull();
    expect(parseDraftEntries({ '2098-01-06-MORNING': 'PREFERRED', bad: 'AVAILABLE', '2098-01-06-NIGHT': 'X' })).toEqual({
      '2098-01-06-MORNING': 'PREFERRED',
    });
    expect(parseDraftEntries({})).toEqual({});
  });

  it('validates keys, dates and preferences against the period', () => {
    expect(
      validateAvailabilityEntries({ '2098-01-06-MORNING': 'PREFERRED', '2098-01-07-NIGHT': false }, '2098-01-06', '2098-01-07'),
    ).toEqual([
      { key: '2098-01-06-MORNING', date: '2098-01-06', shiftType: 'MORNING', preference: 'PREFERRED' },
      { key: '2098-01-07-NIGHT', date: '2098-01-07', shiftType: 'NIGHT', preference: 'UNAVAILABLE' },
    ]);
    expect(() => validateAvailabilityEntries({ '2098-01-08-MORNING': 'AVAILABLE' }, '2098-01-06', '2098-01-07')).toThrow();
    expect(() => validateAvailabilityEntries({ '2098-02-30-MORNING': 'AVAILABLE' }, '2098-01-01', '2098-12-31')).toThrow();
    expect(() => validateAvailabilityEntries({ '2098-01-06-NOON': 'AVAILABLE' }, '2098-01-06', '2098-01-07')).toThrow();
    expect(() => validateAvailabilityEntries({ '2098-01-06-MORNING': 'MAYBE' }, '2098-01-06', '2098-01-07')).toThrow();
  });
});

describe('weeks', () => {
  it('chunks 7-day periods into one week and 14-day periods into two', () => {
    expect(chunkWeeks(datesInRange('2098-01-05', '2098-01-11'))).toHaveLength(1);
    const two = chunkWeeks(datesInRange('2098-01-05', '2098-01-18'));
    expect(two.map((w) => w.length)).toEqual([7, 7]);
    expect(chunkWeeks(datesInRange('2098-01-05', '2098-01-14')).map((w) => w.length)).toEqual([7, 3]);
  });

  it('copies a week by weekday offset, including cleared cells', () => {
    const [w1, w2] = chunkWeeks(datesInRange('2098-01-05', '2098-01-18'));
    const copied = copyWeek(
      { '2098-01-05-MORNING': 'PREFERRED', '2098-01-07-NIGHT': 'UNAVAILABLE', '2098-01-12-EVENING': 'AVAILABLE' },
      w1,
      w2,
      ['MORNING', 'EVENING', 'NIGHT'],
    );
    expect(copied).toEqual({
      '2098-01-05-MORNING': 'PREFERRED',
      '2098-01-07-NIGHT': 'UNAVAILABLE',
      '2098-01-12-MORNING': 'PREFERRED',
      '2098-01-14-NIGHT': 'UNAVAILABLE',
    });
  });

  it('applies or clears a preference in bulk', () => {
    const set = applyPreference({}, ['2098-01-05', '2098-01-06'], ['MORNING'], 'UNAVAILABLE');
    expect(set).toEqual({ '2098-01-05-MORNING': 'UNAVAILABLE', '2098-01-06-MORNING': 'UNAVAILABLE' });
    expect(applyPreference(set, ['2098-01-05'], ['MORNING'], undefined)).toEqual({ '2098-01-06-MORNING': 'UNAVAILABLE' });
  });
});

describe('assertWeeklyMinimums', () => {
  const check = (entries: Record<string, string>, end: '2098-01-11' | '2098-01-18') =>
    assertWeeklyMinimums(validateAvailabilityEntries(entries, '2098-01-05', end), '2098-01-05', end);
  const week1 = { '2098-01-05-MORNING': 'AVAILABLE', '2098-01-06-MORNING': 'AVAILABLE', '2098-01-07-EVENING': 'AVAILABLE' };
  const week2 = { '2098-01-12-MORNING': 'AVAILABLE', '2098-01-13-MORNING': 'AVAILABLE', '2098-01-14-EVENING': 'AVAILABLE' };
  const generic = 'בכל שבוע יש לסמן לפחות 2 משמרות בוקר ומשמרת ערב אחת כזמין או מועדף';

  it('passes a 7-day period with 2 mornings and 1 evening', () => {
    expect(() => check(week1, '2098-01-11')).not.toThrow();
  });

  it('rejects a 7-day period that is short of mornings, evenings or everything', () => {
    expect(() => check({ '2098-01-05-MORNING': 'AVAILABLE', '2098-01-07-EVENING': 'AVAILABLE' }, '2098-01-11')).toThrow(generic);
    expect(() => check({ '2098-01-05-MORNING': 'AVAILABLE', '2098-01-06-MORNING': 'AVAILABLE' }, '2098-01-11')).toThrow(generic);
    expect(() => check({}, '2098-01-11')).toThrow(generic);
  });

  it('counts PREFERRED as available', () => {
    expect(() =>
      check({ '2098-01-05-MORNING': 'PREFERRED', '2098-01-06-MORNING': 'PREFERRED', '2098-01-07-EVENING': 'PREFERRED' }, '2098-01-11'),
    ).not.toThrow();
  });

  it('does not count UNAVAILABLE entries', () => {
    expect(() => check({ ...week1, '2098-01-06-MORNING': 'UNAVAILABLE' }, '2098-01-11')).toThrow(generic);
    expect(() => check({ ...week1, '2098-01-07-EVENING': 'UNAVAILABLE' }, '2098-01-11')).toThrow(generic);
  });

  it('does not count NIGHT shifts toward either minimum', () => {
    expect(() => check({ ...week1, '2098-01-06-MORNING': 'AVAILABLE', '2098-01-07-EVENING': 'UNAVAILABLE', '2098-01-08-NIGHT': 'AVAILABLE' }, '2098-01-11')).toThrow(generic);
    expect(() => check({ '2098-01-05-MORNING': 'AVAILABLE', '2098-01-06-NIGHT': 'AVAILABLE', '2098-01-07-EVENING': 'AVAILABLE' }, '2098-01-11')).toThrow(generic);
  });

  it('passes a 14-day period only when both weeks meet the minimum', () => {
    expect(() => check({ ...week1, ...week2 }, '2098-01-18')).not.toThrow();
  });

  it('names the failing week in a 14-day period', () => {
    const missing = (week: number) => `בשבוע ${week} יש לסמן לפחות 2 משמרות בוקר ומשמרת ערב אחת כזמין או מועדף`;
    expect(() => check(week1, '2098-01-18')).toThrow(missing(2));
    expect(() => check(week2, '2098-01-18')).toThrow(missing(1));
    expect(() => check({ ...week1, '2098-01-12-MORNING': 'AVAILABLE', '2098-01-14-EVENING': 'AVAILABLE' }, '2098-01-18')).toThrow(missing(2));
    expect(() => check({}, '2098-01-18')).toThrow(generic);
  });

  describe('approved time off', () => {
    const checkWithTimeOff = (entries: Record<string, string>, end: '2098-01-11' | '2098-01-18', timeOff: string[]) =>
      assertWeeklyMinimums(validateAvailabilityEntries(entries, '2098-01-05', end), '2098-01-05', end, new Set(timeOff));

    it('skips a week that contains an approved time-off day', () => {
      expect(() => checkWithTimeOff({}, '2098-01-11', ['2098-01-09'])).not.toThrow();
      expect(() => checkWithTimeOff(week2, '2098-01-18', ['2098-01-05'])).not.toThrow();
      expect(() => checkWithTimeOff(week1, '2098-01-18', ['2098-01-18'])).not.toThrow();
    });

    it('still enforces the other week of a 14-day period', () => {
      const missing = (week: number) => `בשבוע ${week} יש לסמן לפחות 2 משמרות בוקר ומשמרת ערב אחת כזמין או מועדף`;
      expect(() => checkWithTimeOff(week1, '2098-01-18', ['2098-01-05'])).toThrow(missing(2));
      expect(() => checkWithTimeOff(week2, '2098-01-18', ['2098-01-18'])).toThrow(missing(1));
      expect(() => checkWithTimeOff({}, '2098-01-18', ['2098-01-12'])).toThrow(missing(1));
    });

    it('behaves as before when the set is empty or the dates fall outside the period', () => {
      expect(() => checkWithTimeOff({}, '2098-01-11', [])).toThrow(generic);
      expect(() => checkWithTimeOff({}, '2098-01-18', [])).toThrow(generic);
      expect(() => checkWithTimeOff({}, '2098-01-11', ['2098-01-12'])).toThrow(generic);
      expect(() => checkWithTimeOff({ ...week1, ...week2 }, '2098-01-18', [])).not.toThrow();
    });
  });
});
