import { Moon, Sunrise, Sunset } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type {
  AssignmentMap,
  OverflowCandidateMap,
  ScheduleCapacityRule,
  ScheduleEmployeeOption,
} from '@/features/schedules/types';
import type { ShiftType } from '@/generated/prisma/client';
import { assignedEmployeeIdsForShift, buildShiftSlots } from './schedule-data';
import type { ShiftDisplay, ShiftSlot } from './types';
import { AssignmentChip } from './assignment-chip';

const SHIFT_DISPLAYS: Record<ShiftType, ShiftDisplay> = {
  MORNING: {
    shiftType: 'MORNING',
    label: 'בוקר',
    time: '07:00-15:00',
    tone: 'border-sky-200 bg-sky-50 text-sky-950',
    icon: <Sunrise className="size-4" aria-hidden />,
  },
  EVENING: {
    shiftType: 'EVENING',
    label: 'ערב',
    time: '15:00-23:00',
    tone: 'border-indigo-200 bg-indigo-50 text-indigo-950',
    icon: <Sunset className="size-4" aria-hidden />,
  },
  NIGHT: {
    shiftType: 'NIGHT',
    label: 'לילה',
    time: '23:00-07:00',
    tone: 'border-violet-200 bg-violet-50 text-violet-950',
    icon: <Moon className="size-4" aria-hidden />,
  },
};
type ShiftRoster = {
  shiftType: ShiftType;
  date: string;
  scheduleId: string;
  courtId: string;
  assignments: AssignmentMap;
  overflowCandidates?: OverflowCandidateMap;
  employees: ScheduleEmployeeOption[];
  capacity: ScheduleCapacityRule[];
  currentEmployeeId?: string | null;
  readonly?: boolean;
  compact?: boolean;
};
function roleGroups(slots: ShiftSlot[]): Array<{ role: string; slots: ShiftSlot[] }> {
  const groups = new Map<string, ShiftSlot[]>();

  for (const slot of slots) {
    const list = groups.get(slot.positionName) ?? [];
    list.push(slot);
    groups.set(slot.positionName, list);
  }

  return [...groups.entries()].map(([role, list]) => ({ role, slots: list }));
}

function RoleGroup({
  role,
  slots,
  shiftType,
  date,
  scheduleId,
  courtId,
  employees,
  assignedEmployeeIds,
  currentEmployeeId,
  readonly,
}: {
  role: string;
  slots: ShiftSlot[];
  shiftType: ShiftType;
  date: string;
  scheduleId: string;
  courtId: string;
  employees: ScheduleEmployeeOption[];
  assignedEmployeeIds: Set<string>;
  currentEmployeeId?: string | null;
  readonly?: boolean;
}) {
  const assignedCount = slots.filter((slot) => slot.assignment).length;
  const requiredCount = Math.max(...slots.map((slot) => slot.requiredCount), 0) || slots.length;

  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2">
        <h3 className="text-xs font-semibold text-muted-foreground">{role}</h3>
        <span className="rounded-sm bg-muted px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground ring-1 ring-border/70">
          {assignedCount}/{requiredCount}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-1.5 border-b border-border pb-2 sm:grid-cols-3 xl:grid-cols-6">
        {slots.map((slot) => (
          <AssignmentChip
            key={slot.key}
            slot={slot}
            shiftType={shiftType}
            date={date}
            scheduleId={scheduleId}
            courtId={courtId}
            employees={employees}
            assignedEmployeeIds={assignedEmployeeIds}
            currentEmployeeId={currentEmployeeId}
            readonly={readonly}
          />
        ))}
      </div>
    </section>
  );
}

export function ShiftRoster({
  shiftType,
  date,
  scheduleId,
  courtId,
  assignments,
  overflowCandidates,
  employees,
  capacity,
  currentEmployeeId,
  readonly,
  compact = false,
}: ShiftRoster) {
  const display = SHIFT_DISPLAYS[shiftType];
  const slots = buildShiftSlots({ date, shiftType, assignments, overflowCandidates, capacity });
  const assignedEmployeeIds = assignedEmployeeIdsForShift(assignments, date, shiftType);
  const assignedCount = slots.filter((slot) => slot.assignment).length;
  const currentAssignmentsCount = currentEmployeeId
    ? slots.filter((slot) => slot.assignment?.employeeId === currentEmployeeId).length
    : 0;

  return (
    <Card size="sm" className={cn('border shadow-sm', display.tone)}>
      <CardHeader className="flex flex-row items-start justify-between gap-3 ">
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-md text-current">{display.icon}</span>
          <div>
            <h2 className="text-base font-bold">{display.label}</h2>
            <p className="text-xs opacity-75">{display.time}</p>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="rounded-md bg-white/70 px-2 py-1 text-xs font-semibold">
            {assignedCount}/{slots.length}
          </span>
          {currentAssignmentsCount > 0 ? (
            <span className="rounded-md border border-primary/20 bg-white/70 px-2 py-0.5 text-[11px] font-semibold text-primary">
              השיבוץ שלך
            </span>
          ) : null}
        </div>
      </CardHeader>

      <CardContent>
        {slots.length === 0 ? (
          <div className="flex min-h-24 items-center justify-center rounded-md border border-dashed border-border/70 bg-white/50 px-4 text-center text-sm text-muted-foreground">
            אין תקנים למשמרת זו
          </div>
        ) : (
          <div className={cn('space-y-4', compact && 'space-y-3')}>
            {roleGroups(slots).map((group) => (
              <RoleGroup
                key={group.role}
                role={group.role}
                slots={group.slots}
                shiftType={shiftType}
                date={date}
                scheduleId={scheduleId}
                courtId={courtId}
                employees={employees}
                assignedEmployeeIds={assignedEmployeeIds}
                currentEmployeeId={currentEmployeeId}
                readonly={readonly}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
