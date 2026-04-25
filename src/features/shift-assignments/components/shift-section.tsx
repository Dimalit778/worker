import { cn } from '@/lib/utils';
import { AssignmentCell } from './assignment-cell';
import { getRowLabel, assignmentKey } from '../utils';
import type { AssignmentMap } from '../types';
import type { WeekDay } from '../types';
import type { ShiftType } from '@/generated/prisma/client';
import type { EmployeeSummary, FullCapacityRules } from '@/features/court-settings/types';
import { Position } from '@/generated/prisma/enums';

type Props = {
  shiftType: ShiftType;
  weekDays: WeekDay[];
  assignments: AssignmentMap;
  guards: EmployeeSummary[];
  capacity: FullCapacityRules;
  scheduleId: string | null;
  periodId: string;
  courtId: string;
  readonly?: boolean;
};
type ShiftSectionProps = {
  shiftType: ShiftType;
  weekDays: WeekDay[];
  assignments: AssignmentMap;
  guards: EmployeeSummary[];
  capacity: FullCapacityRules;
  scheduleId: string | null;
  periodId: string;
  courtId: string;
  readonly?: boolean;
};

/** Derive the position for a given shift slot based on its label/role. */
function getSlotPosition(shiftType: ShiftType, slotIndex: number): Position {
  if (shiftType === 'MORNING') {
    if (slotIndex === 0) return Position.SHIFT_MANAGER;
    if (slotIndex === 1) return Position.BAKAR;
    if (slotIndex === 2) return Position.FACILITY_OFFICER;
    if (slotIndex === 3) return Position.SHIFT_MANAGER;
  }
  if (shiftType === 'EVENING') {
    if (slotIndex === 0) return Position.SHIFT_MANAGER;
    if (slotIndex === 1) return Position.BAKAR;
    if (slotIndex === 2) return Position.SHIFT_MANAGER;
  }
  if (shiftType === 'NIGHT') {
    if (slotIndex === 0) return Position.FACILITY_OFFICER;
    if (slotIndex === 1) return Position.SHIFT_MANAGER;
  }
  return Position.GUARD;
}

function getDayCapacity(capacity: FullCapacityRules, dayOfWeek: number) {
  if (dayOfWeek === 5) return capacity.friday;
  if (dayOfWeek === 6) return capacity.saturday;
  return capacity.default;
}

const SHIFT_STYLES: Record<ShiftType, { header: string; label: string; emoji: string }> = {
  MORNING: { header: 'bg-[#0f4c81]', label: 'בוקר', emoji: '☀️' },
  EVENING: { header: 'bg-[#1d4ed8]', label: 'ערב', emoji: '🌆' },
  NIGHT: { header: 'bg-[#4c1d95]', label: 'לילה', emoji: '🌙' },
};

export function ShiftSection({ ...props }: ShiftSectionProps) {
  const { shiftType, weekDays, assignments, guards, capacity, scheduleId, periodId, courtId, readonly } = props;
  const style = SHIFT_STYLES[shiftType];
  const sortedDays = [...weekDays].sort((a, b) => a.dayOfWeek - b.dayOfWeek);

  const maxSlots = Math.max(...sortedDays.map((d) => getDayCapacity(capacity, d.dayOfWeek)[shiftType]), 1);

  return (
    <div className="mb-5" dir="rtl">
      {/* Section header */}
      <div
        className={cn('flex items-center gap-2 px-3 py-1.5 rounded-t-lg text-white font-bold text-sm', style.header)}
      >
        <span>{style.emoji}</span>
        <span>{style.label}</span>
      </div>

      <div className="overflow-x-auto">
        <table
          className="w-full border-collapse bg-white border border-border border-t-0 rounded-b-lg text-xs"
          dir="rtl"
        >
          <thead>
            <tr>
              <th className={cn('w-7 px-1 py-1 border border-border text-white font-semibold', style.header)}>#</th>
              <th
                className={cn(
                  ' border border-border text-white font-semibold text-center text-[10px] leading-tight',
                  style.header,
                )}
              >
                משמרת
              </th>
              {sortedDays.map((day) => (
                <th
                  key={day.iso}
                  className={cn(
                    'w-[62px] min-w-[62px] px-1 py-0.5 border border-border text-white text-center',
                    style.header,
                  )}
                >
                  <div className="font-bold text-[13px]">{day.letter}</div>
                  <div className="text-[10px] font-normal opacity-70">{day.label}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: maxSlots }, (_, slotIndex) => {
              const rowLabel = getRowLabel(shiftType, slotIndex);

              const isSpecial =
                (slotIndex < 3 && shiftType === 'MORNING') ||
                (slotIndex < 2 && shiftType === 'EVENING') ||
                (slotIndex < 1 && shiftType === 'NIGHT');

              return (
                <tr
                  key={slotIndex}
                  className={cn(
                    slotIndex === 0 && 'bg-gray-500',
                    slotIndex === 1 && (shiftType === 'MORNING' || shiftType === 'EVENING') && 'bg-gray-500',
                    slotIndex === 2 && shiftType === 'MORNING' && 'bg-gray-500',
                    slotIndex === 3 && shiftType === 'MORNING' && 'border-b-2 border-b-black/30',
                    slotIndex % 2 !== 0 && !isSpecial && 'bg-muted/20',
                  )}
                >
                  <td className=" px-1 text-center border border-border text-muted-foreground font-semibold bg-muted/30">
                    {slotIndex + 1}
                  </td>
                  <td
                    className={cn(
                      'w-8 text-center border border-border bg-muted/30 text-[11px] leading-tight',
                      isSpecial ? 'font-bold text-foreground' : 'font-medium text-muted-foreground',
                    )}
                  >
                    {rowLabel}
                  </td>
                  {sortedDays.map((day) => {
                    const dayCapacity = getDayCapacity(capacity, day.dayOfWeek)[shiftType];
                    const isFriSat = day.dayOfWeek === 5 || day.dayOfWeek === 6;
                    const isClosed = isFriSat && slotIndex >= dayCapacity;
                    const key = assignmentKey(day.iso, shiftType);
                    const slotAssignments = assignments[key] ?? [];
                    const assignment = slotAssignments[slotIndex] ?? null;
                    const isOpening = shiftType === 'MORNING' && slotIndex === 0;

                    return (
                      <AssignmentCell
                        key={day.iso}
                        closed={isClosed}
                        assignment={assignment}
                        guards={guards}
                        scheduleId={scheduleId}
                        periodId={periodId}
                        courtId={courtId}
                        date={day.iso}
                        shiftType={shiftType}
                        position={getSlotPosition(shiftType, slotIndex)}
                        slotIndex={slotIndex}
                        isOpeningDuty={isOpening}
                        readonly={readonly}
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
