import { describe, expect, it } from 'vitest';
import { customHoursOf, customHoursCoverFullShift, shiftBounds } from '@/features/schedules/shift-times';
import { computeManualViolations } from '@/features/scheduling-engine/manual-violations';
import { collectUnmetMinimums } from '@/features/scheduling-engine/weekly-minimums';
import { computeFairnessSummary } from '@/features/scheduling-engine/fairness';
import type { EngineAssignment, EngineInput } from '@/features/scheduling-engine/types';

const date = new Date('2026-10-05T00:00:00Z');
const bounds = shiftBounds(date, '07:00', '19:00');
const hours = `${bounds.startsAt.toISOString()}|${bounds.endsAt.toISOString()}`;
const input: EngineInput = {
  scheduleId: 's',
  period: { id: 's', facilityId: 'f', startDate: date, endDate: date },
  week1Dates: [date], week2Dates: [],
  employees: [{ id: 'e', facilityId: 'f', positionId: 'r', rank: 3, isActive: true }],
  capacities: [
    { positionId: 'p', requiredRank: 3, shiftType: 'MORNING', dayCategory: 'WEEKDAY', amount: 1 },
    { positionId: 'p', requiredRank: 3, shiftType: 'EVENING', dayCategory: 'WEEKDAY', amount: 1 },
  ],
  availability: new Map([['e', new Set(['2026-10-05|MORNING', '2026-10-05|EVENING'])]]),
  manualAssignments: [],
};
const morning: EngineAssignment = { employeeId: 'e', facilityId: 'f', positionId: 'p', date, shiftType: 'MORNING', slotIndex: 0, isManualOverride: true, source: 'MANUAL', customHours: hours };
const evening: EngineAssignment = { ...morning, shiftType: 'EVENING', isExtension: true };

describe('custom shift hours', () => {
  it.each([
    ['2026-10-05', '07:00', '19:00', 'MORNING', true],
    ['2026-10-05', '07:00', '19:00', 'EVENING', false],
    ['2026-10-05', '07:00', '19:00', 'NIGHT', false],
    ['2026-10-05', '07:00', '15:00', 'EVENING', false],
    ['2026-10-05', '15:00', '23:00', 'NIGHT', false],
    ['2026-10-05', '19:00', '03:00', 'EVENING', false],
    ['2026-10-05', '19:00', '03:00', 'NIGHT', false],
    ['2026-10-05', '15:00', '07:00', 'EVENING', true],
    ['2026-10-05', '15:00', '07:00', 'NIGHT', true],
    ['2026-10-25', '07:00', '19:00', 'EVENING', false],
    ['2026-10-25', '07:00', '19:00', 'NIGHT', false],
  ] as const)('checks %s %s–%s against %s: %s', (day, startTime, endTime, shiftType, expected) => {
    expect(customHoursCoverFullShift(day, shiftType, { startTime, endTime })).toBe(expected);
  });

  it('reports hours only when they differ from the shift defaults', () => {
    const regular = shiftBounds(date, '07:00', '15:00');
    expect(customHoursOf(date, 'MORNING', regular.startsAt, regular.endsAt)).toBeUndefined();
    const long = shiftBounds(date, '07:00', '19:00');
    expect(customHoursOf(date, 'MORNING', long.startsAt, long.endsAt)).toEqual({ startTime: '07:00', endTime: '19:00' });
    expect(customHoursOf(date, 'EVENING', long.startsAt, long.endsAt)).toEqual({ startTime: '07:00', endTime: '19:00' });
  });

  it('does not flag the evening covered by the same custom hours as a conflict', () => {
    expect(computeManualViolations(input, [morning], evening).violations).toEqual([]);
    const regularEvening = { ...evening, customHours: undefined, isExtension: undefined };
    expect(computeManualViolations(input, [morning], regularEvening).blocking).toContain('לא ניתן לשבץ עובד לשתי משמרות מלאות עוקבות');
  });

  it('fills the evening seat without counting it toward the minimum or fairness', () => {
    const unmet = collectUnmetMinimums(input, [morning, evening]);
    expect(unmet.find(u => u.shiftType === 'EVENING')).toMatchObject({ actual: 0 });
    expect(computeFairnessSummary([morning, evening]).get('e')).toMatchObject({ totalShifts: 1, morningShifts: 1, eveningShifts: 0 });
  });
});
