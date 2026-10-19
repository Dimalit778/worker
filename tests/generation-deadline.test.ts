import { expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  tx: { schedule: { update: vi.fn() }, scheduleSlot: { findMany: vi.fn().mockResolvedValue([]), deleteMany: vi.fn() }, scheduleVersion: { update: vi.fn() }, scheduleChange: { create: vi.fn() } },
}));
vi.mock('@/lib/db/auth-helpers', () => ({ requireManager: async () => ({ userId: 'manager', facilityId: 'facility' }) }));
vi.mock('@/features/schedules/services/transactions', () => ({
  scheduleTransaction: async (_actor: unknown, fn: (tx: unknown) => unknown) => fn(mocks.tx),
  editableDraft: async () => ({ schedule: { id: 'schedule', submissionClosesAt: new Date('2026-10-01') }, version: { id: 'draft' } }),
}));
vi.mock('@/features/schedules/generation/queries', () => ({ loadSchedulingInput: async () => ({ input: { manualAssignments: [] }, assignments: [] }) }));
vi.mock('@/features/scheduling-engine/generate-schedule', () => ({ generateSchedule: () => ({ assignments: [], stats: {} }) }));
vi.mock('@/features/scheduling-engine/validate', () => ({ validateAssignments: () => [] }));
vi.mock('@/features/schedules/generation/recalculate', () => ({ saveScheduleAnalysis: async () => ({ warnings: [] }) }));
import { generateAutoSchedule } from '@/features/schedules/generation/actions';
it('regenerates repeatedly without overwriting the original submission deadline', async () => {
  for (let revision = 0; revision < 2; revision++) {
    expect(await generateAutoSchedule('schedule', { versionId: 'draft', revision })).toMatchObject({ ok: true });
  }
  expect(mocks.tx.schedule.update).not.toHaveBeenCalled();
  expect(mocks.tx.scheduleVersion.update).toHaveBeenCalledTimes(2);
});
