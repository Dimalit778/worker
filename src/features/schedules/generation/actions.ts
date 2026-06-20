'use server';

import { generateSchedule } from '@/features/scheduling-engine/generate-schedule';
import type { EngineInput, EngineStats } from '@/features/scheduling-engine/types';
import { requireSession } from '@/lib/db/auth-helpers';
import { prisma } from '@/lib/db/client';
import { ScheduleStatus, SystemRole, WarningSeverity, WarningType } from '@/generated/prisma/client';

import { resolveDraftVersionForGeneration } from '@/features/schedules/versions/queries';
import { getAutoScheduleInputData } from './queries';

export type GenerateAutoScheduleResult =
  | {
      ok: true;
      scheduleId: string;
      totalAssignments: number;
      warningCount: number;
      errorWarningCount: number;
      stats: EngineStats;
    }
  | { error: string };

export async function generateAutoSchedule(scheduleId: string): Promise<GenerateAutoScheduleResult> {
  const session = await requireSession(SystemRole.MANAGER);

  const data = await getAutoScheduleInputData(scheduleId);
  if (!data.found) return { error: data.message };

  const currentSchedule = await prisma.workSchedule.findUnique({
    where: { id: scheduleId },
    select: { id: true, status: true },
  });

  if (!currentSchedule) return { error: 'Schedule not found' };
  if (currentSchedule.status === ScheduleStatus.ARCHIVED) {
    return { error: 'Cannot regenerate an archived schedule' };
  }

  const input: EngineInput = {
    ...data.input,
    scheduleId: currentSchedule.id,
  };
  const output = generateSchedule(input);

  await prisma.$transaction(
    async (tx) => {
      const freshSchedule = await tx.workSchedule.findUnique({
        where: { id: scheduleId },
        select: { status: true, courtId: true },
      });

      if (!freshSchedule) throw new Error('Schedule not found');
      if (freshSchedule.status === ScheduleStatus.ARCHIVED) {
        throw new Error('Cannot regenerate an archived schedule');
      }
      if (freshSchedule.status === ScheduleStatus.OPEN) {
        await tx.workSchedule.update({
          where: { id: scheduleId },
          data: { status: ScheduleStatus.LOCKED },
        });
      } else if (
        freshSchedule.status !== ScheduleStatus.LOCKED &&
        freshSchedule.status !== ScheduleStatus.PUBLISHED
      ) {
        throw new Error('Period must be open, locked, or published before auto scheduling');
      }

      const draftVersion = await resolveDraftVersionForGeneration(tx, {
        scheduleId,
        courtId: freshSchedule.courtId,
        createdById: session.user.id,
      });

      await tx.shiftAssignment.deleteMany({
        where: { versionId: draftVersion.id },
      });

      if (output.assignments.length > 0) {
        await tx.shiftAssignment.createMany({
          data: output.assignments.map((assignment) => ({
            scheduleId,
            versionId: draftVersion.id,
            employeeId: assignment.employeeId,
            courtId: assignment.courtId,
            positionId: assignment.positionId,
            date: assignment.date,
            shiftType: assignment.shiftType,
          })),
        });
      }

      await tx.scheduleWarning.deleteMany({
        where: { scheduleId },
      });

      if (output.warnings.length > 0) {
        await tx.scheduleWarning.createMany({
          data: output.warnings.map((warning) => ({
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

      if (output.fairnessSummary.size > 0) {
        await tx.fairnessRecord.createMany({
          data: Array.from(output.fairnessSummary.values()).map((fairness) => ({
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

      await tx.workSchedule.update({
        where: { id: scheduleId },
        data: {
          generatedAt: new Date(),
        },
      });
    },
    { timeout: 20_000 },
  );

  return {
    ok: true,
    scheduleId,
    totalAssignments: output.assignments.length,
    warningCount: output.warnings.length,
    errorWarningCount: output.warnings.filter((warning) => warning.severity === 'ERROR').length,
    stats: output.stats,
  };
}
