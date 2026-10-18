import type { ShiftType } from '@/generated/prisma/client';
import { queryKeys } from '@/lib/react-query/query-keys';

export const dateOverridesQueryKey = (facilityId: string) =>
  [...queryKeys.settings.all(), 'dateOverrides', facilityId] as const;

export const MAX_OVERRIDE_COUNT = 50;
export const MAX_OVERRIDE_LABEL_LENGTH = 60;
const SHIFT_TYPES: ShiftType[] = ['MORNING', 'EVENING', 'NIGHT'];

export type DateOverrideEntryInput = { positionId: string; shiftType: ShiftType; amount: number };

export type DateOverrideInput = {
  date: string;
  label: string | null;
  entries: DateOverrideEntryInput[];
};

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/** Validates a date override form; `allowedPositionIds` are this facility's staffed, active positions. */
export function validateDateOverrideInput(
  input: DateOverrideInput,
  todayIso: string,
  allowedPositionIds: ReadonlySet<string>,
): { ok: true; value: DateOverrideInput } | { error: string } {
  if (typeof input?.date !== 'string' || !isIsoDate(input.date)) return { error: 'תאריך לא תקין' };
  if (input.date < todayIso) return { error: 'לא ניתן להגדיר תקן חריג לתאריך שעבר' };

  const label = typeof input.label === 'string' ? input.label.trim() : '';
  if (label.length > MAX_OVERRIDE_LABEL_LENGTH) return { error: `התיאור ארוך מדי (עד ${MAX_OVERRIDE_LABEL_LENGTH} תווים)` };

  if (!Array.isArray(input.entries) || input.entries.length === 0) return { error: 'יש להגדיר לפחות תקן אחד' };
  const seen = new Set<string>();
  for (const entry of input.entries) {
    if (!SHIFT_TYPES.includes(entry.shiftType)) return { error: 'משמרת לא תקינה' };
    if (!allowedPositionIds.has(entry.positionId)) return { error: 'התפקיד לא נמצא' };
    if (!Number.isInteger(entry.amount) || entry.amount < 0 || entry.amount > MAX_OVERRIDE_COUNT) {
      return { error: `התקן חייב להיות מספר שלם בין 0 ל־${MAX_OVERRIDE_COUNT}` };
    }
    const key = `${entry.shiftType}|${entry.positionId}`;
    if (seen.has(key)) return { error: 'תקן כפול לאותה משמרת ותפקיד' };
    seen.add(key);
  }

  return {
    ok: true,
    value: {
      date: input.date,
      label: label || null,
      entries: input.entries.map(({ positionId, shiftType, amount }) => ({ positionId, shiftType, amount })),
    },
  };
}
