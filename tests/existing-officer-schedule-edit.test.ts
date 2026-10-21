import { describe, expect, it, vi } from 'vitest';
import type { Prisma } from '@/generated/prisma/client';
import type { EngineAssignment, EngineInput } from '@/features/scheduling-engine/types';
import { validateScheduleEdit } from '@/features/schedules/assignments/validate-edit';
import { computeManualViolations } from '@/features/scheduling-engine/manual-violations';

const date = new Date('2026-10-19T00:00:00Z');
const input = (): EngineInput => ({
  period: { id: 'schedule', facilityId: 'facility', startDate: date, endDate: date },
  week1Dates: [date], week2Dates: [],
  employees: [{ id: 'staff', facilityId: 'facility', positionId: 'guard-role', rank: 4, isActive: true }],
  capacities: [{ positionId: 'guard', requiredRank: 4, shiftType: 'MORNING', dayCategory: 'WEEKDAY', amount: 2 }],
  availability: new Map([['officer', new Set(['2026-10-19|MORNING'])]]),
  manualAssignments: [],
});
const assignment = (employeeId: string, source: EngineAssignment['source']): EngineAssignment => ({
  employeeId, facilityId: 'facility', positionId: 'guard', date,
  shiftType: 'MORNING', slotIndex: employeeId === 'officer' ? 0 : 1, isManualOverride: false, source,
});
function database(officers = [{ id: 'officer', facilityId: 'facility', roleId: 'officer-role', isActive: true, role: { rank: 1 } }]) {
  const findMany = vi.fn().mockResolvedValue(officers);
  return { tx: { user: { findMany } } as unknown as Prisma.TransactionClient, findMany };
}

describe('saving a roster created by the older officer-inclusive seed', () => {
  it('accepts a staff addition while keeping the existing automatic officer assignment and normal staff input', async () => {
    const data = input();
    const { tx, findMany } = database();
    const assignments = [assignment('officer', 'AUTOMATIC'), assignment('staff', 'MANUAL')];
    expect(await validateScheduleEdit(tx, data, assignments, ['officer'])).toEqual([]);
    expect(data.employees.map(employee => employee.id)).toEqual(['staff']);
    expect(assignments[0]).toEqual(assignment('officer', 'AUTOMATIC'));
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: { in: ['officer'] }, facilityId: 'facility', role: { rank: 1 }, isActive: true, deletedAt: null },
    }));
  });

  it('does not admit a newly supplied officer id absent from the saved roster', async () => {
    const { tx, findMany } = database();
    expect(await validateScheduleEdit(tx, input(), [assignment('officer', 'MANUAL')], ['staff']))
      .toContain('עובד, תפקיד, מתקן או תאריך אינם תקינים לשיבוץ');
    expect(findMany).not.toHaveBeenCalled();
  });

  it('keeps new placements of an existing officer blocked by the original staff-only input', async () => {
    const data = input();
    const { tx } = database();
    expect(await validateScheduleEdit(tx, data, [assignment('officer', 'AUTOMATIC')], ['officer'])).toEqual([]);
    expect(computeManualViolations(data, [], assignment('officer', 'MANUAL')).blocking)
      .toContain('העובד אינו שייך למתקן');
  });

  it('still rejects invalid dates and cross-facility assignments when an officer is recognized', async () => {
    for (const invalid of [
      { ...assignment('staff', 'MANUAL'), date: new Date('2026-10-20T00:00:00Z') },
      { ...assignment('staff', 'MANUAL'), facilityId: 'another-facility' },
    ]) {
      const { tx } = database();
      expect(await validateScheduleEdit(tx, input(), [assignment('officer', 'AUTOMATIC'), invalid], ['officer']))
        .toContain('עובד, תפקיד, מתקן או תאריך אינם תקינים לשיבוץ');
    }
  });

  it('does not bypass automatic availability rules for an existing officer', async () => {
    const data = input();
    data.availability.clear();
    const { tx } = database();
    expect(await validateScheduleEdit(tx, data, [assignment('officer', 'AUTOMATIC')], ['officer']))
      .toContain('העובד לא הגיש זמינות למשמרת');
  });

  it('keeps rejecting an assignee not returned by the facility-scoped officer lookup', async () => {
    const { tx } = database([]);
    expect(await validateScheduleEdit(tx, input(), [assignment('officer', 'AUTOMATIC')], ['officer']))
      .toContain('עובד, תפקיד, מתקן או תאריך אינם תקינים לשיבוץ');
  });

  it('does not query extra employees for an already valid roster', async () => {
    const { tx, findMany } = database();
    expect(await validateScheduleEdit(tx, input(), [assignment('staff', 'MANUAL')], ['staff'])).toEqual([]);
    expect(findMany).not.toHaveBeenCalled();
  });
});
