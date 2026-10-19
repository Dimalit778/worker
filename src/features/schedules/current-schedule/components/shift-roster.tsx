import { SHIFT_TONES } from '@/features/schedules/constants';
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
import { assignedEmployeeIdsForShift, buildShiftSlots, getShiftRequiredCount } from '../schedule-data';
import type { ShiftDisplay, ShiftSlot } from '../types';
import { AssignmentChip, RoleAddButton } from './assignment-chip';
import type { SwapCandidate } from '@/features/schedules/shared/guard-picker';

function getNextEmptySlot(slots: ShiftSlot[]): ShiftSlot | null {
  return slots.find((slot) => !slot.assignment) ?? null;
}

const SHIFT_DISPLAYS: Record<ShiftType, ShiftDisplay> = {
  MORNING: {
    shiftType: 'MORNING',
    label: 'בוקר',
    time: '07:00-15:00',
    tone: 'border-sky-200 bg-sky-950 text-sky-200',
    icon: <Sunrise className="size-4" aria-hidden />,
  },
  EVENING: {
    shiftType: 'EVENING',
    label: 'ערב',
    time: '15:00-23:00',
    tone: 'border-indigo-200 bg-indigo-950 text-indigo-200',
    icon: <Sunset className="size-4" aria-hidden />,
  },
  NIGHT: {
    shiftType: 'NIGHT',
    label: 'לילה',
    time: '23:00-07:00',
    tone: 'border-violet-200 bg-violet-950 text-violet-200',
    icon: <Moon className="size-4" aria-hidden />,
  },
};
type ShiftRoster = {
  shiftType: ShiftType;
  date: string;
  scheduleId: string;
  facilityId: string;
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
  facilityId,
  employees,
  assignedEmployeeIds,
  currentEmployeeId,
  readonly,
  swapCandidatesByAssignmentId,
}: {
  role: string;
  slots: ShiftSlot[];
  shiftType: ShiftType;
  date: string;
  scheduleId: string;
  facilityId: string;
  employees: ScheduleEmployeeOption[];
  assignedEmployeeIds: Set<string>;
  currentEmployeeId?: string | null;
  readonly?: boolean;
  swapCandidatesByAssignmentId: Map<string, SwapCandidate[]>;
}) {
  const assignedCount = slots.filter((slot) => slot.assignment).length;
  const requiredCount = Math.max(...slots.map((slot) => slot.requiredCount), 0) || slots.length;
  const assignedSlots = slots.filter((slot) => slot.assignment);
  const nextEmptySlot = getNextEmptySlot(slots);
  const canAdd = !readonly && assignedCount < requiredCount && nextEmptySlot;

  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2">
        <h3 className="text-xs font-semibold text-muted-foreground">{role}</h3>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 border-b border-border pb-2">
        {assignedSlots.map((slot) => (
          <AssignmentChip
            key={slot.key}
            slot={slot}
            shiftType={shiftType}
            date={date}
            scheduleId={scheduleId}
            facilityId={facilityId}
            employees={employees}
            assignedEmployeeIds={assignedEmployeeIds}
            currentEmployeeId={currentEmployeeId}
            readonly={readonly}
            swapCandidates={slot.assignment ? swapCandidatesByAssignmentId.get(slot.assignment.id) : undefined}
          />
        ))}
        {canAdd ? (
          <RoleAddButton
            slot={nextEmptySlot}
            role={role}
            shiftType={shiftType}
            date={date}
            scheduleId={scheduleId}
            facilityId={facilityId}
            employees={employees}
            assignedEmployeeIds={assignedEmployeeIds}
          />
        ) : null}
      </div>
    </section>
  );
}

export function ShiftRoster({
  shiftType,
  date,
  scheduleId,
  facilityId,
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

  const allAssignedEntries = Object.values(assignments).flat();
  const swapCandidatesByAssignmentId = new Map<string, SwapCandidate[]>();
  for (const slot of slots) {
    if (!slot.assignment) continue;
    const candidates = Array.from(
      new Map(
        allAssignedEntries
          .filter((a) => a.id !== slot.assignment!.id && a.employeeId !== slot.assignment!.employeeId)
          .map((a) => [
            a.employeeId,
            { assignmentId: a.id, employeeId: a.employeeId, displayName: a.employeeDisplayName } as SwapCandidate,
          ]),
      ).values(),
    );
    swapCandidatesByAssignmentId.set(slot.assignment.id, candidates);
  }
  const requiredCount = getShiftRequiredCount(date, shiftType, capacity);
  const currentAssignmentsCount = currentEmployeeId
    ? slots.filter((slot) => slot.assignment?.employeeId === currentEmployeeId).length
    : 0;

  return (
    <Card size="sm" className={cn('border shadow-sm', `${SHIFT_TONES[shiftType].bg} ${SHIFT_TONES[shiftType].text} ${SHIFT_TONES[shiftType].border}`)}>
      <CardHeader className="flex flex-row items-start justify-between gap-3 ">
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-md text-current">{display.icon}</span>
          <div>
            <h2 className="text-base font-bold">{display.label}</h2>
            <p className="text-xs opacity-75">{display.time}</p>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {currentAssignmentsCount > 0 ? (
            <span className="rounded-md border border-primary/20 bg-secondary/70 px-2 py-0.5 text-[11px] font-semibold text-primary">
              השיבוץ שלך
            </span>
          ) : null}
        </div>
      </CardHeader>

      <CardContent>
        {requiredCount === 0 ? (
          <div className="flex min-h-24 items-center justify-center rounded-md border border-dashed border-border/70 bg-secondary/50 px-4 text-center text-sm text-muted-foreground">
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
                facilityId={facilityId}
                employees={employees}
                assignedEmployeeIds={assignedEmployeeIds}
                currentEmployeeId={currentEmployeeId}
                readonly={readonly}
                swapCandidatesByAssignmentId={swapCandidatesByAssignmentId}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
