import type { EmployeeRequestStatus, EmployeeRequestType, ShiftType } from '@/generated/prisma/enums';

export const TIME_OFF_MAX_DAYS = 60;
export const URGENT_MAX_DAYS = 14;
export const TEXT_MAX_LENGTH = 500;
export const OPEN_STATUSES = ['PENDING_PEER', 'PENDING_MANAGER'] as const satisfies readonly EmployeeRequestStatus[];

export const REQUEST_TYPE_LABELS: Record<EmployeeRequestType, string> = {
  TIME_OFF: 'חופשה',
  SHIFT_SWAP: 'העברת משמרת',
  URGENT_ABSENCE: 'היעדרות דחופה',
};

export const REQUEST_STATUS_LABELS: Record<EmployeeRequestStatus, string> = {
  PENDING_PEER: 'ממתין לעובד',
  PENDING_MANAGER: 'ממתין למנהל',
  APPROVED: 'אושר',
  REJECTED: 'נדחה',
  CANCELLED: 'בוטל',
};

/** Urgent absences are "handled" rather than approved: nothing in the schedule changes automatically. */
export function requestStatusLabel(type: EmployeeRequestType, status: EmployeeRequestStatus): string {
  return type === 'URGENT_ABSENCE' && status === 'APPROVED' ? 'טופל' : REQUEST_STATUS_LABELS[status];
}

export function isOpenStatus(status: EmployeeRequestStatus): boolean {
  return (OPEN_STATUSES as readonly EmployeeRequestStatus[]).includes(status);
}

export type RequestAction = 'CANCEL' | 'PEER_ACCEPT' | 'PEER_DECLINE' | 'APPROVE' | 'REJECT';

/**
 * State machine guard: returns the next status, or null when the action is not allowed.
 * `today` is the facility's calendar date at UTC midnight.
 */
export function nextRequestStatus(
  request: { type: EmployeeRequestType; status: EmployeeRequestStatus; startDate: Date | null },
  action: RequestAction,
  today: Date,
): EmployeeRequestStatus | null {
  const { type, status } = request;
  switch (action) {
    case 'CANCEL':
      if (isOpenStatus(status)) return 'CANCELLED';
      if (type === 'TIME_OFF' && status === 'APPROVED' && request.startDate && request.startDate > today) return 'CANCELLED';
      return null;
    case 'PEER_ACCEPT':
      return type === 'SHIFT_SWAP' && status === 'PENDING_PEER' ? 'PENDING_MANAGER' : null;
    case 'PEER_DECLINE':
      return type === 'SHIFT_SWAP' && status === 'PENDING_PEER' ? 'REJECTED' : null;
    case 'APPROVE':
      return status === 'PENDING_MANAGER' ? 'APPROVED' : null;
    case 'REJECT':
      return isOpenStatus(status) ? 'REJECTED' : null;
  }
}

const DAY_MS = 86_400_000;

export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Parses a strict YYYY-MM-DD civil date to UTC midnight, or null. */
export function parseIsoDate(value: unknown): Date | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && toIsoDate(date) === value ? date : null;
}

export function daysInRange(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / DAY_MS) + 1;
}

/** Validates a requested date range; returns an error message or null. */
export function validateDateRange(start: Date | null, end: Date | null, today: Date, maxDays: number): string | null {
  if (!start || !end) return 'יש לבחור תאריך התחלה ותאריך סיום';
  if (start > end) return 'תאריך הסיום חייב להיות אחרי תאריך ההתחלה';
  if (start < today) return 'לא ניתן לבקש תאריכים שעברו';
  if (daysInRange(start, end) > maxDays) return `ניתן לבקש עד ${maxDays} ימים`;
  return null;
}

export function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.trim().slice(0, TEXT_MAX_LENGTH) : '';
}

/** Expands each inclusive range (clipped to [from, to]) into YYYY-MM-DD keys per user. */
export function expandTimeOff(
  ranges: { userId: string; startDate: Date | null; endDate: Date | null }[],
  from: Date,
  to: Date,
): Map<string, Set<string>> {
  const result = new Map<string, Set<string>>();
  for (const range of ranges) {
    if (!range.startDate || !range.endDate) continue;
    const start = range.startDate > from ? range.startDate : from;
    const end = range.endDate < to ? range.endDate : to;
    for (let t = start.getTime(); t <= end.getTime(); t += DAY_MS) {
      const days = result.get(range.userId) ?? new Set<string>();
      days.add(toIsoDate(new Date(t)));
      result.set(range.userId, days);
    }
  }
  return result;
}

/**
 * Removes approved time-off dates from the engine's availability and preference maps (in place).
 * Keys in those maps have the form `YYYY-MM-DD|SHIFT`.
 */
export function applyTimeOffToAvailability(
  availability: Map<string, Set<string>>,
  preferences: Map<string, Set<string>>,
  timeOff: Map<string, Set<string>>,
): void {
  for (const [userId, dates] of timeOff) {
    for (const map of [availability, preferences]) {
      const keys = map.get(userId);
      if (!keys) continue;
      for (const key of [...keys]) {
        if (dates.has(key.split('|')[0])) keys.delete(key);
      }
    }
  }
}

export type AffectedSlot = {
  id: string;
  userId: string | null;
  date: Date;
  shiftType: ShiftType;
  positionName: string;
  scheduleName: string;
  versionKind: 'PUBLISHED' | 'DRAFT';
};

const SHIFT_RANK: Record<ShiftType, number> = { MORNING: 0, EVENING: 1, NIGHT: 2 };

/** Keeps the user's slots inside the inclusive range, ordered by date, shift and published before draft. */
export function filterAffectedSlots<T extends AffectedSlot>(slots: T[], userId: string, start: Date, end: Date): T[] {
  return slots
    .filter(slot => slot.userId === userId && slot.date >= start && slot.date <= end)
    .sort((a, b) =>
      a.date.getTime() - b.date.getTime() ||
      SHIFT_RANK[a.shiftType] - SHIFT_RANK[b.shiftType] ||
      (a.versionKind === b.versionKind ? 0 : a.versionKind === 'PUBLISHED' ? -1 : 1));
}

export type TransferCheck = { blocking: string[]; violations: { code: string; message: string }[] };
export type TransferDecision = 'BLOCKED' | 'NEEDS_OVERRIDE' | 'OK';

/** Hard problems can never be approved; rule violations need a non-empty manager reason. */
export function transferDecision(check: TransferCheck, overrideReason: string | undefined): TransferDecision {
  if (check.blocking.length) return 'BLOCKED';
  if (check.violations.length && !overrideReason?.trim()) return 'NEEDS_OVERRIDE';
  return 'OK';
}

/** Queue order: open urgent first, then other open requests (oldest first), then closed (newest first). */
export function sortRequestsForQueue<T extends { type: EmployeeRequestType; status: EmployeeRequestStatus; createdAt: string }>(requests: T[]): T[] {
  const group = (r: T) => (isOpenStatus(r.status) ? (r.type === 'URGENT_ABSENCE' ? 0 : 1) : 2);
  return [...requests].sort((a, b) => {
    const diff = group(a) - group(b);
    if (diff) return diff;
    return group(a) === 2 ? b.createdAt.localeCompare(a.createdAt) : a.createdAt.localeCompare(b.createdAt);
  });
}
