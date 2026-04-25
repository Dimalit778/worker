import { EmployeeSummary, FullCapacityRules } from '../court-settings/types';

export type AssignmentSummary = {
  id: string;
  employeeId: string;
  employeeName: string;
  courtShiftRoleId: string;
  roleName: string;
  roleCode: string;
  slotIndex: number;
};

export type AssignGuardParams = {
  scheduleId: string | null;
  periodId: string;
  employeeId: string;
  courtId: string;
  courtShiftRoleId: string;
  date: string;
  slotIndex: number;
};

export type AssignmentMap = Record<string, AssignmentSummary[]>;
export type ScheduleProps = {
  periodId: string;
  periodName: string;
  startDate: string;
  endDate: string;
  scheduleId: string | null;
  assignments: AssignmentMap;
  guards: { id: string; name: string }[];
  capacity: FullCapacityRules;

  courtId: string;

  readonly?: boolean;
};
export type WeekDay = {
  iso: string; // YYYY-MM-DD
  dayOfWeek: number; // 0=Sun … 6=Sat
  letter: string; // א–ש
  label: string; // DD/MM
};
export type SchedulePageData =
  | { found: false }
  | {
      found: true;
      periodId: string;
      periodName: string;
      startDate: string;
      endDate: string;
      scheduleId: string | null;
      assignments: AssignmentMap;
      guards: EmployeeSummary[];
      capacity: FullCapacityRules;
      courtId: string;
    };
