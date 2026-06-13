'use server';

import { revalidatePath } from 'next/cache';

import { generateSchedule } from '@/features/scheduling-engine/generate-schedule';
import type { EngineInput, EngineStats } from '@/features/scheduling-engine/types';
import { requireSession } from '@/lib/db/auth-helpers';
import { prisma } from '@/lib/db/client';
import { PeriodStatus, ScheduleStatus, SystemRole, WarningSeverity, WarningType } from '@/generated/prisma/client';

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

export async function generateAutoSchedule(periodId: string): Promise<GenerateAutoScheduleResult> {
  const session = await requireSession(SystemRole.MANAGER);

  const data = await getAutoScheduleInputData(periodId);
  if (!data.found) return { error: data.message };
  if (data.schedule?.status === ScheduleStatus.ACTIVE) {
    return { error: 'Cannot regenerate a published schedule' };
  }

  const schedule = await prisma.schedule.upsert({
    where: { periodId },
    update: {},
    create: {
      periodId,
      generatedById: session.user.id,
    },
    select: {
      id: true,
      status: true,
    },
  });

  if (schedule.status === ScheduleStatus.ACTIVE) {
    return { error: 'Cannot regenerate a published schedule' };
  }

  const input: EngineInput = {
    ...data.input,
    scheduleId: schedule.id,
  };
  const output = generateSchedule(input);

  await prisma.$transaction(
    async (tx) => {
      const currentSchedule = await tx.schedule.findUnique({
        where: { id: schedule.id },
        select: {
          status: true,
          period: { select: { status: true } },
        },
      });

      if (!currentSchedule) throw new Error('Schedule not found');
      if (currentSchedule.status === ScheduleStatus.ACTIVE) {
        throw new Error('Cannot regenerate a published schedule');
      }
      if (currentSchedule.period.status === PeriodStatus.OPEN_FOR_SUBMISSION) {
        await tx.schedulePeriod.update({
          where: { id: periodId },
          data: { status: PeriodStatus.LOCKED },
        });
      } else if (currentSchedule.period.status !== PeriodStatus.LOCKED) {
        throw new Error('Period must be open or locked before auto scheduling');
      }

      await tx.shiftAssignment.deleteMany({
        where: {
          scheduleId: schedule.id,
          isManualOverride: false,
        },
      });

      if (output.assignments.length > 0) {
        await tx.shiftAssignment.createMany({
          data: output.assignments.map((assignment) => ({
            scheduleId: schedule.id,
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
        where: { scheduleId: schedule.id },
      });

      if (output.warnings.length > 0) {
        await tx.scheduleWarning.createMany({
          data: output.warnings.map((warning) => ({
            scheduleId: schedule.id,
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
        where: { periodId },
      });

      if (output.fairnessSummary.size > 0) {
        await tx.fairnessRecord.createMany({
          data: Array.from(output.fairnessSummary.values()).map((fairness) => ({
            employeeId: fairness.employeeId,
            periodId,
            totalShifts: fairness.totalShifts,
            morningShifts: fairness.morningShifts,
            eveningShifts: fairness.eveningShifts,
            nightShifts: fairness.nightShifts,
            weekendShifts: fairness.weekendShifts,
          })),
        });
      }

      await tx.schedule.update({
        where: { id: schedule.id },
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
    scheduleId: schedule.id,
    totalAssignments: output.assignments.length,
    warningCount: output.warnings.length,
    errorWarningCount: output.warnings.filter((warning) => warning.severity === 'ERROR').length,
    stats: output.stats,
  };
}
