'use server';

import { revalidatePath } from 'next/cache';

import { generateSchedule } from '@/features/scheduling-engine/generate-schedule';
import type { EngineInput, EngineStats } from '@/features/scheduling-engine/types';
import { requireSession } from '@/lib/db/auth-helpers';
import { prisma } from '@/lib/db/client';
import { ScheduleStatus, SystemRole, WarningSeverity, WarningType } from '@/generated/prisma/client';

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
  if (data.schedule?.status === ScheduleStatus.ACTIVE) {
    return { error: 'Cannot regenerate a published schedule' };
  }

  const currentSchedule = await prisma.schedule.findUnique({
    where: { id: scheduleId },
    select: { id: true, status: true },
  });

  if (!currentSchedule) return { error: 'Schedule not found' };
  if (currentSchedule.status === ScheduleStatus.ACTIVE) {
    return { error: 'Cannot regenerate a published schedule' };
  }

  const input: EngineInput = {
    ...data.input,
    scheduleId: currentSchedule.id,
  };
  const output = generateSchedule(input);

  await prisma.$transaction(
    async (tx) => {
      const freshSchedule = await tx.schedule.findUnique({
        where: { id: scheduleId },
        select: { status: true },
      });

      if (!freshSchedule) throw new Error('Schedule not found');
      if (freshSchedule.status === ScheduleStatus.ACTIVE) {
        throw new Error('Cannot regenerate a published schedule');
      }
      if (freshSchedule.status === ScheduleStatus.OPEN_FOR_SUBMISSION) {
        await tx.schedule.update({
          where: { id: scheduleId },
          data: { status: ScheduleStatus.LOCKED },
        });
      } else if (freshSchedule.status !== ScheduleStatus.LOCKED) {
        throw new Error('Period must be open or locked before auto scheduling');
      }

      await tx.shiftAssignment.deleteMany({
        where: {
          scheduleId,
          isManualOverride: false,
        },
      });

      if (output.assignments.length > 0) {
        await tx.shiftAssignment.createMany({
          data: output.assignments.map((assignment) => ({
            scheduleId,
            employeeId: assignment.employeeId,
            courtId: assignment.courtId,
            positionId: assignment.positionId,
            date: assignment.date,
            shiftType: assignment.shiftType,
            slotIndex: assignment.slotIndex,
            isManualOverride: false,
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

      await tx.schedule.update({
        where: { id: scheduleId },
        data: {
          generatedAt: new Date(),
          generatedById: session.user.id,
        },
      });
    },
    { timeout: 20_000 },
  );

  revalidatePath('/manager/future-schedule');
  revalidatePath('/manager/schedule');
  revalidatePath('/manager/periods');
  revalidatePath('/manager');

  return {
    ok: true,
    scheduleId,
    totalAssignments: output.assignments.length,
    warningCount: output.warnings.length,
    errorWarningCount: output.warnings.filter((warning) => warning.severity === 'ERROR').length,
    stats: output.stats,
  };
}
