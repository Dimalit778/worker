import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  db: {
    schedule: { findFirst: vi.fn(), findMany: vi.fn() },
    user: { count: vi.fn(), findMany: vi.fn() },
    role: { findMany: vi.fn() }, district: { findMany: vi.fn() },
    position: { findMany: vi.fn() },
    systemSetting: { findUnique: vi.fn(), upsert: vi.fn() },
    scheduleChange: { findMany: vi.fn() },
  },
  session: vi.fn(), input: vi.fn(), details: vi.fn(),
}));
vi.mock('next/cache', async () => import('./helpers/cache-runtime'));
vi.mock('@/lib/db/client', () => ({ prisma: mocks.db }));
vi.mock('@/lib/db/auth-helpers', () => ({ requireSession: mocks.session, requireManager: vi.fn() }));
vi.mock('@/features/schedules/generation/queries', () => ({ loadSchedulingInput: mocks.input }));
vi.mock('@/features/schedules/assignments/loaded-details', () => ({ loadedScheduleDetails: mocks.details }));
import { entries } from './helpers/cache-runtime';
import { expireEmployeeData, expireFacilityData } from '@/lib/cache/data-cache';
import { getDraftScheduleData } from '@/features/schedules/assignments/queries';
import { getManagerDashboardData } from '@/features/dashboard/queries';
import { getAdminCourtsData } from '@/features/admin/actions';
import { getPositions, getShiftStaffingPositions, getSubmissionWindowRule, saveSubmissionWindowSetting } from '@/features/settings/queries';
import { getFacilitySchedules } from '@/features/schedules/schedulecard/queries';
import { getActiveAndUpcomingScheduleChangeLogs } from '@/features/schedules/change-log/queries';

const date = new Date('2026-10-20T00:00:00Z');
beforeEach(() => {
  vi.clearAllMocks(); entries.clear();
  mocks.session.mockResolvedValue({ user: { facilityId: 'facility' } });
  mocks.db.schedule.findFirst.mockResolvedValue(null);
  mocks.db.schedule.findMany.mockResolvedValue([]);
  mocks.db.user.count.mockResolvedValue(0);
  mocks.db.role.findMany.mockResolvedValue([]);
  mocks.db.district.findMany.mockResolvedValue([]);
});

it('shares the positions entry between both settings grids and expires after a change', async () => {
  mocks.db.position.findMany.mockResolvedValue([{ id: 'p', name: 'מאבטח', color: null, requiredRank: 4, displayOrder: 4, baseRole: null }]);
  await getPositions('facility'); await getShiftStaffingPositions('facility');
  expect(mocks.db.position.findMany).toHaveBeenCalledTimes(1);
  expireFacilityData('facility'); await getPositions('facility');
  expect(mocks.db.position.findMany).toHaveBeenCalledTimes(2);
});

it('saving a submission rule refreshes the next settings read', async () => {
  const rule = { openWeekday: 0, openTime: '10:00', closeWeekday: 4, closeTime: '18:00' };
  mocks.db.systemSetting.findUnique.mockResolvedValue({ value: rule });
  await getSubmissionWindowRule('facility'); await getSubmissionWindowRule('facility');
  expect(mocks.db.systemSetting.findUnique).toHaveBeenCalledTimes(1);
  await saveSubmissionWindowSetting('facility', rule);
  await getSubmissionWindowRule('facility');
  expect(mocks.db.systemSetting.findUnique).toHaveBeenCalledTimes(2);
});

it('reuses draft analysis but reloads after related employee/availability/capacity changes', async () => {
  const row = { id: 's', name: 'טיוטה', startDate: date, endDate: date, status: 'DRAFT', submissionOpensAt: date, submissionClosesAt: date, draftVersionId: 'v', draftVersion: { id: 'v', revision: 2, number: 1 } };
  mocks.db.schedule.findFirst.mockResolvedValue(row);
  mocks.input.mockResolvedValue({ dateOverrides: [], forms: [] });
  mocks.details.mockReturnValue({ employees: [], assignments: {}, warnings: [], fairness: [], capacity: [] });
  await getDraftScheduleData('facility', 's'); await getDraftScheduleData('facility', 's');
  expect(mocks.input).toHaveBeenCalledTimes(1);
  expireEmployeeData('facility');
  await getDraftScheduleData('facility', 's');
  expect(mocks.input).toHaveBeenCalledTimes(2);
  mocks.db.schedule.findFirst.mockResolvedValue({ ...row, draftVersion: { ...row.draftVersion, revision: 3 } });
  expect((await getDraftScheduleData('facility', 's'))?.revision).toBe(3);
  expect(mocks.input).toHaveBeenCalledTimes(3);
  expect(mocks.db.schedule.findFirst).toHaveBeenCalledTimes(4);
});

it('checks manager authorization on every dashboard read, including a cache hit', async () => {
  await getManagerDashboardData(2026); await getManagerDashboardData(2026);
  expect(mocks.db.role.findMany).toHaveBeenCalledTimes(1);
  expect(mocks.session).toHaveBeenCalledTimes(2);
  mocks.session.mockRejectedValueOnce(new Error('unauthorized'));
  await expect(getManagerDashboardData(2026)).rejects.toThrow('unauthorized');
});

it('shares admin data across screens but checks authorization before every read', async () => {
  await getAdminCourtsData(); await getAdminCourtsData();
  expect(mocks.db.district.findMany).toHaveBeenCalledTimes(1);
  expect(mocks.session).toHaveBeenNthCalledWith(2, 'ADMIN');
  mocks.session.mockRejectedValueOnce(new Error('unauthorized'));
  await expect(getAdminCourtsData()).rejects.toThrow('unauthorized');
});

it('refreshes the schedule list after a schedule mutation expires its facility', async () => {
  await getFacilitySchedules('facility'); await getFacilitySchedules('facility');
  expect(mocks.db.schedule.findMany).toHaveBeenCalledTimes(1);
  expireFacilityData('facility'); await getFacilitySchedules('facility');
  expect(mocks.db.schedule.findMany).toHaveBeenCalledTimes(2);
});

it('loads grouped history together and preserves Date values after cache serialization', async () => {
  const change = { id: 'change', createdAt: date, changeType: 'UPDATE', reason: 'עדכון', version: { number: 2 }, changedBy: { displayName: 'מנהל' } };
  mocks.db.schedule.findMany.mockResolvedValue([{ id: 's', name: 'שיבוץ', changes: [change] }]);
  const first = await getActiveAndUpcomingScheduleChangeLogs('facility');
  const second = await getActiveAndUpcomingScheduleChangeLogs('facility');
  expect(second).toEqual(first);
  expect(second[0].entries[0].createdAt).toBeInstanceOf(Date);
  expect(mocks.db.schedule.findMany).toHaveBeenCalledTimes(1);
  expect(mocks.db.scheduleChange.findMany).not.toHaveBeenCalled();
});
