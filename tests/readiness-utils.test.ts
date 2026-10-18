import { describe, expect, it } from 'vitest';
import { shiftBounds } from '@/features/schedules/shift-times';
import {
  aggregateEmployeeLoad,
  countByStatus,
  diffVersions,
  submissionStatusOf,
  type DiffSlot,
  type LoadSlot,
} from '@/features/schedules/readiness/utils';

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const slot = (userId: string, iso: string, shiftType: LoadSlot['shiftType'], start: string, end: string): LoadSlot => ({
  userId, date: day(iso), shiftType, ...shiftBounds(day(iso), start, end),
});

describe('submissionStatusOf', () => {
  it('derives the four statuses', () => {
    expect(submissionStatusOf(null)).toBe('NOT_SUBMITTED');
    expect(submissionStatusOf({ submittedAt: null, draftEntries: null })).toBe('NOT_SUBMITTED');
    expect(submissionStatusOf({ submittedAt: null, draftEntries: [] })).toBe('DRAFT');
    expect(submissionStatusOf({ submittedAt: new Date(), draftEntries: null })).toBe('SUBMITTED');
    expect(submissionStatusOf({ submittedAt: new Date(), draftEntries: [{}] })).toBe('UNSUBMITTED_CHANGES');
    expect(countByStatus(['DRAFT', 'DRAFT', 'SUBMITTED'])).toEqual({ NOT_SUBMITTED: 0, DRAFT: 2, SUBMITTED: 1, UNSUBMITTED_CHANGES: 0 });
  });
});

describe('aggregateEmployeeLoad', () => {
  it('counts shifts per type, Friday/Saturday shifts and hours including night shifts crossing midnight', () => {
    const rows = aggregateEmployeeLoad(
      [
        slot('a', '2026-10-15', 'MORNING', '07:00', '15:00'), // Thursday
        slot('a', '2026-10-16', 'NIGHT', '23:00', '07:00'), // Friday night, ends Saturday
        slot('a', '2026-10-17', 'EVENING', '15:00', '23:00'), // Saturday
        slot('b', '2026-10-18', 'NIGHT', '23:00', '07:00'), // Sunday
        slot('ghost', '2026-10-18', 'MORNING', '07:00', '15:00'),
      ],
      [
        { id: 'b', displayName: 'בני', roleName: 'מאבטח' },
        { id: 'a', displayName: 'אבי', roleName: 'מאבטח' },
        { id: 'c', displayName: 'גיל', roleName: null },
      ],
    );
    expect(rows.map((r) => r.employeeId)).toEqual(['a', 'b', 'c']);
    expect(rows[0]).toMatchObject({ totalShifts: 3, morningShifts: 1, eveningShifts: 1, nightShifts: 1, weekendShifts: 2, hours: 24 });
    expect(rows[1]).toMatchObject({ totalShifts: 1, nightShifts: 1, weekendShifts: 0, hours: 8 });
    expect(rows[2]).toMatchObject({ totalShifts: 0, hours: 0 });
  });

  it('uses the stored shift times rather than defaults', () => {
    const [row] = aggregateEmployeeLoad([slot('a', '2026-10-18', 'NIGHT', '22:30', '06:00')], [{ id: 'a', displayName: 'א', roleName: null }]);
    expect(row.hours).toBe(7.5);
  });
});

describe('diffVersions', () => {
  const s = (date: string, shiftType: DiffSlot['shiftType'], employeeId: string | null, positionId = 'p1'): DiffSlot => ({
    date, shiftType, positionId, positionName: positionId === 'p1' ? 'כניסה' : 'אולם', employeeId, employeeName: employeeId ? `עובד ${employeeId}` : null,
  });

  it('reports added, removed and reassigned slots per cell', () => {
    const published = [s('2026-10-18', 'MORNING', 'a'), s('2026-10-18', 'MORNING', 'b'), s('2026-10-19', 'EVENING', 'c'), s('2026-10-20', 'NIGHT', 'd', 'p2')];
    const draft = [s('2026-10-18', 'MORNING', 'b'), s('2026-10-18', 'MORNING', 'e'), s('2026-10-20', 'NIGHT', 'd', 'p2'), s('2026-10-21', 'MORNING', 'f')];
    expect(diffVersions(published, draft)).toEqual([
      expect.objectContaining({ kind: 'reassigned', date: '2026-10-18', shiftType: 'MORNING', fromEmployeeId: 'a', toEmployeeId: 'e', positionName: 'כניסה' }),
      expect.objectContaining({ kind: 'removed', date: '2026-10-19', fromEmployeeId: 'c', toEmployeeId: null }),
      expect.objectContaining({ kind: 'added', date: '2026-10-21', fromEmployeeId: null, toEmployeeId: 'f' }),
    ]);
  });

  it('ignores slot renumbering, empty slots and identical versions', () => {
    const published = [s('2026-10-18', 'MORNING', 'a'), s('2026-10-18', 'MORNING', 'b'), s('2026-10-18', 'EVENING', null)];
    const draft = [s('2026-10-18', 'MORNING', 'b'), s('2026-10-18', 'MORNING', 'a')];
    expect(diffVersions(published, draft)).toEqual([]);
  });

  it('treats everything as added when there is no published version', () => {
    expect(diffVersions([], [s('2026-10-18', 'MORNING', 'a')]).map((c) => c.kind)).toEqual(['added']);
  });
});
