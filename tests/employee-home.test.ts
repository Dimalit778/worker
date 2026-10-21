import { describe, expect, it } from 'vitest';
import { employeeHomeShifts } from '@/features/schedules/employee-home';
import type { AssignmentMap, AssignmentSummary } from '@/features/schedules/types';

function assignment(id: string, overrides: Partial<AssignmentSummary> = {}): AssignmentSummary {
  return { id, employeeId: 'me', employeeDisplayName: 'עובד', positionId: 'position-with-hyphens', positionName: 'בקר', shiftType: 'MORNING', slotIndex: 0, ...overrides };
}

describe('employee home shifts', () => {
  it('selects the next exact start, excludes other employees and retains the rest of the period in order', () => {
    const assignments: AssignmentMap = {
      '2026-10-22-MORNING-position-with-hyphens': [assignment('tomorrow')],
      '2026-10-21-MORNING-position-with-hyphens': [assignment('past')],
      '2026-10-21-EVENING-position-with-hyphens': [assignment('next', { shiftType: 'EVENING' }), assignment('other', { employeeId: 'other' })],
    };
    const result = employeeHomeShifts(assignments, 'me', new Date('2026-10-21T09:00:00Z'));
    expect(result.next?.id).toBe('next');
    expect(result.remaining.map(shift => shift.id)).toEqual(['past', 'tomorrow']);
  });

  it('uses custom start times and Jerusalem winter time, including a shift starting now', () => {
    const result = employeeHomeShifts({
      '2026-11-01-MORNING-position': [assignment('custom', { customHours: { startTime: '11:00', endTime: '19:00' } })],
    }, 'me', new Date('2026-11-01T09:00:00Z'));
    expect(result.next).toMatchObject({ id: 'custom', startsAt: '2026-11-01T09:00:00.000Z', startTime: '11:00', endTime: '19:00' });
  });

  it('honors the stored start instant and leaves past shifts visible when no next shift exists', () => {
    const assignments: AssignmentMap = {
      '2026-10-21-NIGHT-position': [assignment('night', { shiftType: 'NIGHT', startsAt: '2026-10-21T19:00:00Z' })],
    };
    expect(employeeHomeShifts(assignments, 'me', new Date('2026-10-21T19:30:00Z')).next).toBeNull();
    expect(employeeHomeShifts(assignments, 'me', new Date('2026-10-21T19:30:00Z')).remaining).toHaveLength(1);
    expect(employeeHomeShifts({}, 'me', new Date())).toEqual({ next: null, remaining: [] });
  });
});
