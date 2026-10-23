import type { EngineWarning } from '@/features/scheduling-engine/types';
import type { ScheduleCapacityRule, ScheduleEmployeeOption, ScheduleWarningSummary } from '../types';

export function toWarningSummaries(
  scheduleId: string,
  warnings: EngineWarning[],
  employees: ScheduleEmployeeOption[],
  capacity: ScheduleCapacityRule[],
): ScheduleWarningSummary[] {
  const employeesById = new Map(employees.map((employee) => [employee.id, employee]));
  const positionNames = new Map(capacity.map((rule) => [rule.positionId, rule.displayName]));

  return warnings.map((warning, index) => {
    const employee = warning.employeeId ? employeesById.get(warning.employeeId) : undefined;
    return {
      id: `${scheduleId}-warning-${index}`,
      type: warning.type,
      severity: warning.severity,
      message: warning.message,
      date: warning.date?.toISOString().slice(0, 10) ?? null,
      shiftType: warning.shiftType ?? null,
      ...(warning.weekNumber ? { weekNumber: warning.weekNumber } : {}),
      employeeName: employee?.displayName ?? null,
      positionName: (warning.positionId ? positionNames.get(warning.positionId) : employee?.position?.name) ?? null,
    };
  });
}
