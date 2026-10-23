import { describe, expect, it } from 'vitest';
import { CONSECUTIVE_SHIFT_MESSAGE } from '@/features/scheduling-engine/constraints';
import { computeManualViolations } from '@/features/scheduling-engine/manual-violations';
import { validateAssignments } from '@/features/scheduling-engine/validate';
import type { EngineAssignment, EngineInput, ShiftType } from '@/features/scheduling-engine/types';

const date = new Date('2026-10-05T00:00:00Z');
const nextDate = new Date('2026-10-06T00:00:00Z');
const assignment = (shiftType: ShiftType, day = date): EngineAssignment => ({
  employeeId: 'e', facilityId: 'f', positionId: 'p', date: day,
  shiftType, slotIndex: 0, isManualOverride: false, source: 'MANUAL',
});
const input = (): EngineInput => ({
  scheduleId: 's', period: { id: 's', facilityId: 'f', startDate: date, endDate: nextDate },
  week1Dates: [date, nextDate], week2Dates: [],
  employees: [{ id: 'e', facilityId: 'f', positionId: 'r', rank: 4, isActive: true }],
  capacities: (['MORNING', 'EVENING', 'NIGHT'] as const).map(shiftType => ({
    positionId: 'p', requiredRank: 2, shiftType, dayCategory: 'WEEKDAY', amount: 1,
  })),
  availability: new Map(), manualAssignments: [],
});

describe('manual consecutive-shift policy', () => {
  it.each([
    ['MORNING', 'EVENING', date],
    ['EVENING', 'NIGHT', date],
    ['NIGHT', 'MORNING', nextDate],
  ] as const)('blocks %s followed by %s in either edit order and at publication', (first, second, secondDate) => {
    const a = assignment(first), b = assignment(second, secondDate);
    for (const [existing, candidate] of [[a, b], [b, a]]) {
      expect(computeManualViolations(input(), [existing], candidate).blocking).toContain(CONSECUTIVE_SHIFT_MESSAGE);
      expect(validateAssignments(input(), [existing, candidate])).toContain(CONSECUTIVE_SHIFT_MESSAGE);
    }
  });

  it.each(['MANUAL', 'AUTOMATIC'] as const)('checks %s assignments across the period boundary', source => {
    const data = input();
    data.boundaryAssignments = [{ ...assignment('NIGHT', new Date('2026-10-04T00:00:00Z')), source }];
    const candidate = assignment('MORNING');
    expect(computeManualViolations(data, [], candidate).blocking).toContain(CONSECUTIVE_SHIFT_MESSAGE);
    expect(validateAssignments(data, [candidate])).toContain(CONSECUTIVE_SHIFT_MESSAGE);
  });

  it('blocks a manual evening next to an automatic morning regardless of ordering', () => {
    const morning = { ...assignment('MORNING'), source: 'AUTOMATIC' as const };
    const evening = assignment('EVENING');
    for (const rows of [[morning, evening], [evening, morning]]) {
      expect(validateAssignments(input(), rows)).toContain(CONSECUTIVE_SHIFT_MESSAGE);
    }
  });

  it('allows one custom duty in morning and evening but blocks a separate night', () => {
    const hours = '2026-10-05T04:00:00Z|2026-10-05T16:00:00Z';
    const morning = { ...assignment('MORNING'), customHours: hours };
    const evening = { ...assignment('EVENING'), customHours: hours, isExtension: true };
    expect(computeManualViolations(input(), [morning], evening).blocking).toEqual([]);
    expect(validateAssignments(input(), [morning, evening])).toEqual([]);
    const night = assignment('NIGHT');
    expect(computeManualViolations(input(), [morning, evening], night).blocking).toContain(CONSECUTIVE_SHIFT_MESSAGE);
    expect(validateAssignments(input(), [morning, evening, night])).toContain(CONSECUTIVE_SHIFT_MESSAGE);
  });

  it('does not merge different custom duties into the same shift', () => {
    const morning = { ...assignment('MORNING'), customHours: '07:00-19:00' };
    const evening = { ...assignment('EVENING'), customHours: '15:00-20:00' };
    expect(computeManualViolations(input(), [morning], evening).blocking).toContain(CONSECUTIVE_SHIFT_MESSAGE);
  });

  it('permits manual nonconsecutive shifts despite unavailable time, rank and capacity exceptions', () => {
    const data = input();
    data.timeOff = new Map([['e', new Set(['2026-10-05'])]]);
    data.capacities.forEach(c => { c.amount = 0; });
    const rows = [assignment('MORNING'), assignment('NIGHT')];
    expect(computeManualViolations(data, [rows[0]], rows[1]).blocking).toEqual([]);
    expect(validateAssignments(data, rows)).toEqual([]);
    expect(validateAssignments(data, rows, { allowManualOverrides: false }).length).toBeGreaterThan(0);
  });
});
