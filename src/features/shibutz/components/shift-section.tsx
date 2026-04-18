import { cn } from '@/lib/utils';
import { AssignmentCell } from './assignment-cell';
import { isClosedCell, getRowLabel, assignmentKey } from '../utils';
import type { ShiftType, AssignmentMap, GuardSummary, CapacityMap } from '../types';
import type { WeekDay } from '../utils';

type Props = {
  shiftType: ShiftType;
  weekDays: WeekDay[];
  assignments: AssignmentMap;
  guards: GuardSummary[];
  capacity: CapacityMap;
  scheduleId: string | null;
  periodId: string;
  courtId: string;
  readonly?: boolean;
};

const SHIFT_STYLES: Record<ShiftType, { header: string; label: string; emoji: string }> = {
  MORNING: { header: 'bg-[#0f4c81]', label: 'בוקר', emoji: '☀️' },
  EVENING: { header: 'bg-[#1d4ed8]', label: 'ערב', emoji: '🌆' },
  NIGHT: { header: 'bg-[#4c1d95]', label: 'לילה', emoji: '🌙' },
};

export function ShiftSection({
  shiftType,
  weekDays,
  assignments,
  guards,
  capacity,
  scheduleId,
  periodId,
  courtId,
  readonly = false,
}: Props) {
  const style = SHIFT_STYLES[shiftType];
  const maxSlots = capacity[shiftType];
  const sortedDays = [...weekDays].sort((a, b) => a.dayOfWeek - b.dayOfWeek);

  return (
    <div className="mb-5" dir="rtl">
      {/* Section header */}
      <div
        className={cn('flex items-center gap-2 px-3 py-1.5 rounded-t-lg text-white font-bold text-sm', style.header)}
      >
        <span>{style.emoji}</span>
        <span>{style.label}</span>
      </div>

      {/* RTL table: first <th>/<td> in HTML = rightmost on screen */}
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
                  'w-14 px-1 py-1 border border-border text-white font-semibold whitespace-nowrap',
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
                    slotIndex === 0 && 'bg-yellow-50',
                    slotIndex === 1 && shiftType === 'MORNING' && 'bg-green-50',
                    slotIndex % 2 !== 0 && !isSpecial && 'bg-muted/20',
                  )}
                >
                  <td className="w-7 px-1 text-center border border-border text-muted-foreground font-semibold bg-muted/30">
                    {slotIndex + 1}
                  </td>
                  <td
                    className={cn(
                      'w-14 px-1 text-center border border-border bg-muted/30 whitespace-nowrap text-[11px]',
                      isSpecial ? 'font-bold text-foreground' : 'font-medium text-muted-foreground',
                    )}
                  >
                    {rowLabel}
                  </td>
                  {sortedDays.map((day) => {
                    const key = assignmentKey(day.iso, shiftType);
                    const slotAssignments = assignments[key] ?? [];
                    const assignment = slotAssignments[slotIndex] ?? null;
                    const isOpening = shiftType === 'MORNING' && slotIndex === 0;

                    return (
                      <AssignmentCell
                        key={day.iso}
                        closed={isClosedCell(day.dayOfWeek, shiftType)}
                        assignment={assignment}
                        guards={guards}
                        scheduleId={scheduleId}
                        periodId={periodId}
                        courtId={courtId}
                        date={day.iso}
                        shiftType={shiftType}
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
