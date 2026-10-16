import { describe, expect, it } from 'vitest';
import { dueWindowActions } from '@/features/periods/submission-window';

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
