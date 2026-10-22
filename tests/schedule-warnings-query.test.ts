import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EngineAssignment, EngineInput } from '@/features/scheduling-engine/types';

const mocks = vi.hoisted(() => ({
  schedule: { findFirst: vi.fn() },
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
  capacities: [{ positionId: 'position', positionName: 'אחמ״ש', requiredRank: 2, shiftType: 'MORNING', dayCategory: 'WEEKDAY', amount: 1, mandatory: 1 }],
  availability: new Map(), manualAssignments: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.schedule.findFirst.mockResolvedValue({ draftVersionId: 'draft', publishedVersionId: 'published' });
  mocks.user.findMany.mockResolvedValue([{ id: 'employee', displayName: 'דוד לוי', role: { id: 'role', name: 'אחמ״ש', rank: 2 } }]);
  mocks.staffingRequirement.findMany.mockResolvedValue([{
    id: 'requirement', positionId: 'position', shiftType: 'MORNING', dayCategory: 'WEEKDAY', requiredCount: 1,
    position: { id: 'position', name: 'אחמ״ש', color: null, requiredRank: null, displayOrder: 2, baseRole: { rank: 2 } },
  }]);
  mocks.loadSchedulingInput.mockResolvedValue({ input, allAssignments: [], dateOverrides: [] });
});

describe('getScheduleWarnings', () => {
  it('returns no warnings without a schedule and does not query the database', async () => {
    expect(await getScheduleWarnings(null, 'facility')).toEqual([]);
    expect(mocks.schedule.findFirst).not.toHaveBeenCalled();
  });

  it('returns no warnings for a deleted schedule', async () => {
    mocks.schedule.findFirst.mockResolvedValue(null);
    expect(await getScheduleWarnings('missing', 'facility')).toEqual([]);
    expect(mocks.loadSchedulingInput).not.toHaveBeenCalled();
  });

  it('returns no warnings for a schedule of another facility and does not load scheduling input', async () => {
    mocks.schedule.findFirst.mockImplementation(async ({ where }) =>
      where.facilityId === 'facility' ? { draftVersionId: 'draft', publishedVersionId: 'published' } : null);
    expect(await getScheduleWarnings('schedule', 'other-facility')).toEqual([]);
    expect(mocks.schedule.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'schedule', facilityId: 'other-facility' } }));
    expect(mocks.loadSchedulingInput).not.toHaveBeenCalled();
  });

  it('returns mandatory shortages with serializable dates and names', async () => {
    const warnings = await getScheduleWarnings('schedule', 'facility');
    expect(warnings).toEqual(expect.arrayContaining([
      expect.objectContaining({ severity: 'ERROR', type: 'UNFILLED', positionName: 'אחמ״ש', message: expect.stringContaining('אחמ״ש: משובצים 0 מתוך 1 בחובה'), date: '2026-10-05', shiftType: 'MORNING' }),
      expect.objectContaining({ severity: 'ERROR', type: 'MIN_NOT_MET', employeeName: 'דוד לוי', positionName: 'אחמ״ש' }),
    ]));
    expect(warnings.some(w => w.severity === 'WARNING')).toBe(false);
    expect(warnings.find(w => w.type === 'MIN_NOT_MET' && w.shiftType === 'MORNING')?.message)
      .toBe('שבוע 1: נדרשות 2 משמרות בוקר; בפועל: 0.');
    expect(warnings.find(w => w.type === 'MIN_NOT_MET' && w.shiftType === 'EVENING')?.message)
      .toBe('שבוע 1: נדרשת משמרת ערב אחת; בפועל: 0.');
    for (const warning of warnings) expect(warning.message).not.toMatch(/[A-Za-z]/);
    expect(new Set(warnings.map(w => w.id)).size).toBe(warnings.length);
    expect(mocks.loadSchedulingInput).toHaveBeenCalledWith(mocks, 'schedule', 'facility', 'draft');
  });

  it('recalculates after an assignment is saved and removes the resolved shortage', async () => {
    const before = await getScheduleWarnings('schedule', 'facility');
    expect(before.some(w => w.type === 'UNFILLED' && w.positionName === 'אחמ״ש')).toBe(true);
    const assignment: EngineAssignment = {
      employeeId: 'employee', facilityId: 'facility', positionId: 'position', date, shiftType: 'MORNING', slotIndex: 0, isManualOverride: true,
    };
    mocks.loadSchedulingInput.mockResolvedValue({ input, allAssignments: [assignment], dateOverrides: [] });
    const after = await getScheduleWarnings('schedule', 'facility');
    expect(after.some(w => w.type === 'UNFILLED' || w.type === 'UNDERSTAFFED')).toBe(false);
  });
});
