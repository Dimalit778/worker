import { describe, expect, it } from 'vitest';
import {
  applyPreference,
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
