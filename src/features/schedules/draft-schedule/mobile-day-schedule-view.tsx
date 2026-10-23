'use client';

import { cn } from '@/lib/utils';
import type {
  AssignmentMap,
  OverflowCandidateMap,
  ScheduleCapacityRule,
  ScheduleEmployeeOption,
  WeekDay,
} from '../types';
import { SHIFT_ORDER, SHIFT_STYLES } from '../constants';
import { AssignmentCell } from './assignment-cell';
import {
  blockedEmployeeIdsForShift,
  createAssignmentCellKey,
  emptySlotIndex,
  getCapacityForCell,
  getDayCategoryForDate,
  getOrderedPositionsForShift,
} from '../utils';

type Props = {
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

/**
 * Dense Data Surface, mobile variant: Day → Shift → Position hierarchy, stacked full-width rows.
 * Mirrors ShiftSection's exact capacity/assignment logic (same utils, same `closed` rule), just grouped
 * day-first instead of shift-first, since a table is unusable at phone width.
 */
export function MobileDayScheduleView(props: Props) {
  const { weekDays, assignments, overflowCandidates, employees, capacity, scheduleId, facilityId, readonly, highlightedEmployeeId } = props;
  const sortedDays = [...weekDays].sort((a, b) => a.dayOfWeek - b.dayOfWeek);
  const allAssignedEntries = Object.values(assignments).flat();

  return (
    <div className="flex flex-col gap-4" dir="rtl">
      {sortedDays.map((day) => {
        const cat = getDayCategoryForDate(day.iso);
        const weekend = day.dayOfWeek === 5 || day.dayOfWeek === 6;

        return (
          <div key={day.iso} className="rounded-xl border border-border/60 bg-card overflow-hidden">
            <div className={cn('flex items-center justify-between px-3 py-2', weekend && 'bg-muted/60')}>
              <span className="text-sm font-bold">{day.label}</span>
              <span className="text-xs text-muted-foreground">{day.letter}</span>
            </div>

            {SHIFT_ORDER.map((shiftType) => {
              const style = SHIFT_STYLES[shiftType];
              const positionsForShift = getOrderedPositionsForShift(capacity, shiftType);
              const rows = positionsForShift.flatMap((pos) => {
                const required = getCapacityForCell(capacity, cat, shiftType, pos.positionId);
                if (required <= 0) return [];
                const cellKey = createAssignmentCellKey({ date: day.iso, shiftType, positionId: pos.positionId });
                const sortedAssignments = [...(assignments[cellKey] ?? [])].sort((a, b) => a.slotIndex - b.slotIndex);
                return Array.from({ length: required }, (_, slotIndex) => ({ pos, slotIndex, sortedAssignments }));
              });

              if (rows.length === 0) return null;

              const blockedOnShift = blockedEmployeeIdsForShift(assignments, day.iso, shiftType);

              return (
                <div key={shiftType} className="border-t border-border/60">
                  <div className={cn('flex items-center gap-2 px-3 py-1.5 text-white text-xs font-semibold', style.header)}>
                    <span>{style.emoji}</span>
                    <span>{style.label}</span>
                  </div>
                  <div className="flex flex-col gap-1.5 p-2">
                    {rows.map(({ pos, slotIndex, sortedAssignments }) => {
                      const assignment = sortedAssignments[slotIndex] ?? null;
                      const targetSlotIndex = assignment?.slotIndex ?? emptySlotIndex(sortedAssignments, slotIndex - sortedAssignments.length);
                      const overflowKey = `${createAssignmentCellKey({ date: day.iso, shiftType, positionId: pos.positionId })}-${targetSlotIndex}` as keyof OverflowCandidateMap;
                      const swapCandidates = assignment
                        ? Array.from(
                            new Map(
                              allAssignedEntries
                                .filter((a) => a.id !== assignment.id && a.employeeId !== assignment.employeeId)
                                .map((a) => [a.employeeId, { assignmentId: a.id, employeeId: a.employeeId, displayName: a.employeeDisplayName }]),
                            ).values(),
                          )
                        : [];
                      const isGrayPosition = pos.positionRank === 2 || pos.positionRank === 3;

                      return (
                        <div key={`${pos.positionId}-${slotIndex}`} className="flex items-center gap-2">
                          <span className="w-20 shrink-0 truncate text-xs font-medium text-muted-foreground">
                            {pos.positionName}
                          </span>
                          <AssignmentCell
                            as="row"
                            closed={false}
                            assignment={assignment}
                            employees={employees}
                            assignedEmployeeIds={blockedOnShift}
                            scheduleId={scheduleId}
                            facilityId={facilityId}
                            date={day.iso}
                            shiftType={shiftType}
                            positionId={pos.positionId}
                            mutedPosition={isGrayPosition}
                            slotIndex={targetSlotIndex}
                            overflowCandidates={overflowCandidates?.[overflowKey] ?? []}
                            readonly={readonly}
                            highlightedEmployeeId={highlightedEmployeeId}
                            swapCandidates={swapCandidates}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
