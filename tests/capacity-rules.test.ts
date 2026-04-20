import { describe, it, expect } from 'vitest';
import { mergeCapacityRules } from '@/features/shifts/queries';
import type { CapacityMap } from '@/features/shifts/types';

const DEFAULT: CapacityMap = { MORNING: 15, EVENING: 6, NIGHT: 3 };

describe('mergeCapacityRules', () => {
  it('returns defaults when no rules provided', () => {
    expect(mergeCapacityRules([], DEFAULT)).toEqual({ MORNING: 15, EVENING: 6, NIGHT: 3 });
  });

  it('overrides a single shift type', () => {
    const rules = [{ shiftType: 'MORNING' as const, maxStaff: 20 }];
    expect(mergeCapacityRules(rules, DEFAULT)).toEqual({ MORNING: 20, EVENING: 6, NIGHT: 3 });
  });

  it('overrides all shift types', () => {
    const rules = [
      { shiftType: 'MORNING' as const, maxStaff: 10 },
      { shiftType: 'EVENING' as const, maxStaff: 4 },
      { shiftType: 'NIGHT' as const, maxStaff: 2 },
    ];
    expect(mergeCapacityRules(rules, DEFAULT)).toEqual({ MORNING: 10, EVENING: 4, NIGHT: 2 });
  });
});
