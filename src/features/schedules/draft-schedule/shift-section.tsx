'use client';

import { cn } from '@/lib/utils';
import type {
  AssignmentMap,
  AssignmentSummary,
  OverflowCandidateMap,
  ScheduleCapacityRule,
  ScheduleEmployeeOption,
  WeekDay,
} from '../types';
import { SHIFT_STYLES } from '../constants';
import type { ShiftType } from '@/generated/prisma/client';
import { AssignmentCell } from './assignment-cell';
import { Badge } from '@/components/ui/badge';
import {
  blockedEmployeeIdsForShift,
  createAssignmentCellKey,
  getDateOverrideLabel,
  getOrderedPositionsForShift,
  getRequiredForDate,
  isGuardPositionLabel,
} from '../utils';

/** table-fixed reads width from <col>, not only from cells */
const POSITION_COL_PX = '3rem';
const narrowColCell = 'w-12 min-w-0 max-w-12';
/** Shared header/body padding so day + position cells share one rhythm */
const headerCellPad = 'px-0.5 py-1';
const gridBorder = 'border border-border/60';

type ShiftSectionProps = {
  shiftType: ShiftType;
  weekDays: WeekDay[];
  assignments: AssignmentMap;
  overflowCandidates?: OverflowCandidateMap;
  employees: ScheduleEmployeeOption[];
  capacity: ScheduleCapacityRule[];
  scheduleId: string;

  facilityId: string;
  readonly?: boolean;
  highlightedEmployeeId?: string | null;
};

export function ShiftSection(props: ShiftSectionProps) {
  const {
    shiftType,
    weekDays,
    assignments,
    overflowCandidates,
    employees,
    capacity,
    scheduleId,
    facilityId,
    readonly,
    highlightedEmployeeId,
  } = props;
  const style = SHIFT_STYLES[shiftType];
  const sortedDays = [...weekDays].sort((a, b) => a.dayOfWeek - b.dayOfWeek);

  const positionsOrdered = getOrderedPositionsForShift(capacity, shiftType);
  const overrideByDay = new Map(sortedDays.map((day) => [day.iso, getDateOverrideLabel(capacity, day.iso)]));
  const showOverrideRow = [...overrideByDay.values()].some(Boolean);

  const allAssignedEntries = Object.values(assignments).flat();

  type VisualRow = {
    pos: { positionId: string; positionName: string; positionRank: number; positionColor: string | null };
    visualRow: number;
    rowSpan: number;
    isFirstRow: boolean;
    assignmentsByDay: Map<string, AssignmentSummary[]>;
  };

  const bodyRows: VisualRow[] = [];
  const isWeekendDay = (day: WeekDay) => day.dayOfWeek === 5 || day.dayOfWeek === 6;
  const weekdayIsos = sortedDays.filter((day) => !isWeekendDay(day)).map((day) => day.iso);
  const assignedCount = (iso: string, positionId: string) =>
    assignments[createAssignmentCellKey({ date: iso, shiftType, positionId })]?.length ?? 0;
  // A day shows every required slot (open ones stay empty), plus any extra assignments beyond the requirement.
  const slotCount = (iso: string, positionId: string) =>
    Math.max(assignedCount(iso, positionId), getRequiredForDate(capacity, iso, shiftType, positionId));

  for (const pos of positionsOrdered) {
    const assignmentsByDay = new Map<string, AssignmentSummary[]>();

    for (const day of sortedDays) {
      const cellKey = createAssignmentCellKey({ date: day.iso, shiftType, positionId: pos.positionId });
      const sorted = [...(assignments[cellKey] ?? [])].sort((a, b) => a.slotIndex - b.slotIndex);
      assignmentsByDay.set(day.iso, sorted);
    }

    const maxSlotsInWeek = Math.max(0, ...weekdayIsos.map((iso) => slotCount(iso, pos.positionId)));
    if (maxSlotsInWeek <= 0) continue;

    Array.from({ length: maxSlotsInWeek }, (_, vr) => vr).forEach((vr, i) => {
      bodyRows.push({ pos, visualRow: vr, rowSpan: maxSlotsInWeek, isFirstRow: i === 0, assignmentsByDay });
    });
  }

  // Weekend columns have their own ordered slots, independent of weekday role rows.
  const weekendSlotsByDay = new Map(sortedDays
    .filter(isWeekendDay)
    .map(day => [day.iso, positionsOrdered.flatMap(pos => {
      const count = slotCount(day.iso, pos.positionId);
      return Array.from({ length: count }, (_, slotIndex) => ({ pos, slotIndex }));
    })]));
  const weekendRows = Math.max(0, ...[...weekendSlotsByDay.values()].map((slots) => slots.length));

  if (bodyRows.length === 0 && weekendRows === 0) {
    return (
      <div className="mb-4" dir="rtl">
        <div
          className={cn(
            'flex items-center justify-between gap-2 rounded-xl px-3 py-1.5 text-sm font-bold text-white',
            style.header,
          )}
        >
          <div className="flex items-center gap-2">
            <span>{style.emoji}</span>
            <span>{style.label}</span>
          </div>
          <span className="text-xs font-normal opacity-80">אין תקנים למשמרת זו</span>
        </div>
      </div>
    );
  }

  const colCount = 1 + sortedDays.length;
  const totalRows = Math.max(bodyRows.length, weekendRows);

  const dayTotals = new Map(sortedDays.map((day) => {
    let assigned = 0;
    let required = 0;
    for (const pos of positionsOrdered) {
      assigned += assignedCount(day.iso, pos.positionId);
      required += getRequiredForDate(capacity, day.iso, shiftType, pos.positionId);
    }
    return [day.iso, { assigned, required }];
  }));

  return (
    <div className="mb-3" dir="rtl">
      <div className={cn('overflow-x-auto rounded-lg bg-card', gridBorder)}>
        <table className="w-full table-fixed border-collapse text-xs" dir="rtl">
          <colgroup>
            <col style={{ width: POSITION_COL_PX }} />
            {sortedDays.map((day) => (
              <col key={day.iso} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th
                colSpan={colCount}
                className={cn(
                  'border-b border-border/60 px-2 py-1.5 text-center text-sm font-bold text-white',
                  style.header,
                )}
              >
                <span className="inline-flex items-center gap-1.5">
                  <span>{style.emoji}</span>
                  <span>{style.label}</span>
                </span>
              </th>
            </tr>
            <tr>
              <th
                className={cn(
                  headerCellPad,
                  gridBorder,
                  'align-middle text-center text-xs font-semibold leading-none text-white',
                  style.header,
                )}
                title="תפקיד"
              >
                תפקיד
              </th>
              {sortedDays.map((day) => {
                const overrideLabel = overrideByDay.get(day.iso);
                return (
                  <th
                    key={day.iso}
                    className={cn(
                      headerCellPad,
                      gridBorder,
                      'min-w-0 align-middle text-center text-white',
                      style.header,
                    )}
                  >
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="text-xs font-bold leading-none">{day.letter}</span>
                      <span className="text-xs font-normal leading-none opacity-80">{day.label}</span>
                      {showOverrideRow ? (
                        <span className="flex h-3.5 w-full items-center justify-center">
                          {overrideLabel ? (
                            <Badge
                              variant="secondary"
                              className="h-auto max-w-full truncate px-1 py-0 text-xs font-medium leading-none"
                              title={`תקן חריג: ${overrideLabel}`}
                            >
                              {overrideLabel}
                            </Badge>
                          ) : null}
                        </span>
                      ) : null}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: totalRows }, (_, rowIdx) => {
              // Rows past the role rows pad the grid up to the longest weekend column.
              const row = bodyRows[rowIdx] as VisualRow | undefined;
              const pos = row?.pos;
              const hidePositionLabel = pos ? isGuardPositionLabel(pos.positionName) : true;
              const isGrayPosition = pos?.positionRank === 2 || pos?.positionRank === 3;
              const grayStyle = isGrayPosition ? { backgroundColor: 'var(--muted)' } : undefined;

              return (
                <tr
                  key={pos ? `${pos.positionId}-${row.visualRow}` : `filler-${rowIdx}`}
                  className="bg-card"
                  style={grayStyle ?? (pos?.positionColor ? { backgroundColor: pos.positionColor + '28' } : undefined)}
                >
                  {!row && rowIdx === bodyRows.length ? (
                    <td rowSpan={totalRows - rowIdx} className={cn(narrowColCell, gridBorder, 'bg-muted/20')} />
                  ) : null}
                  {row?.isFirstRow ? (
                    <td
                      rowSpan={row.rowSpan}
                      style={grayStyle}
                      className={cn(
                        narrowColCell,
                        gridBorder,
                        'align-middle px-0.5 py-0.5 text-center text-[11px] font-medium leading-tight text-muted-foreground overflow-hidden bg-muted/20',
                        hidePositionLabel && 'text-transparent',
                        isGrayPosition && 'border-border',
                      )}
                      title={hidePositionLabel ? undefined : row.pos.positionName}
                      aria-label={hidePositionLabel ? row.pos.positionName : undefined}
                    >
                      <div className="truncate">{hidePositionLabel ? '' : row.pos.positionName}</div>
                    </td>
                  ) : null}
                  {sortedDays.map((day) => {
                    const weekendSlots = weekendSlotsByDay.get(day.iso);
                    const weekendSlot = weekendSlots?.[rowIdx];
                    if (weekendSlots && !weekendSlot) {
                      // A single blank area below the configured slots, without phantom role cells.
                      return rowIdx === weekendSlots.length ? (
                        <td key={day.iso} rowSpan={totalRows - rowIdx} className={cn(gridBorder, 'bg-card schedule-slot-closed')} aria-label="אין תקנים נוספים" />
                      ) : null;
                    }
                    if (!weekendSlot && !row) {
                      return (
                        <td key={day.iso} className={cn(gridBorder, 'bg-card schedule-slot-closed px-0.5 py-0.5')} aria-hidden>
                          <div className="min-h-6" />
                        </td>
                      );
                    }
                    const cellPosition = weekendSlot?.pos ?? row!.pos;
                    const cellRow = weekendSlot?.slotIndex ?? row!.visualRow;
                    const required = getRequiredForDate(capacity, day.iso, shiftType, cellPosition.positionId);
                    const cellKey = createAssignmentCellKey({ date: day.iso, shiftType, positionId: cellPosition.positionId });
                    const sortedAssignments = weekendSlot
                      ? [...(assignments[cellKey] ?? [])].sort((a, b) => a.slotIndex - b.slotIndex)
                      : row!.assignmentsByDay.get(day.iso)!;
                    const assignment = sortedAssignments[cellRow] ?? null;
                    const closed = cellRow >= required;
                    const targetSlotIndex = assignment?.slotIndex ?? cellRow;
                    const overflowKey = `${cellKey}-${targetSlotIndex}` as keyof OverflowCandidateMap;

                    const blockedOnShift = blockedEmployeeIdsForShift(assignments, day.iso, shiftType);

                    const swapCandidates = assignment
                      ? Array.from(
                          new Map(
                            allAssignedEntries
                              .filter((a) => a.id !== assignment.id && a.employeeId !== assignment.employeeId)
                              .map((a) => [
                                a.employeeId,
                                { assignmentId: a.id, employeeId: a.employeeId, displayName: a.employeeDisplayName },
                              ]),
                          ).values(),
                        )
                      : [];

                    return (
                      <AssignmentCell
                        key={day.iso}
                        closed={closed}
                        assignment={assignment}
                        employees={employees}
                        assignedEmployeeIds={blockedOnShift}
                        scheduleId={scheduleId}
                        facilityId={facilityId}
                        date={day.iso}
                        shiftType={shiftType}
                        positionId={cellPosition.positionId}
                        positionColor={cellPosition.positionColor}
                        mutedPosition={cellPosition.positionRank === 2 || cellPosition.positionRank === 3}
                        slotIndex={targetSlotIndex}
                        overflowCandidates={overflowCandidates?.[overflowKey] ?? []}
                        readonly={readonly}
                        highlightedEmployeeId={highlightedEmployeeId}
                        swapCandidates={swapCandidates}
                      />
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-transparent">
              <td
                className={cn(narrowColCell, gridBorder, 'bg-muted text-center align-middle text-[11px] font-medium text-muted-foreground')}
                aria-label="סיכום תקנים"
              >
                תקן
              </td>
              {sortedDays.map((day) => {
                const { assigned, required } = dayTotals.get(day.iso)!;
                return (
                  <td
                    key={day.iso}
                    className={cn(gridBorder, 'bg-muted px-0.5 py-1.5 text-center align-middle')}
                    title={`${assigned} עובדים מתוך ${required} בתקן`}
                  >
                    <span
                      className="inline-flex items-center justify-center gap-1 text-xs leading-none text-muted-foreground tabular-nums"
                      aria-label={`${assigned} מתוך ${required}`}
                    >
                      <span>{required}</span>
                      <span aria-hidden>/</span>
                      <span>{assigned}</span>
                    </span>
                  </td>
                );
              })}
            </tr>
          </tfoot>
        </table>
      </div>

    </div>
  );
}
