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
  maxSlotsForPositionInWeek,
} from '../utils';

/** table-fixed reads width from <col>, not only from cells */
const POSITION_COL_PX = '3.5rem';
const narrowColCell = 'w-14 min-w-0 max-w-14';

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
  const weekIsos = sortedDays.map((d) => d.iso);

  const positionsOrdered = getOrderedPositionsForShift(capacity, shiftType);

  const allAssignedEntries = Object.values(assignments).flat();

  type VisualRow = {
    pos: { positionId: string; positionName: string; positionRank: number; positionColor: string | null };
    visualRow: number;
    rowSpan: number;
    isFirstRow: boolean;
    assignmentsByDay: Map<string, AssignmentSummary[]>;
  };

  const bodyRows: VisualRow[] = [];

  for (const pos of positionsOrdered) {
    const assignmentsByDay = new Map<string, AssignmentSummary[]>();

    for (const day of sortedDays) {
      const cellKey = createAssignmentCellKey({ date: day.iso, shiftType, positionId: pos.positionId });
      const sorted = [...(assignments[cellKey] ?? [])].sort((a, b) => a.slotIndex - b.slotIndex);
      assignmentsByDay.set(day.iso, sorted);
    }

    const maxSlotsInWeek = maxSlotsForPositionInWeek(capacity, shiftType, pos.positionId, weekIsos);
    if (maxSlotsInWeek <= 0) continue;

    Array.from({ length: maxSlotsInWeek }, (_, vr) => vr).forEach((vr, i) => {
      bodyRows.push({ pos, visualRow: vr, rowSpan: maxSlotsInWeek, isFirstRow: i === 0, assignmentsByDay });
    });
  }

  // Weekend columns have their own ordered slots, independent of weekday role rows.
  const weekendSlotsByDay = new Map(sortedDays
    .filter(day => day.dayOfWeek === 5 || day.dayOfWeek === 6)
    .map(day => [day.iso, positionsOrdered.flatMap(pos => {
      const required = getRequiredForDate(capacity, day.iso, shiftType, pos.positionId);
      return Array.from({ length: required }, (_, slotIndex) => ({ pos, slotIndex }));
    })]));

  if (bodyRows.length === 0) {
    return (
      <div className="mb-5" dir="rtl">
        <div
          className={cn(
            'flex items-center justify-between gap-2 px-3 py-2 rounded-t-xl text-white font-bold text-sm',
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

  return (
    <div className="mb-5" dir="rtl">
      <div
        className={cn(
          'flex items-center justify-between gap-2 px-3 py-2 rounded-t-xl text-white font-bold text-sm',
          style.header,
        )}
      >
        <div className="flex items-center gap-2">
          <span>{style.emoji}</span>
          <span>{style.label}</span>
        </div>
      </div>

      <div className="overflow-x-auto rounded-b-xl border border-border/60 border-t-0 bg-card">
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
                className={cn(
                  'px-0.5 py-1.5 border border-border/60 text-white font-semibold text-center text-xs leading-tight overflow-hidden text-ellipsis whitespace-nowrap',
                  style.header,
                )}
                title="תפקיד"
              >
                תפקיד
              </th>
              {sortedDays.map((day) => {
                const weekend = day.dayOfWeek === 5 || day.dayOfWeek === 6;
                const overrideLabel = getDateOverrideLabel(capacity, day.iso);
                return (
                  <th
                    key={day.iso}
                    className={cn(
                      'min-w-0 px-1 py-1.5 border border-border/60 text-white text-center',
                      style.header,
                      weekend && 'brightness-110',
                    )}
                  >
                    <div className="font-bold text-sm">{day.letter}</div>
                    <div className="text-xs font-normal opacity-80">{day.label}</div>
                    {overrideLabel ? (
                      <Badge
                        variant="secondary"
                        className="mt-0.5 h-auto max-w-full truncate px-1 py-0 text-[9px] font-medium"
                        title={`תקן חריג: ${overrideLabel}`}
                      >
                        {overrideLabel}
                      </Badge>
                    ) : null}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {bodyRows.map(({ pos, visualRow, rowSpan, isFirstRow, assignmentsByDay }, rowIdx) => {
              const hidePositionLabel = isGuardPositionLabel(pos.positionName);
              const isGrayPosition = pos.positionRank === 2 || pos.positionRank === 3;
              const grayStyle = isGrayPosition ? { backgroundColor: 'var(--muted)' } : undefined;

              return (
                <tr
                  key={`${pos.positionId}-${visualRow}`}
                  className="bg-card"
                  style={grayStyle ?? (pos.positionColor ? { backgroundColor: pos.positionColor + '28' } : undefined)}
                >
                  {isFirstRow ? (
                    <td
                      rowSpan={rowSpan}
                      style={grayStyle}
                      className={cn(
                        narrowColCell,
                        'align-middle px-0.5 py-1 text-center border border-border/60 bg-muted/20 text-xs font-semibold leading-tight overflow-hidden',
                        hidePositionLabel && 'text-transparent',
                        isGrayPosition && 'border-border',
                      )}
                      title={hidePositionLabel ? undefined : pos.positionName}
                      aria-label={hidePositionLabel ? pos.positionName : undefined}
                    >
                      <div className="truncate">
                        {hidePositionLabel ? '' : pos.positionName}
                        {isGrayPosition && !hidePositionLabel && (
                          <span className="mr-1 text-[0.65rem] font-normal text-muted-foreground" aria-hidden>
                            (מחליף)
                          </span>
                        )}
                      </div>
                    </td>
                  ) : null}
                  {sortedDays.map((day) => {
                    const weekendSlots = weekendSlotsByDay.get(day.iso);
                    const weekendSlot = weekendSlots?.[rowIdx];
                    if (weekendSlots && !weekendSlot) {
                      // A single blank area below the configured slots, without phantom role cells.
                      return rowIdx === weekendSlots.length ? (
                        <td key={day.iso} rowSpan={bodyRows.length - rowIdx} className="border border-border/60 bg-card schedule-slot-closed" aria-label="אין תקנים נוספים" />
                      ) : null;
                    }
                    const cellPosition = weekendSlot?.pos ?? pos;
                    const cellRow = weekendSlot?.slotIndex ?? visualRow;
                    const required = getRequiredForDate(capacity, day.iso, shiftType, cellPosition.positionId);
                    const cellKey = createAssignmentCellKey({ date: day.iso, shiftType, positionId: cellPosition.positionId });
                    const sortedAssignments = weekendSlot
                      ? [...(assignments[cellKey] ?? [])].sort((a, b) => a.slotIndex - b.slotIndex)
                      : assignmentsByDay.get(day.iso)!;
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
        </table>
      </div>

    </div>
  );
}
