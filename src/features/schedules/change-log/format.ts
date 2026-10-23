import type { ShiftType } from '@/generated/prisma/client';

const SHIFT_LABELS: Record<ShiftType, string> = {
  MORNING: 'בוקר',
  EVENING: 'ערב',
  NIGHT: 'לילה',
};

const DAY_NAMES = ['יום א', 'יום ב', 'יום ג', 'יום ד', 'יום ה', 'יום ו', 'שבת'] as const;

export type ChangeLogSlotPayload = {
  date?: string;
  shiftType?: ShiftType;
  assignment?: { employeeName?: string; userId?: string } | null;
  violations?: { message?: string }[];
};

export function dayNameForIso(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number);
  return DAY_NAMES[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
}

export function formatShiftDateLabel(iso: string): string {
  const [year, month, day] = iso.split('-');
  return `${day}/${month}/${year}`;
}

/** Logged on auto-regenerate; filtered from the manager change list (noise, not a staffing edit). */
export const AUTO_REGEN_CHANGE_REASON = 'יצירה אוטומטית מחדש; איושים נעולים נשמרו';

export type AssignmentChangeKind = 'joined' | 'left' | 'swapped';

export type AssignmentChangeParts = {
  /** Employee name(s); +/− / swap is shown via actionKind in the UI. */
  summary: string;
  /** בוקר / ערב / לילה */
  shiftLabel: string;
  /** DD/MM/YYYY · יום X */
  shiftDateLabel: string;
  kind: AssignmentChangeKind | null;
};

/** Human-readable assignment change parts: name, shift type, date + weekday. */
export function formatAssignmentChangeSummary(input: {
  oldName: string;
  newName: string;
  dateIso: string;
  shiftType: ShiftType;
  sameEmployeeChanges?: string;
}): AssignmentChangeParts {
  const shiftLabel = SHIFT_LABELS[input.shiftType];
  const shiftDateLabel = `${formatShiftDateLabel(input.dateIso)} · ${dayNameForIso(input.dateIso)}`;

  if (!input.oldName && input.newName) {
    return { summary: input.newName, shiftLabel, shiftDateLabel, kind: 'joined' };
  }
  if (input.oldName && !input.newName) {
    return { summary: input.oldName, shiftLabel, shiftDateLabel, kind: 'left' };
  }
  if (input.oldName !== input.newName) {
    return {
      summary: `${input.newName} החליף את ${input.oldName}`,
      shiftLabel,
      shiftDateLabel,
      kind: 'swapped',
    };
  }

  return { summary: input.sameEmployeeChanges || '', shiftLabel, shiftDateLabel, kind: null };
}

export function summarizeChangeLogPayloads(
  beforeData: unknown,
  afterData: unknown,
): Omit<AssignmentChangeParts, 'kind'> & { kind: AssignmentChangeKind } | null {
  const before = (beforeData ?? null) as ChangeLogSlotPayload | null;
  const after = (afterData ?? null) as ChangeLogSlotPayload | null;
  const cell = after?.date ? after : before;
  if (!cell?.date || !cell.shiftType) return null;

  const oldName = before?.assignment?.employeeName ?? '';
  const newName = after?.assignment?.employeeName ?? '';
  // Freeform rows, or same-employee hour/lock edits — keep the stored message.
  if ((!oldName && !newName) || (oldName && newName && oldName === newName)) return null;

  const formatted = formatAssignmentChangeSummary({
    oldName,
    newName,
    dateIso: cell.date.slice(0, 10),
    shiftType: cell.shiftType,
  });
  if (!formatted.kind) return null;
  return {
    summary: formatted.summary,
    shiftLabel: formatted.shiftLabel,
    shiftDateLabel: formatted.shiftDateLabel,
    kind: formatted.kind,
  };
}
