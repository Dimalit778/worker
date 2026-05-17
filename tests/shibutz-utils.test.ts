import { describe, expect, it } from 'vitest';
import {
  buildWeekDays,
  getDayCategoryForDate,
  getShiftSlotLabel,
  isGuardPositionLabel,
} from '@/features/schedules/utils';

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

  it('sets correct dayOfWeek and Hebrew day letter', () => {
    const days = buildWeekDays('2024-03-17', 0);
    expect(days[0].dayOfWeek).toBe(0);
    expect(days[0].letter).toBe('א');
    expect(days[6].letter).toBe('ש');
  });
});

describe('getDayCategoryForDate', () => {
  it('maps Friday and Saturday to staffing day categories', () => {
    expect(getDayCategoryForDate('2024-03-15')).toBe('FRIDAY');
    expect(getDayCategoryForDate('2024-03-16')).toBe('SATURDAY');
    expect(getDayCategoryForDate('2024-03-17')).toBe('WEEKDAY');
  });

  it('uses HOLIDAY when the caller supplies a holiday date', () => {
    expect(getDayCategoryForDate('2024-03-17', new Set(['2024-03-17']))).toBe('HOLIDAY');
  });
});

describe('schedule row labels', () => {
  it('returns stable slot labels with fallback to the last configured label', () => {
    expect(getShiftSlotLabel('MORNING', 0)).toBe('אתמ״ש');
    expect(getShiftSlotLabel('MORNING', 1)).toBe('בקר');
    expect(getShiftSlotLabel('MORNING', 10)).toBe('פתיחה');
    expect(getShiftSlotLabel('NIGHT', 1)).toBe('פתיחה');
  });

  it('recognizes guard labels that should render without a visible position name', () => {
    expect(isGuardPositionLabel('מאבטח')).toBe(true);
    expect(isGuardPositionLabel('GUARD')).toBe(true);
    expect(isGuardPositionLabel('בקר')).toBe(false);
  });
});
