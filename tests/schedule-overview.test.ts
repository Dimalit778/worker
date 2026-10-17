import { describe, expect, it } from 'vitest';
import { nextEmployeeShift, todayShortages } from '@/features/schedules/overview';
import type { CurrentScheduleData, AssignmentSummary } from '@/features/schedules/types';
const assignment: AssignmentSummary = { id: 'a', employeeId: 'employee', employeeDisplayName: 'עובד', positionId: 'p', positionName: 'אחמ״ש', shiftType: 'MORNING', slotIndex: 0, startsAt: '2026-10-18T04:00:00Z' };
const schedule: CurrentScheduleData = { scheduleId: 's', scheduleName: 'test', scheduleStatus: 'PUBLISHED', startDate: '2026-10-18', endDate: '2026-10-24', facilityId: 'f', employees: [], warnings: [], overflowCandidates: {}, assignments: { '2026-10-18-MORNING-p': [assignment] }, capacity: [{ id: 'c', positionId: 'p', displayName: 'אחמ״ש', rank: 2, color: null, shiftType: 'MORNING', dayCategory: 'WEEKDAY', amount: 2 }] };
describe('employee next shift and today coverage', () => {
  it('uses exact startsAt and excludes shifts already started', () => {
    expect(nextEmployeeShift([schedule], 'employee', new Date('2026-10-18T03:59:00Z'))?.assignment.id).toBe('a');
    expect(nextEmployeeShift([schedule], 'employee', new Date('2026-10-18T04:01:00Z'))).toBeNull();
    expect(nextEmployeeShift([schedule], 'someone-else', new Date('2026-10-17T12:00:00Z'))).toBeNull();
  });
  it('chooses the earliest assignment across current and upcoming schedules', () => {
    const later = { ...schedule, assignments: { '2026-10-19-MORNING-p': [{ ...assignment, id: 'b', startsAt: '2026-10-19T04:00:00Z' }] } };
    expect(nextEmployeeShift([later, schedule], 'employee', new Date('2026-10-17T12:00:00Z'))?.assignment.id).toBe('a');
  });
  it('uses the Jerusalem calendar day and counts missing slots', () => {
    expect(todayShortages(schedule, new Date('2026-10-17T22:00:00Z'))).toHaveLength(1);
    expect(todayShortages(schedule, new Date('2026-10-17T10:00:00Z'))).toBeNull();
    expect(todayShortages({ ...schedule, capacity: [] }, new Date('2026-10-18T10:00:00Z'))).toEqual([]);
  });
});
