import { CurrentScheduleView } from '@/features/schedules/current-schudle';
import type {
  AssignmentCellKey,
  AssignmentMap,
  AssignmentSummary,
  ScheduleCapacityRule,
  ScheduleEmployeeOption,
} from '@/features/schedules/types';
import type { DayCategory, ShiftType } from '@/generated/prisma/client';

const scheduleId = 'mock-schedule';
const courtId = 'mock-court';
const startDate = '2026-06-14';
const endDate = '2026-06-27';
const selectedDate = '2026-06-17';

const positions = {
  shiftManager: { id: 'mock-position-shift-manager', name: 'אחמ״ש', code: 2, color: '#2563eb' },
  controller: { id: 'mock-position-controller', name: 'בקר', code: 3, color: '#0d9488' },
  guard: { id: 'mock-position-guard', name: 'מאבטח', code: 4, color: '#d99a00' },
} as const;

const shiftTypes = ['MORNING', 'EVENING', 'NIGHT'] as const satisfies readonly ShiftType[];
const dayCategories = ['WEEKDAY', 'FRIDAY', 'SATURDAY', 'HOLIDAY'] as const satisfies readonly DayCategory[];

const employees: ScheduleEmployeeOption[] = Array.from({ length: 32 }, (_, index) => {
  const number = index + 1;

  return {
    id: `mock-employee-${number}`,
    displayName: `עובד ${number}`,
    position: {
      id: positions.guard.id,
      name: positions.guard.name,
      code: positions.guard.code,
    },
  };
});

function capacityRule(params: {
  positionId: string;
  displayName: string;
  code: number;
  color: string;
  shiftType: ShiftType;
  dayCategory: DayCategory;
  amount: number;
}): ScheduleCapacityRule {
  return {
    id: `${params.positionId}-${params.shiftType}-${params.dayCategory}`,
    positionId: params.positionId,
    displayName: params.displayName,
    code: params.code,
    color: params.color,
    shiftType: params.shiftType,
    dayCategory: params.dayCategory,
    amount: params.amount,
  };
}

function cellKey(date: string, shiftType: ShiftType, positionId: string): AssignmentCellKey {
  return `${date}-${shiftType}-${positionId}`;
}

function assignment(params: {
  id: string;
  employee: ScheduleEmployeeOption;
  positionId: string;
  positionName: string;
  shiftType: ShiftType;
  slotIndex: number;
}): AssignmentSummary {
  return {
    id: params.id,
    employeeId: params.employee.id,
    employeeDisplayName: params.employee.displayName,
    positionId: params.positionId,
    positionName: params.positionName,
    shiftType: params.shiftType,
    slotIndex: params.slotIndex,
  };
}

const capacity: ScheduleCapacityRule[] = dayCategories.flatMap((dayCategory) =>
  shiftTypes.flatMap((shiftType) => {
    const guardAmount = shiftType === 'MORNING' ? 25 : shiftType === 'EVENING' ? 8 : 5;

    return [
      capacityRule({ ...positions.shiftManager, positionId: positions.shiftManager.id, displayName: positions.shiftManager.name, shiftType, dayCategory, amount: 1 }),
      capacityRule({ ...positions.controller, positionId: positions.controller.id, displayName: positions.controller.name, shiftType, dayCategory, amount: 1 }),
      capacityRule({ ...positions.guard, positionId: positions.guard.id, displayName: positions.guard.name, shiftType, dayCategory, amount: guardAmount }),
    ];
  }),
);

const assignments: AssignmentMap = {
  [cellKey(selectedDate, 'MORNING', positions.shiftManager.id)]: [
    assignment({
      id: 'mock-assignment-morning-manager',
      employee: employees[0],
      positionId: positions.shiftManager.id,
      positionName: positions.shiftManager.name,
      shiftType: 'MORNING',
      slotIndex: 0,
    }),
  ],
  [cellKey(selectedDate, 'MORNING', positions.controller.id)]: [
    assignment({
      id: 'mock-assignment-morning-controller',
      employee: employees[1],
      positionId: positions.controller.id,
      positionName: positions.controller.name,
      shiftType: 'MORNING',
      slotIndex: 0,
    }),
  ],
  [cellKey(selectedDate, 'MORNING', positions.guard.id)]: Array.from({ length: 25 }, (_, index) =>
    assignment({
      id: `mock-assignment-morning-guard-${index + 1}`,
      employee: employees[index + 2],
      positionId: positions.guard.id,
      positionName: positions.guard.name,
      shiftType: 'MORNING',
      slotIndex: index,
    }),
  ),
  [cellKey(selectedDate, 'EVENING', positions.guard.id)]: Array.from({ length: 8 }, (_, index) =>
    assignment({
      id: `mock-assignment-evening-guard-${index + 1}`,
      employee: employees[index + 10],
      positionId: positions.guard.id,
      positionName: positions.guard.name,
      shiftType: 'EVENING',
      slotIndex: index,
    }),
  ),
  [cellKey(selectedDate, 'NIGHT', positions.guard.id)]: Array.from({ length: 5 }, (_, index) =>
    assignment({
      id: `mock-assignment-night-guard-${index + 1}`,
      employee: employees[index + 18],
      positionId: positions.guard.id,
      positionName: positions.guard.name,
      shiftType: 'NIGHT',
      slotIndex: index,
    }),
  ),
};

export default function ScheduleMockPage() {
  return (
    <main className="min-h-screen bg-background p-4 md:p-6">
      <CurrentScheduleView
        scheduleId={scheduleId}
        scheduleName="Mock: משמרת בוקר עם 25 עובדים"
        startDate={startDate}
        endDate={endDate}
        assignments={assignments}
        employees={employees}
        capacity={capacity}
        courtId={courtId}
        currentEmployeeId="mock-employee-9"
        readonly
      />
    </main>
  );
}
