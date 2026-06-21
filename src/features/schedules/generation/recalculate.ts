import { ScheduleStatus, WarningSeverity, WarningType } from '@/generated/prisma/client';
import { buildSlots } from '@/features/scheduling-engine/slots';
import type { EngineInput, UnmetMinimum } from '@/features/scheduling-engine/types';
import { computeFairnessSummary } from '@/features/scheduling-engine/fairness';
import { createWarnings } from '@/features/scheduling-engine/warnings';
import { getWeeklyMinimumStatus } from '@/features/scheduling-engine/weekly-minimums';
import { requireManager } from '@/lib/db/auth-helpers';
import { prisma } from '@/lib/db/client';
import { getAutoScheduleInputData } from './queries';

function collectUnmetMinimums(input: EngineInput): UnmetMinimum[] {
  const unmetMinimums: UnmetMinimum[] = [];
  const activeEmployees = input.employees.filter((employee) => employee.isActive);

  for (const employee of activeEmployees) {
    for (const weekNumber of [1, 2] as const) {
      const status = getWeeklyMinimumStatus(employee.id, weekNumber, input.manualAssignments, input);

      if (!status.morningMet) {
        unmetMinimums.push({
          employeeId: employee.id,
          weekNumber,
          shiftType: 'MORNING',
          required: status.morningCount + status.morningNeeded,
          actual: status.morningCount,
        });
      }

      if (!status.eveningMet) {
        unmetMinimums.push({
          employeeId: employee.id,
          weekNumber,
          shiftType: 'EVENING',
          required: status.eveningCount + status.eveningNeeded,
          actual: status.eveningCount,
        });
      }
    }
  }

  return unmetMinimums;
}

export async function recalculateScheduleAnalysis(scheduleId: string): Promise<void> {
  const { courtId } = await requireManager();

  const data = await getAutoScheduleInputData(scheduleId);
  if (!data.found) {
    throw new Error(data.message);
  }

  const schedule = await prisma.workSchedule.findUnique({
    where: { id: scheduleId, courtId },
    select: { id: true, status: true },
  });

  if (!schedule) {
    throw new Error('השיבוץ לא נמצא');
  }
  if (schedule.status === ScheduleStatus.ARCHIVED) {
    throw new Error('לא ניתן לעדכן אזהרות לשיבוץ בארכיון');
  }

  const input: EngineInput = {
    ...data.input,
    scheduleId,
  };

  const slots = buildSlots(input);
  const fairnessSummary = computeFairnessSummary(input.manualAssignments);
  const warnings = createWarnings({
    unmetMinimums: collectUnmetMinimums(input),
    slots,
    assignments: input.manualAssignments,
    fairnessSummary,
  });

  await prisma.$transaction(async (tx) => {
    await tx.scheduleWarning.deleteMany({
      where: { scheduleId },
    });

    if (warnings.length > 0) {
      await tx.scheduleWarning.createMany({
        data: warnings.map((warning) => ({
          scheduleId,
          type: warning.type as WarningType,
          severity: warning.severity as WarningSeverity,
          employeeId: warning.employeeId ?? null,
          courtId: input.period.courtId,
          positionId: warning.positionId ?? null,
          shiftType: warning.shiftType ?? null,
          date: warning.date ?? null,
          message: warning.message,
        })),
      });
    }

    await tx.fairnessRecord.deleteMany({
      where: { scheduleId },
    });

    if (fairnessSummary.size > 0) {
      await tx.fairnessRecord.createMany({
        data: Array.from(fairnessSummary.values()).map((fairness) => ({
          employeeId: fairness.employeeId,
          scheduleId,
          totalShifts: fairness.totalShifts,
          morningShifts: fairness.morningShifts,
          eveningShifts: fairness.eveningShifts,
          nightShifts: fairness.nightShifts,
          weekendShifts: fairness.weekendShifts,
        })),
      });
    }
  });
}
