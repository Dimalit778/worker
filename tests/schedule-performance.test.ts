import { afterEach, expect, it, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import type { CurrentScheduleData } from '@/features/schedules/types';
import { queryKeys } from '@/lib/react-query/query-keys';

const db = vi.hoisted(() => ({
  schedule: { findFirst: vi.fn() },
  user: { findMany: vi.fn() },
  staffingRequirement: { findMany: vi.fn() },
  availabilitySubmission: { findMany: vi.fn() },
  scheduleSlot: { findMany: vi.fn() },
}));
vi.mock('@/lib/db/client', () => ({ prisma: db }));
vi.mock('@/lib/db/auth-helpers', () => ({ requireManager: vi.fn(), requireSession: vi.fn() }));
import { getDraftScheduleData } from '@/features/schedules/assignments/queries';
import { applyScheduleEdit } from '@/features/schedules/hooks';
afterEach(() => vi.clearAllMocks());

it('loads each draft dataset once and reuses it for assignments, problems and submission counts', async () => {
  const date = new Date('2026-10-05T00:00:00Z');
  db.schedule.findFirst.mockResolvedValue({ id: 's', facilityId: 'f', name: 'טיוטה', startDate: date, endDate: date, status: 'DRAFT', draftVersionId: 'draft', draftVersion: { id: 'draft', revision: 3, number: 2 } });
  db.user.findMany.mockResolvedValue([{ id: 'e', displayName: 'דוד', roleId: 'r', role: { id: 'r', name: 'מאבטח', rank: 4 } }]);
  db.staffingRequirement.findMany.mockResolvedValue([{ id: 'c', positionId: 'p', shiftType: 'MORNING', dayCategory: 'WEEKDAY', requiredCount: 1, position: { name: 'מאבטח', color: null, requiredRank: 4, displayOrder: 4, baseRole: null } }]);
  db.availabilitySubmission.findMany.mockResolvedValue([{ userId: 'e', availabilities: [] }]);
  db.scheduleSlot.findMany.mockResolvedValueOnce([{ id: 'a', userId: 'e', facilityId: 'f', positionId: 'p', date, shiftType: 'MORNING', slotNumber: 2, source: 'MANUAL', isLocked: false }]).mockResolvedValueOnce([]);
  const data = await getDraftScheduleData('f', 's');
  expect(db.schedule.findFirst).toHaveBeenCalledTimes(1);
  expect(db.user.findMany).toHaveBeenCalledTimes(1);
  expect(db.staffingRequirement.findMany).toHaveBeenCalledTimes(1);
  expect(db.availabilitySubmission.findMany).toHaveBeenCalledTimes(1);
  expect(db.scheduleSlot.findMany).toHaveBeenCalledTimes(2); // current and neighboring periods
  expect(data?.assignments['2026-10-05-MORNING-p'][0]).toMatchObject({ employeeDisplayName: 'דוד', positionName: 'מאבטח', slotIndex: 0 });
  expect(data?.availabilitySubmissionSummary?.submittedCount).toBe(1);
  expect(data?.fairness?.[0].draftShifts).toBe(1);
  expect(data?.warnings.length).toBeGreaterThan(0);
  expect(data?.revision).toBe(3);
});

it('updates only draft caches and preserves published views and newer revisions', async () => {
  const client = new QueryClient();
  const key = [...queryKeys.schedules.draft(), 's'];
  const initial = { scheduleId: 's', versionId: 'draft', editingVersionNumber: 2, revision: 3, assignments: {}, warnings: [] } as unknown as CurrentScheduleData;
  client.setQueryData(key, initial);
  client.setQueryData(queryKeys.schedules.current(), { ...initial, versionId: 'published' });
  client.setQueryData(queryKeys.schedules.upcoming(), { ...initial, scheduleId: 'other' });
  client.setQueryData(queryKeys.dashboard.all(), { count: 1 });
  const refetch = vi.spyOn(client, 'refetchQueries');
  const update = { scheduleId: 's', versionId: 'draft', revision: 4, assignments: {}, warnings: [], fairness: [] };
  await applyScheduleEdit(client, update);
  expect(client.getQueryData(key)).toMatchObject({ revision: 4, editingVersionNumber: 2 });
  expect(client.getQueryData(queryKeys.schedules.current())).toMatchObject({ revision: 3, versionId: 'published' });
  expect(client.getQueryData(queryKeys.schedules.upcoming())).toMatchObject({ revision: 3 });
  expect(client.getQueryState(queryKeys.dashboard.all())?.isInvalidated).toBe(true);
  expect(refetch).not.toHaveBeenCalled();
  await applyScheduleEdit(client, { ...update, revision: 2 });
  expect(client.getQueryData(key)).toMatchObject({ revision: 4 });
  await applyScheduleEdit(client, { ...update, versionId: 'old-draft', revision: 99 });
  expect(client.getQueryData(key)).toMatchObject({ revision: 4, versionId: 'draft' });
  client.clear();
});
