import type { ShiftType } from '@/generated/prisma/client';

// Pure helpers for manager readiness views. No database or server imports here.

export type SubmissionStatus = 'NOT_SUBMITTED' | 'DRAFT' | 'SUBMITTED' | 'UNSUBMITTED_CHANGES';

export const SUBMISSION_STATUS_LABELS: Record<SubmissionStatus, string> = {
  NOT_SUBMITTED: 'לא הוגש',
  DRAFT: 'טיוטה בלבד',
  SUBMITTED: 'הוגש',
  UNSUBMITTED_CHANGES: 'הוגש, יש שינויים שלא הוגשו',
};

/** Display order: who still needs attention first. */
export const SUBMISSION_STATUS_ORDER: SubmissionStatus[] = ['NOT_SUBMITTED', 'DRAFT', 'UNSUBMITTED_CHANGES', 'SUBMITTED'];

export function submissionStatusOf(
  submission: { submittedAt: Date | string | null; draftEntries: unknown } | null | undefined,
): SubmissionStatus {
  if (!submission) return 'NOT_SUBMITTED';
  const hasDraft = submission.draftEntries !== null && submission.draftEntries !== undefined;
  if (submission.submittedAt) return hasDraft ? 'UNSUBMITTED_CHANGES' : 'SUBMITTED';
  return hasDraft ? 'DRAFT' : 'NOT_SUBMITTED';
}

export function countByStatus(statuses: SubmissionStatus[]): Record<SubmissionStatus, number> {
  const counts: Record<SubmissionStatus, number> = { NOT_SUBMITTED: 0, DRAFT: 0, SUBMITTED: 0, UNSUBMITTED_CHANGES: 0 };
  for (const status of statuses) counts[status] += 1;
  return counts;
}

// ─── Employee load ──────────────────────────────────────────────────────────

export type LoadSlot = { userId: string; date: Date; shiftType: ShiftType; startsAt: Date; endsAt: Date };
export type LoadEmployee = { id: string; displayName: string; roleName: string | null };

export type EmployeeLoadRow = {
  employeeId: string;
  displayName: string;
  roleName: string | null;
  totalShifts: number;
  morningShifts: number;
  eveningShifts: number;
  nightShifts: number;
  /** Shifts whose calendar date is Friday or Saturday. */
  weekendShifts: number;
  hours: number;
};

/** True for Friday/Saturday. Slot dates are stored as UTC-midnight calendar dates. */
export function isWeekendDate(date: Date) {
  const day = date.getUTCDay();
  return day === 5 || day === 6;
}

/**
 * Per-employee shift counts and hours (endsAt − startsAt, so shifts crossing midnight count correctly).
 * Every listed employee gets a row; slots of unlisted employees are ignored.
 * Sorted by hours, then shifts (descending), then name.
 */
export function aggregateEmployeeLoad(slots: LoadSlot[], employees: LoadEmployee[]): EmployeeLoadRow[] {
  const rows = new Map<string, EmployeeLoadRow>(
    employees.map((e) => [e.id, {
      employeeId: e.id, displayName: e.displayName, roleName: e.roleName,
      totalShifts: 0, morningShifts: 0, eveningShifts: 0, nightShifts: 0, weekendShifts: 0, hours: 0,
    }]),
  );
  for (const slot of slots) {
    const row = rows.get(slot.userId);
    if (!row) continue;
    row.totalShifts += 1;
    if (slot.shiftType === 'MORNING') row.morningShifts += 1;
    else if (slot.shiftType === 'EVENING') row.eveningShifts += 1;
    else if (slot.shiftType === 'NIGHT') row.nightShifts += 1;
    if (isWeekendDate(slot.date)) row.weekendShifts += 1;
    row.hours += Math.max(0, slot.endsAt.getTime() - slot.startsAt.getTime()) / 3_600_000;
  }
  return [...rows.values()]
    .map((row) => ({ ...row, hours: Math.round(row.hours * 100) / 100 }))
    .sort((a, b) => b.hours - a.hours || b.totalShifts - a.totalShifts || a.displayName.localeCompare(b.displayName, 'he'));
}

// ─── Version diff ───────────────────────────────────────────────────────────

export type DiffSlot = {
  /** YYYY-MM-DD */
  date: string;
  shiftType: ShiftType;
  positionId: string;
  positionName: string;
  employeeId: string | null;
  employeeName: string | null;
};

export type SlotChange = {
  kind: 'added' | 'removed' | 'reassigned';
  date: string;
  shiftType: ShiftType;
  positionId: string;
  positionName: string;
  /** Employee in the published version (removed / reassigned). */
  fromEmployeeId: string | null;
  fromEmployeeName: string | null;
  /** Employee in the draft (added / reassigned). */
  toEmployeeId: string | null;
  toEmployeeName: string | null;
};

const SHIFT_RANK: Record<ShiftType, number> = { MORNING: 0, EVENING: 1, NIGHT: 2 };

/**
 * Compares assignments per cell (date + shift + position). Slot numbers are ignored on purpose:
 * regeneration renumbers slots, which would otherwise show unchanged people as moved.
 * Within a cell, a removed and an added employee are paired as a reassignment.
 */
export function diffVersions(published: DiffSlot[], draft: DiffSlot[]): SlotChange[] {
  type Cell = { date: string; shiftType: ShiftType; positionId: string; positionName: string; before: DiffSlot[]; after: DiffSlot[] };
  const cells = new Map<string, Cell>();
  const cellOf = (slot: DiffSlot) => {
    const key = `${slot.date}|${slot.shiftType}|${slot.positionId}`;
    let cell = cells.get(key);
    if (!cell) {
      cell = { date: slot.date, shiftType: slot.shiftType, positionId: slot.positionId, positionName: slot.positionName, before: [], after: [] };
      cells.set(key, cell);
    }
    return cell;
  };
  for (const slot of published) if (slot.employeeId) cellOf(slot).before.push(slot);
  for (const slot of draft) if (slot.employeeId) cellOf(slot).after.push(slot);

  const byName = (a: DiffSlot, b: DiffSlot) => (a.employeeName ?? '').localeCompare(b.employeeName ?? '', 'he') || (a.employeeId ?? '').localeCompare(b.employeeId ?? '');
  const changes: SlotChange[] = [];
  for (const cell of cells.values()) {
    const remaining = [...cell.after];
    const removed: DiffSlot[] = [];
    for (const slot of cell.before) {
      const index = remaining.findIndex((other) => other.employeeId === slot.employeeId);
      if (index >= 0) remaining.splice(index, 1);
      else removed.push(slot);
    }
    removed.sort(byName);
    remaining.sort(byName);
    const base = { date: cell.date, shiftType: cell.shiftType, positionId: cell.positionId, positionName: cell.positionName || remaining[0]?.positionName || '' };
    const pairs = Math.max(removed.length, remaining.length);
    for (let i = 0; i < pairs; i++) {
      const from = removed[i];
      const to = remaining[i];
      changes.push({
        ...base,
        kind: from && to ? 'reassigned' : from ? 'removed' : 'added',
        fromEmployeeId: from?.employeeId ?? null,
        fromEmployeeName: from?.employeeName ?? null,
        toEmployeeId: to?.employeeId ?? null,
        toEmployeeName: to?.employeeName ?? null,
      });
    }
  }
  return changes.sort((a, b) => a.date.localeCompare(b.date) || SHIFT_RANK[a.shiftType] - SHIFT_RANK[b.shiftType] || a.positionName.localeCompare(b.positionName, 'he'));
}

export function countChanges(changes: SlotChange[]) {
  return {
    added: changes.filter((c) => c.kind === 'added').length,
    removed: changes.filter((c) => c.kind === 'removed').length,
    reassigned: changes.filter((c) => c.kind === 'reassigned').length,
  };
}
