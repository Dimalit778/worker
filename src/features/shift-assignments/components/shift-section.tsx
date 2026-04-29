import { cn } from '@/lib/utils';
import type { AssignmentMap, OverflowCandidateMap, ScheduleCapacityRule, ScheduleEmployeeOption, WeekDay } from '../types';
import { SHIFT_STYLES } from '../constants';
import type { ShiftType } from '@/generated/prisma/client';
import { AssignmentCell } from './assignment-cell';
import {
  createAssignmentCellKey,
  getCapacityForCell,
  getDayCategoryForDate,
  getOrderedPositionsForShift,
  maxSlotsForPositionInWeek,
} from '../utils';

/** Must match <colgroup> — Tailwind `w-14` = 3.5rem; table layout reads width from <col>, not only from cells */
const NARROW_COL_PX = '3.5rem';
const narrowColCell = 'w-14 min-w-0 max-w-14';

type ShiftSectionProps = {
  shiftType: ShiftType;
  weekDays: WeekDay[];
  assignments: AssignmentMap;
  overflowCandidates?: OverflowCandidateMap;
  employees: ScheduleEmployeeOption[];
  capacity: ScheduleCapacityRule[];
  scheduleId: string | null;
  periodId: string;
  courtId: string;
  readonly?: boolean;
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
    periodId,
    courtId,
    readonly,
  } = props;
  const style = SHIFT_STYLES[shiftType];
  const sortedDays = [...weekDays].sort((a, b) => a.dayOfWeek - b.dayOfWeek);
  const weekIsos = sortedDays.map((d) => d.iso);

  const positionsOrdered = getOrderedPositionsForShift(capacity, shiftType);

  const bodyRows = positionsOrdered.flatMap((pos) => {
    const maxSlots = maxSlotsForPositionInWeek(capacity, shiftType, pos.positionId, weekIsos);
    if (maxSlots <= 0) return [];

    return Array.from({ length: maxSlots }, (_, slotIndex) => ({
      pos,
      slotIndex,
      maxSlots,
    }));
  });

  if (bodyRows.length === 0) {
    return (
      <div className="mb-5" dir="rtl">
        <div
          className={cn(
            'flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-white font-bold text-sm',
            style.header,
          )}
        >
          <div className="flex items-center gap-2">
            <span>{style.emoji}</span>
            <span>{style.label}</span>
          </div>
          <span className="text-[11px] font-normal opacity-80">אין תקנים למשמרת זו</span>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-5" dir="rtl">
      <div
        className={cn(
          'flex items-center justify-between gap-2 px-3 py-2 rounded-t-lg text-white font-bold text-sm',
          style.header,
        )}
      >
        <div className="flex items-center gap-2">
          <span>{style.emoji}</span>
          <span>{style.label}</span>
        </div>
      </div>

      <div className="overflow-x-auto rounded-b-lg border border-border border-t-0 bg-white">
        <table className="w-full table-fixed border-collapse text-xs" dir="rtl">
          <colgroup>
            <col style={{ width: NARROW_COL_PX }} />
            <col style={{ width: NARROW_COL_PX }} />
            {sortedDays.map((day) => (
              <col key={day.iso} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th
                className={cn(
                  narrowColCell,
                  'px-0.5 py-1.5 border border-border text-white font-semibold text-center',
                  style.header,
                )}
              >
                #
              </th>
              <th
                className={cn(
                  narrowColCell,
                  'px-0.5 py-1.5 border border-border text-white font-semibold text-center text-[10px] leading-tight overflow-hidden text-ellipsis whitespace-nowrap',
                  style.header,
                )}
                title="תפקיד"
              >
                תפקיד
              </th>
              {sortedDays.map((day) => {
                const weekend = day.dayOfWeek === 5 || day.dayOfWeek === 6;
                return (
                  <th
                    key={day.iso}
                    className={cn(
                      'min-w-0 px-1 py-1.5 border border-border text-white text-center',
                      style.header,
                      weekend && 'brightness-110',
                    )}
                  >
                    <div className="font-bold text-[13px]">{day.letter}</div>
                    <div className="text-[10px] font-normal opacity-80">{day.label}</div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {bodyRows.map(({ pos, slotIndex, maxSlots }, rowIdx) => (
              <tr key={`${pos.positionId}-${slotIndex}`} className="bg-white ">
                <td
                  className={cn(
                    narrowColCell,
                    'px-0.5 py-1 text-center border border-border text-muted-foreground font-semibold bg-muted/30',
                  )}
                >
                  {rowIdx + 1}
                </td>
                {slotIndex === 0 ? (
                  <td
                    rowSpan={maxSlots}
                    className={cn(
                      narrowColCell,
                      'align-middle px-0.5 py-1 text-center border border-border bg-muted/20 text-[10px] font-semibold leading-tight overflow-hidden',
                    )}
                    title={pos.positionName}
                  >
                    <div className="truncate">{pos.positionName}</div>
                  </td>
                ) : null}
                {sortedDays.map((day) => {
                  const cat = getDayCategoryForDate(day.iso);
                  const required = getCapacityForCell(capacity, cat, shiftType, pos.positionId);
                  const closed = slotIndex >= required;
                  const cellKey = createAssignmentCellKey({ date: day.iso, shiftType, positionId: pos.positionId });
                  const slotAssignments = assignments[cellKey] ?? [];
                  const assignment = slotAssignments.find((a) => a.slotIndex === slotIndex) ?? null;
                  const overflowKey = `${cellKey}-${slotIndex}` as keyof OverflowCandidateMap;

                  return (
                    <AssignmentCell
                      key={day.iso}
                      closed={closed}
                      assignment={assignment}
                      employees={employees}
                      scheduleId={scheduleId}
                      periodId={periodId}
                      courtId={courtId}
                      date={day.iso}
                      shiftType={shiftType}
                      positionId={pos.positionId}
                      slotIndex={slotIndex}
                      overflowCandidates={overflowCandidates?.[overflowKey] ?? []}
                      readonly={readonly}
                    />
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
