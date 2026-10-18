import { describe, expect, it } from 'vitest';
import { canExtendDeadline, extensionError, EXTENSION_REASON_MAX } from '@/features/periods/extension';
import { parseJerusalemLocal, periodStartInstant } from '@/features/periods/submission-window';

const now = new Date('2026-10-01T09:00:00.000Z');
const base = {
  status: 'DRAFT' as const,
  publishedVersionId: null,
  periodStart: periodStartInstant('2026-10-04'),
  opensAt: parseJerusalemLocal('2026-09-30T10:00')!,
  closesAt: parseJerusalemLocal('2026-10-01T17:00')!,
  newDeadline: parseJerusalemLocal('2026-10-02T17:00'),
  reason: 'עומס הגשות',
  now,
};

describe('deadline extension validation', () => {
  it('accepts a later deadline before the period starts while the window is open', () => {
    expect(extensionError(base)).toBeNull();
  });

  it('reopens a window that already closed', () => {
    const closed = { ...base, closesAt: parseJerusalemLocal('2026-09-30T20:00')! };
    expect(extensionError(closed)).toBeNull();
  });

  it('rejects published or archived schedules', () => {
    expect(extensionError({ ...base, status: 'PUBLISHED' })).toMatch('לפני פרסום');
    expect(extensionError({ ...base, status: 'ARCHIVED' })).toMatch('לפני פרסום');
    expect(extensionError({ ...base, publishedVersionId: 'v1' })).toMatch('לפני פרסום');
  });

  it('requires a non-empty, bounded reason', () => {
    expect(extensionError({ ...base, reason: '   ' })).toBe('יש לציין סיבה להארכה');
    expect(extensionError({ ...base, reason: 'א'.repeat(EXTENSION_REASON_MAX + 1) })).toMatch('ארוכה מדי');
  });

  it('rejects invalid, past, earlier or post-start deadlines', () => {
    expect(extensionError({ ...base, newDeadline: null })).toBe('המועד החדש לא תקין');
    expect(extensionError({ ...base, newDeadline: new Date(now.getTime() - 1) })).toBe('המועד החדש כבר עבר');
    expect(extensionError({ ...base, newDeadline: base.closesAt })).toMatch('אחרי מועד ההגשה הנוכחי');
    expect(extensionError({ ...base, newDeadline: base.periodStart })).toMatch('לפני תחילת התקופה');
  });

  it('requires the new deadline to be after the window opens', () => {
    const future = {
      ...base,
      opensAt: parseJerusalemLocal('2026-10-02T10:00')!,
      closesAt: parseJerusalemLocal('2026-09-30T10:00')!,
      newDeadline: parseJerusalemLocal('2026-10-02T09:00'),
    };
    expect(extensionError(future)).toMatch('אחרי פתיחת ההגשה');
  });

  it('is not offered once the period has started', () => {
    expect(canExtendDeadline(base, now)).toBe(true);
    expect(canExtendDeadline(base, base.periodStart)).toBe(false);
  });
});
