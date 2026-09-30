import { describe, expect, it } from 'vitest';
import {
  formatJerusalemLocal,
  instantForRule,
  isInWeekBefore,
  periodStartInstant,
  ruleOrderError,
  weekBeforeDate,
} from '@/features/periods/submission-window';

const periodStart = '2026-10-04';

describe('week before a Sunday period start', () => {
  it('maps Wednesday and Friday onto the previous week', () => {
    expect(weekBeforeDate(periodStart, 3)).toBe('2026-09-30');
    expect(weekBeforeDate(periodStart, 5)).toBe('2026-10-02');
    expect(weekBeforeDate(periodStart, 0)).toBe('2026-09-27');
    expect(weekBeforeDate(periodStart, 6)).toBe('2026-10-03');
  });

  it('converts Jerusalem clock time to UTC during IDT', () => {
    expect(instantForRule(periodStart, 3, '10:00').toISOString()).toBe('2026-09-30T07:00:00.000Z');
    expect(instantForRule(periodStart, 5, '17:00').toISOString()).toBe('2026-10-02T14:00:00.000Z');
    expect(formatJerusalemLocal(instantForRule(periodStart, 3, '10:00'))).toBe('2026-09-30T10:00');
  });

  it('treats period start as midnight in Jerusalem', () => {
    expect(periodStartInstant(periodStart).toISOString()).toBe('2026-10-03T21:00:00.000Z');
  });

  it('recognizes dates inside that week', () => {
    expect(isInWeekBefore(periodStart, instantForRule(periodStart, 3, '10:00'))).toBe(true);
    expect(isInWeekBefore(periodStart, periodStartInstant(periodStart))).toBe(false);
  });
});

describe('ruleOrderError', () => {
  it('accepts an open time before the close time', () => {
    expect(
      ruleOrderError({ openWeekday: 3, openTime: '10:00', closeWeekday: 5, closeTime: '17:00' }),
    ).toBeNull();
  });

  it('rejects a close time that is not after the open time', () => {
    expect(
      ruleOrderError({ openWeekday: 5, openTime: '17:00', closeWeekday: 3, closeTime: '10:00' }),
    ).toBe('מועד הפתיחה חייב להיות לפני מועד הסגירה');
  });
});
