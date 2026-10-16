import { beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  tx: { scheduleVersion: { update: vi.fn() }, schedule: { update: vi.fn() }, scheduleChange: { create: vi.fn() } },
  checkedVersion: vi.fn(), loadSchedulingInput: vi.fn(), validateAssignments: vi.fn(), saveScheduleAnalysis: vi.fn(),
}));
vi.mock('@/lib/db/auth-helpers', () => ({ requireManager: async () => ({ facilityId: 'facility', userId: 'manager' }) }));
vi.mock('@/features/schedules/services/transactions', () => ({
  scheduleTransaction: async (_actor: unknown, fn: (tx: unknown) => unknown) => fn(mocks.tx),
  checkedVersion: mocks.checkedVersion,
}));
vi.mock('@/features/schedules/generation/queries', () => ({ loadSchedulingInput: mocks.loadSchedulingInput }));
vi.mock('@/features/schedules/generation/recalculate', () => ({ saveScheduleAnalysis: mocks.saveScheduleAnalysis }));
vi.mock('@/features/scheduling-engine/validate', () => ({ validateAssignments: mocks.validateAssignments }));

import { publishSchedule } from '@/features/schedules/draft-schedule/actions';
const expected = { versionId: 'schedule', revision: 1 };
beforeEach(() => {
  vi.clearAllMocks();
  mocks.checkedVersion.mockResolvedValue({ version: { id: 'schedule', status: 'DRAFT', revision: 1 } });
  mocks.loadSchedulingInput.mockResolvedValue({ input: {}, allAssignments: [], capacities: [] });
  mocks.validateAssignments.mockReturnValue([]);
  mocks.saveScheduleAnalysis.mockResolvedValue({ warnings: [] });
});

it('publishes without a typed reason and records a default audit description', async () => {
  expect(await publishSchedule('schedule', expected)).toEqual({ ok: true });
  expect(mocks.tx.schedule.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'PUBLISHED' }) }));
  expect(mocks.tx.scheduleChange.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ reason: 'פרסום שיבוץ', changeType: 'PUBLISH' }) }));
});
it('still blocks publication when assignment validation fails', async () => {
  mocks.validateAssignments.mockReturnValue(['חריגה מכמות העובדים הנדרשת']);
  expect(await publishSchedule('schedule', expected)).toEqual({ error: 'חריגה מכמות העובדים הנדרשת' });
  expect(mocks.tx.schedule.update).not.toHaveBeenCalled();
});
it('still requests confirmation for critical problems before publication', async () => {
  mocks.saveScheduleAnalysis.mockResolvedValue({ warnings: [{ severity: 'ERROR', message: 'חסר בקר' }] });
  expect(await publishSchedule('schedule', expected)).toEqual(expect.objectContaining({ requiresConfirmation: true, issueCount: 1 }));
  expect(mocks.tx.schedule.update).not.toHaveBeenCalled();
  expect(await publishSchedule('schedule', { ...expected, confirmIssues: true })).toEqual({ ok: true });
});
