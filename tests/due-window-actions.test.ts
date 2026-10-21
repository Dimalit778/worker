import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dueWindowActions } from '@/features/periods/submission-window';
import { processDueSubmissionWindows } from '@/features/periods/process-windows';

const mocks = vi.hoisted(() => ({
  schedule: { findMany: vi.fn(), updateMany: vi.fn() },
  user: { findMany: vi.fn() },
  email: { sendSubmissionOpenedEmails: vi.fn(), sendSubmissionReminderEmails: vi.fn() },
}));
vi.mock('@/lib/db/client', () => ({ prisma: mocks }));
vi.mock('@/features/periods/notify-submission', () => mocks.email);

const opensAt = new Date('2026-10-01T08:00:00Z');
const closesAt = new Date('2026-10-05T08:00:00Z');
const base = { opensAt, closesAt, openNotifiedAt: null, reminderSentAt: null };

describe('dueWindowActions', () => {
  it('does nothing before the window opens', () => {
    expect(dueWindowActions({ ...base, now: new Date('2026-10-01T07:59:00Z') })).toEqual({ open: false, remind: false });
  });

  it('sends the opened email once the window is open', () => {
    expect(dueWindowActions({ ...base, now: new Date('2026-10-02T08:00:00Z') })).toEqual({ open: true, remind: false });
    expect(dueWindowActions({ ...base, now: new Date('2026-10-02T08:00:00Z'), openNotifiedAt: new Date() })).toEqual({
      open: false,
      remind: false,
    });
  });

  it('sends the reminder within 24h of closing', () => {
    const now = new Date('2026-10-04T08:00:00Z');
    expect(dueWindowActions({ ...base, now, openNotifiedAt: new Date() })).toEqual({ open: false, remind: true });
    expect(dueWindowActions({ ...base, now, openNotifiedAt: new Date(), reminderSentAt: new Date() }).remind).toBe(false);
  });

  it('does nothing at or after close', () => {
    expect(dueWindowActions({ ...base, now: closesAt })).toEqual({ open: false, remind: false });
  });
});

describe('processDueSubmissionWindows recipients', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-04T08:00:00Z'));
    vi.clearAllMocks();
    mocks.schedule.findMany.mockResolvedValue([
      { id: 's1', facilityId: 'f1', name: 'שיבוץ', startDate: new Date('2026-10-11'), endDate: new Date('2026-10-17'), submissionOpensAt: opensAt, submissionClosesAt: closesAt, openNotifiedAt: null, reminderSentAt: null },
    ]);
    mocks.schedule.updateMany.mockResolvedValue({ count: 1 });
    mocks.user.findMany.mockResolvedValue([{ email: 'employee@example.com' }]);
    mocks.email.sendSubmissionOpenedEmails.mockResolvedValue({ ok: true, sent: 1 });
    mocks.email.sendSubmissionReminderEmails.mockResolvedValue({ ok: true, sent: 1 });
  });
  afterEach(() => vi.useRealTimers());

  it('excludes rank-1 managers from open and reminder emails', async () => {
    expect(await processDueSubmissionWindows()).toMatchObject({ opened: 1, reminded: 1 });
    const queries = mocks.user.findMany.mock.calls.map(([args]) => args.where);
    expect(queries).toHaveLength(2);
    for (const where of queries) {
      expect(where).toMatchObject({ facilityId: 'f1', isActive: true, systemRole: 'USER', role: { rank: { not: 1 } } });
    }
  });
});
