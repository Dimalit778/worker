import { describe, it, expect } from 'vitest';
import { isClosedCell, getRowLabel, buildWeekDays } from '@/features/court-settings/utils';

describe('isClosedCell', () => {
  it('closes Saturday for any shift', () => {
    expect(isClosedCell(6, 'MORNING')).toBe(true);
    expect(isClosedCell(6, 'EVENING')).toBe(true);
    expect(isClosedCell(6, 'NIGHT')).toBe(true);
  });

  it('closes Friday night only', () => {
    expect(isClosedCell(5, 'NIGHT')).toBe(true);
    expect(isClosedCell(5, 'MORNING')).toBe(false);
    expect(isClosedCell(5, 'EVENING')).toBe(false);
  });

  it('does not close other days', () => {
    expect(isClosedCell(0, 'MORNING')).toBe(false);
    expect(isClosedCell(4, 'NIGHT')).toBe(false);
  });
});

describe('getRowLabel', () => {
  it('returns correct labels for MORNING', () => {
    expect(getRowLabel('MORNING', 0)).toBe('אתמ״ש');
    expect(getRowLabel('MORNING', 1)).toBe('בקר');
    expect(getRowLabel('MORNING', 2)).toBe('בע״ת');
    expect(getRowLabel('MORNING', 3)).toBe('פתיחה');
    expect(getRowLabel('MORNING', 10)).toBe('פתיחה');
  });

  it('returns correct labels for EVENING', () => {
    expect(getRowLabel('EVENING', 0)).toBe('אתמ״ש');
    expect(getRowLabel('EVENING', 1)).toBe('בקר');
    expect(getRowLabel('EVENING', 2)).toBe('פתיחה');
  });

  it('returns correct labels for NIGHT', () => {
    expect(getRowLabel('NIGHT', 0)).toBe('בע״ת');
    expect(getRowLabel('NIGHT', 1)).toBe('פתיחה');
  });
});

describe('buildWeekDays', () => {
  it('returns 7 dates starting from startDate for weekIndex=0', () => {
    const days = buildWeekDays('2024-03-15', 0);
    expect(days).toHaveLength(7);
    expect(days[0].iso).toBe('2024-03-15');
    expect(days[6].iso).toBe('2024-03-21');
  });

  it('returns days 8-14 for weekIndex=1', () => {
    const days = buildWeekDays('2024-03-15', 1);
    expect(days[0].iso).toBe('2024-03-22');
    expect(days[6].iso).toBe('2024-03-28');
  });

  it('sets correct dayOfWeek (0=Sun)', () => {
    // 2024-03-15 is a Friday (5)
    const days = buildWeekDays('2024-03-15', 0);
    expect(days[0].dayOfWeek).toBe(5);
  });

  it('sets correct Hebrew day letter', () => {
    // 2024-03-17 is Sunday (dayOfWeek 0) → 'א'
    const days = buildWeekDays('2024-03-17', 0);
    expect(days[0].letter).toBe('א');
    expect(days[6].letter).toBe('ש');
  });
});
