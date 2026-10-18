import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EngineAssignment, EngineInput } from '@/features/scheduling-engine/types';

const mocks = vi.hoisted(() => ({
  schedule: { findUnique: vi.fn() },
  user: { findMany: vi.fn() },
  staffingRequirement: { findMany: vi.fn() },
  loadSchedulingInput: vi.fn(),
}));
vi.mock('@/lib/db/client', () => ({ prisma: mocks }));
vi.mock('@/features/schedules/generation/queries', () => ({ loadSchedulingInput: mocks.loadSchedulingInput }));

import { getScheduleWarnings } from '@/features/schedules/assignments/queries';

const date = new Date('2026-10-05T00:00:00Z');
const input: EngineInput = {
  period: { id: 'schedule', facilityId: 'facility', startDate: date, endDate: date },
  week1Dates: [date], week2Dates: [],
  employees: [{ id: 'employee', facilityId: 'facility', positionId: 'role', rank: 2, isActive: true }],
  capacities: [{ positionId: 'position', positionName: 'אחמ״ש', requiredRank: 2, shiftType: 'MORNING', dayCategory: 'WEEKDAY', amount: 1 }],
  availability: new Map(), manualAssignments: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.schedule.findUnique.mockResolvedValue({ facilityId: 'facility', draftVersionId: 'draft', publishedVersionId: 'published' });
  mocks.user.findMany.mockResolvedValue([{ id: 'employee', displayName: 'דוד לוי', role: { id: 'role', name: 'אחמ״ש', rank: 2 } }]);
  mocks.staffingRequirement.findMany.mockResolvedValue([{
    id: 'requirement', positionId: 'position', shiftType: 'MORNING', dayCategory: 'WEEKDAY', requiredCount: 1,
    position: { id: 'position', name: 'אחמ״ש', color: null, requiredRank: null, displayOrder: 2, baseRole: { rank: 2 } },
  }]);
  mocks.loadSchedulingInput.mockResolvedValue({ input, allAssignments: [], dateOverrides: [] });
});

describe('getScheduleWarnings', () => {
  it('returns no warnings without a schedule and does not query the database', async () => {
    expect(await getScheduleWarnings(null)).toEqual([]);
    expect(mocks.schedule.findUnique).not.toHaveBeenCalled();
  });

  it('returns no warnings for a deleted schedule', async () => {
    mocks.schedule.findUnique.mockResolvedValue(null);
    expect(await getScheduleWarnings('missing')).toEqual([]);
    expect(mocks.loadSchedulingInput).not.toHaveBeenCalled();
  });

  it('returns critical shortages and capacity warnings with serializable dates and names', async () => {
    const warnings = await getScheduleWarnings('schedule');
    expect(warnings).toEqual(expect.arrayContaining([
      expect.objectContaining({ severity: 'ERROR', message: expect.stringContaining('חסר אחמ״ש'), date: '2026-10-05', shiftType: 'MORNING' }),
      expect.objectContaining({ severity: 'WARNING', type: 'UNFILLED', positionName: 'אחמ״ש', date: '2026-10-05' }),
      expect.objectContaining({ severity: 'ERROR', type: 'MIN_NOT_MET', employeeName: 'דוד לוי', positionName: 'אחמ״ש' }),
    ]));
    expect(warnings.find(w => w.type === 'MIN_NOT_MET' && w.shiftType === 'MORNING')?.message)
      .toBe('שבוע 1: נדרשות 2 משמרות בוקר; בפועל: 0.');
    expect(warnings.find(w => w.type === 'MIN_NOT_MET' && w.shiftType === 'EVENING')?.message)
      .toBe('שבוע 1: נדרשת משמרת ערב אחת; בפועל: 0.');
    for (const warning of warnings) expect(warning.message).not.toMatch(/[A-Za-z]/);
    expect(new Set(warnings.map(w => w.id)).size).toBe(warnings.length);
    expect(mocks.loadSchedulingInput).toHaveBeenCalledWith(mocks, 'schedule', 'facility', 'draft');
  });

  it('recalculates after an assignment is saved and removes the resolved shortage', async () => {
    const before = await getScheduleWarnings('schedule');
    expect(before.some(w => w.severity === 'WARNING' && w.positionName === 'אחמ״ש')).toBe(true);
    const assignment: EngineAssignment = {
      employeeId: 'employee', facilityId: 'facility', positionId: 'position', date, shiftType: 'MORNING', slotIndex: 0, isManualOverride: true,
    };
    mocks.loadSchedulingInput.mockResolvedValue({ input, allAssignments: [assignment], dateOverrides: [] });
    const after = await getScheduleWarnings('schedule');
    expect(after.some(w => w.severity === 'WARNING' && w.positionName === 'אחמ״ש')).toBe(false);
    expect(after.some(w => w.message.includes('חסר אחמ״ש'))).toBe(false);
    expect(after.some(w => w.message.includes('חסר בקר'))).toBe(true);
  });
});
