import { describe, expect, it } from 'vitest';
import {
  applyTimeOffToAvailability, expandTimeOff, filterAffectedSlots, nextRequestStatus, parseIsoDate,
  requestStatusLabel, sortRequestsForQueue, transferDecision, validateDateRange, type AffectedSlot,
} from '@/features/requests/rules';

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const today = d('2026-10-17');

describe('nextRequestStatus', () => {
  it('moves a transfer through peer and manager approval', () => {
    const swap = { type: 'SHIFT_SWAP' as const, startDate: null };
    expect(nextRequestStatus({ ...swap, status: 'PENDING_PEER' }, 'PEER_ACCEPT', today)).toBe('PENDING_MANAGER');
    expect(nextRequestStatus({ ...swap, status: 'PENDING_PEER' }, 'PEER_DECLINE', today)).toBe('REJECTED');
    expect(nextRequestStatus({ ...swap, status: 'PENDING_PEER' }, 'APPROVE', today)).toBeNull();
    expect(nextRequestStatus({ ...swap, status: 'PENDING_MANAGER' }, 'APPROVE', today)).toBe('APPROVED');
    expect(nextRequestStatus({ ...swap, status: 'PENDING_MANAGER' }, 'PEER_ACCEPT', today)).toBeNull();
    expect(nextRequestStatus({ ...swap, status: 'APPROVED' }, 'CANCEL', today)).toBeNull();
  });

  it('prevents double decisions and allows cancelling future approved time off only', () => {
    expect(nextRequestStatus({ type: 'TIME_OFF', status: 'APPROVED', startDate: null }, 'APPROVE', today)).toBeNull();
    expect(nextRequestStatus({ type: 'TIME_OFF', status: 'REJECTED', startDate: null }, 'REJECT', today)).toBeNull();
    expect(nextRequestStatus({ type: 'TIME_OFF', status: 'APPROVED', startDate: d('2026-10-20') }, 'CANCEL', today)).toBe('CANCELLED');
    expect(nextRequestStatus({ type: 'TIME_OFF', status: 'APPROVED', startDate: today }, 'CANCEL', today)).toBeNull();
    expect(nextRequestStatus({ type: 'URGENT_ABSENCE', status: 'APPROVED', startDate: d('2026-10-20') }, 'CANCEL', today)).toBeNull();
    expect(nextRequestStatus({ type: 'TIME_OFF', status: 'PENDING_MANAGER', startDate: today }, 'CANCEL', today)).toBe('CANCELLED');
  });

  it('labels handled urgent absences', () => {
    expect(requestStatusLabel('URGENT_ABSENCE', 'APPROVED')).toBe('טופל');
    expect(requestStatusLabel('TIME_OFF', 'PENDING_PEER')).toBe('ממתין לעובד');
  });
});

describe('date validation', () => {
  it('parses strict dates and validates ranges', () => {
    expect(parseIsoDate('2026-02-30')).toBeNull();
    expect(parseIsoDate('x')).toBeNull();
    expect(validateDateRange(d('2026-10-18'), d('2026-10-20'), today, 60)).toBeNull();
    expect(validateDateRange(d('2026-10-16'), d('2026-10-20'), today, 60)).toMatch('עברו');
    expect(validateDateRange(d('2026-10-20'), d('2026-10-18'), today, 60)).toMatch('אחרי');
    expect(validateDateRange(d('2026-10-18'), d('2026-10-20'), today, 2)).toMatch('עד 2');
    expect(validateDateRange(null, null, today, 2)).not.toBeNull();
  });
});

describe('time off application', () => {
  it('expands clipped ranges and removes those dates from availability and preferences', () => {
    const timeOff = expandTimeOff([{ userId: 'a', startDate: d('2026-10-10'), endDate: d('2026-10-19') }], d('2026-10-18'), d('2026-10-31'));
    expect([...timeOff.get('a')!]).toEqual(['2026-10-18', '2026-10-19']);
    const availability = new Map([
      ['a', new Set(['2026-10-18|MORNING', '2026-10-19|NIGHT', '2026-10-20|MORNING'])],
      ['b', new Set(['2026-10-18|MORNING'])],
    ]);
    const preferences = new Map([['a', new Set(['2026-10-19|NIGHT', '2026-10-21|EVENING'])]]);
    applyTimeOffToAvailability(availability, preferences, timeOff);
    expect([...availability.get('a')!]).toEqual(['2026-10-20|MORNING']);
    expect([...availability.get('b')!]).toEqual(['2026-10-18|MORNING']);
    expect([...preferences.get('a')!]).toEqual(['2026-10-21|EVENING']);
  });
});

describe('affected slots', () => {
  it('keeps only the requester slots in range, ordered', () => {
    const base = { positionName: 'מאבטח', scheduleName: 'תקופה' };
    const slots: AffectedSlot[] = [
      { ...base, id: '1', userId: 'a', date: d('2026-10-20'), shiftType: 'NIGHT', versionKind: 'PUBLISHED' },
      { ...base, id: '2', userId: 'a', date: d('2026-10-20'), shiftType: 'MORNING', versionKind: 'DRAFT' },
      { ...base, id: '3', userId: 'a', date: d('2026-10-20'), shiftType: 'MORNING', versionKind: 'PUBLISHED' },
      { ...base, id: '4', userId: 'b', date: d('2026-10-20'), shiftType: 'MORNING', versionKind: 'PUBLISHED' },
      { ...base, id: '5', userId: 'a', date: d('2026-10-25'), shiftType: 'MORNING', versionKind: 'PUBLISHED' },
    ];
    expect(filterAffectedSlots(slots, 'a', d('2026-10-18'), d('2026-10-22')).map(s => s.id)).toEqual(['3', '2', '1']);
  });
});

describe('transfer decision', () => {
  it('blocks hard problems even with a reason and requires a reason for violations', () => {
    expect(transferDecision({ blocking: ['x'], violations: [] }, 'סיבה')).toBe('BLOCKED');
    expect(transferDecision({ blocking: [], violations: [{ code: 'REST_GAP', message: 'm' }] }, '  ')).toBe('NEEDS_OVERRIDE');
    expect(transferDecision({ blocking: [], violations: [{ code: 'REST_GAP', message: 'm' }] }, 'מאושר')).toBe('OK');
    expect(transferDecision({ blocking: [], violations: [] }, undefined)).toBe('OK');
  });
});

describe('queue order', () => {
  it('puts open urgent first, then open oldest first, then closed newest first', () => {
    const rows = [
      { id: 'closed-old', type: 'TIME_OFF' as const, status: 'APPROVED' as const, createdAt: '2026-10-01' },
      { id: 'open-new', type: 'TIME_OFF' as const, status: 'PENDING_MANAGER' as const, createdAt: '2026-10-10' },
      { id: 'urgent', type: 'URGENT_ABSENCE' as const, status: 'PENDING_MANAGER' as const, createdAt: '2026-10-12' },
      { id: 'open-old', type: 'SHIFT_SWAP' as const, status: 'PENDING_PEER' as const, createdAt: '2026-10-02' },
      { id: 'closed-new', type: 'URGENT_ABSENCE' as const, status: 'APPROVED' as const, createdAt: '2026-10-05' },
    ];
    expect(sortRequestsForQueue(rows).map(r => r.id)).toEqual(['urgent', 'open-old', 'open-new', 'closed-new', 'closed-old']);
  });
});
