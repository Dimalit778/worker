import type { ShiftType } from '@/generated/prisma/client';

const SHIFTS: { key: ShiftType; label: string; bg: string; text: string; border: string }[] = [
  { key: 'MORNING', label: 'בוקר', bg: 'bg-amber-400', text: 'text-amber-950', border: 'border-amber-300' },
  { key: 'EVENING', label: 'ערב', bg: 'bg-sky-500', text: 'text-white', border: 'border-sky-300' },
  { key: 'NIGHT', label: 'לילה', bg: 'bg-indigo-700', text: 'text-white', border: 'border-indigo-400' },
];

const DAY_HE = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];
const datesInRange = (start: string, end: string): string[] => {
  const dates: string[] = [];
  const cur = new Date(`${start}T12:00:00Z`);
  const last = new Date(`${end}T12:00:00Z`);
  while (cur <= last) {
    dates.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return dates;
};

export type AvailabilityRecordInput = {
  date: Date | string;
  shiftType: ShiftType;
  isAvailable: boolean;
  preference?: 'AVAILABLE' | 'PREFERRED' | 'UNAVAILABLE';
};

function availabilityEntriesToRecord(entries: AvailabilityRecordInput[]): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const e of entries) {
    const iso =
      e.date instanceof Date ? e.date.toISOString().slice(0, 10) : String(e.date).slice(0, 10);
    out[`${iso}-${e.shiftType}`] = e.isAvailable;
  }
  return out;
}

export { SHIFTS, DAY_HE, datesInRange, availabilityEntriesToRecord };

export function availabilityPreferencesToRecord(entries: AvailabilityRecordInput[]): Record<string, 'AVAILABLE' | 'PREFERRED' | 'UNAVAILABLE'> {
  return Object.fromEntries(entries.map(e => {
    const iso = e.date instanceof Date ? e.date.toISOString().slice(0,10) : String(e.date).slice(0,10);
    return [`${iso}-${e.shiftType}`, e.preference ?? (e.isAvailable ? 'AVAILABLE' : 'UNAVAILABLE')];
  }));
}
export function countAvailableEntries(entries: Record<string, boolean | 'AVAILABLE' | 'PREFERRED' | 'UNAVAILABLE'>): number {
  return Object.values(entries).filter(v => v === true || v === 'AVAILABLE' || v === 'PREFERRED').length;
}

export type Preference = 'AVAILABLE' | 'PREFERRED' | 'UNAVAILABLE';
export type PreferenceMap = Record<string, Preference>;
export type AvailabilityStatus = 'NOT_SUBMITTED' | 'DRAFT' | 'SUBMITTED' | 'UNSUBMITTED_CHANGES';

export const PREFERENCES: Preference[] = ['AVAILABLE', 'PREFERRED', 'UNAVAILABLE'];
export const PREFERENCE_LABEL: Record<Preference, string> = {
  AVAILABLE: 'זמין',
  PREFERRED: 'מעדיף',
  UNAVAILABLE: 'לא זמין',
};
export const NO_CHOICE_LABEL = 'לא נבחר';
export const AVAILABILITY_STATUS_LABEL: Record<AvailabilityStatus, string> = {
  NOT_SUBMITTED: 'לא הוגש',
  DRAFT: 'טיוטה',
  SUBMITTED: 'הוגש',
  UNSUBMITTED_CHANGES: 'שינויים שלא הוגשו',
};

const ENTRY_KEY = /^(\d{4}-\d{2}-\d{2})-(MORNING|EVENING|NIGHT)$/;

/** Derived submission status; draftEntries hold saved-but-unsubmitted edits. */
export function deriveAvailabilityStatus(
  form: { submittedAt: Date | string | null; hasDraft: boolean } | null,
): AvailabilityStatus {
  if (!form) return 'NOT_SUBMITTED';
  if (form.submittedAt == null) return form.hasDraft ? 'DRAFT' : 'NOT_SUBMITTED';
  return form.hasDraft ? 'UNSUBMITTED_CHANGES' : 'SUBMITTED';
}

/** Status to show while there are local edits not yet saved: never "submitted". */
export function displayAvailabilityStatus(status: AvailabilityStatus, dirty: boolean): AvailabilityStatus {
  return dirty && status === 'SUBMITTED' ? 'UNSUBMITTED_CHANGES' : status;
}

export function hasSubmitted(status: AvailabilityStatus): boolean {
  return status === 'SUBMITTED' || status === 'UNSUBMITTED_CHANGES';
}

/** Cycle: no choice → AVAILABLE → PREFERRED → UNAVAILABLE → no choice. */
export function nextPreference(current: Preference | undefined): Preference | undefined {
  if (!current) return 'AVAILABLE';
  if (current === 'AVAILABLE') return 'PREFERRED';
  if (current === 'PREFERRED') return 'UNAVAILABLE';
  return undefined;
}

/** Normalize legacy boolean values (true = AVAILABLE, false = UNAVAILABLE); drops anything else. */
export function normalizeEntries(raw: Record<string, Preference | boolean | null | undefined>): PreferenceMap {
  const out: PreferenceMap = {};
  for (const [key, value] of Object.entries(raw)) {
    const pref = value === true ? 'AVAILABLE' : value === false ? 'UNAVAILABLE' : value;
    if (pref && PREFERENCES.includes(pref)) out[key] = pref;
  }
  return out;
}

/** Parse the stored draftEntries JSON; null when no draft is stored. */
export function parseDraftEntries(json: unknown): PreferenceMap | null {
  if (json == null || typeof json !== 'object' || Array.isArray(json)) return null;
  const out: PreferenceMap = {};
  for (const [key, value] of Object.entries(json as Record<string, unknown>)) {
    if (ENTRY_KEY.test(key) && PREFERENCES.includes(value as Preference)) out[key] = value as Preference;
  }
  return out;
}

export type ValidatedEntry = { key: string; date: string; shiftType: ShiftType; preference: Preference };

/** Validate keys/dates/preferences against the period range. Omitted keys mean "no choice". */
export function validateAvailabilityEntries(
  entries: unknown,
  startISO: string,
  endISO: string,
): ValidatedEntry[] {
  if (entries == null || typeof entries !== 'object' || Array.isArray(entries)) throw new Error('משמרת לא תקינה');
  return Object.entries(entries as Record<string, unknown>).map(([key, raw]) => {
    const match = ENTRY_KEY.exec(key);
    if (!match) throw new Error('משמרת לא תקינה');
    const date = new Date(`${match[1]}T00:00:00Z`);
    const preference = raw === true ? 'AVAILABLE' : raw === false ? 'UNAVAILABLE' : raw;
    if (
      !PREFERENCES.includes(preference as Preference) ||
      !Number.isFinite(date.getTime()) ||
      date.toISOString().slice(0, 10) !== match[1] ||
      match[1] < startISO ||
      match[1] > endISO
    )
      throw new Error('זמינות או תאריך אינם תקינים');
    return { key, date: match[1], shiftType: match[2] as ShiftType, preference: preference as Preference };
  });
}

/** Split dates into consecutive 7-day weeks; a final partial week is kept as is (never an empty week). */
export function chunkWeeks(dates: string[]): string[][] {
  const weeks: string[][] = [];
  for (let i = 0; i < dates.length; i += 7) weeks.push(dates.slice(i, i + 7));
  return weeks;
}

/** Set every date × shift to `preference`, or clear them when it is undefined. */
export function applyPreference(
  entries: PreferenceMap,
  dates: string[],
  shifts: ShiftType[],
  preference: Preference | undefined,
): PreferenceMap {
  const next = { ...entries };
  for (const date of dates)
    for (const shift of shifts) {
      const key = `${date}-${shift}`;
      if (preference) next[key] = preference;
      else delete next[key];
    }
  return next;
}

/** Copy choices between weeks by weekday offset (index within the week), including "no choice". */
export function copyWeek(entries: PreferenceMap, from: string[], to: string[], shifts: ShiftType[]): PreferenceMap {
  const next = { ...entries };
  for (let i = 0; i < Math.min(from.length, to.length); i++)
    for (const shift of shifts) {
      const value = entries[`${from[i]}-${shift}`];
      const target = `${to[i]}-${shift}`;
      if (value) next[target] = value;
      else delete next[target];
    }
  return next;
}

export function sameEntries(a: PreferenceMap, b: PreferenceMap): boolean {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((key) => a[key] === b[key]);
}
