import { describe, expect, it } from 'vitest';
import { getCapacityForCell } from '@/features/schedules/utils';
import type { ScheduleCapacityRule } from '@/features/schedules/types';

const RULES: ScheduleCapacityRule[] = [
  {
    positionId: 'guard',
    displayName: 'מאבטח',
    rank: 1,
    shiftType: 'MORNING',
    dayCategory: 'WEEKDAY',
    amount: 15,
  },
  {
    positionId: 'guard',
    displayName: 'מאבטח',
    rank: 1,
    shiftType: 'EVENING',
    dayCategory: 'WEEKDAY',
    amount: 6,
  },
  {
    positionId: 'guard',
    displayName: 'מאבטח',
    rank: 1,
    shiftType: 'NIGHT',
    dayCategory: 'SATURDAY',
    amount: 3,
  },
];

describe('getCapacityForCell', () => {
  it('returns the configured amount for a matching position, day category, and shift', () => {
    expect(getCapacityForCell(RULES, 'WEEKDAY', 'MORNING', 'guard')).toBe(15);
    expect(getCapacityForCell(RULES, 'WEEKDAY', 'EVENING', 'guard')).toBe(6);
  });

  it('returns 0 when no capacity rule exists for the cell', () => {
    expect(getCapacityForCell(RULES, 'FRIDAY', 'MORNING', 'guard')).toBe(0);
    expect(getCapacityForCell(RULES, 'WEEKDAY', 'MORNING', 'bakar')).toBe(0);
  });
});
