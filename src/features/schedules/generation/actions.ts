'use server';
import { generateSchedule } from '@/features/scheduling-engine/generate-schedule';
import { validateAssignments } from '@/features/scheduling-engine/validate';
import { requireManager } from '@/lib/db/auth-helpers';
import { scheduleTransaction, editableDraft, type VersionExpectation } from '../services/transactions';
import { loadSchedulingInput } from './queries';
import { saveScheduleAnalysis } from './recalculate';
import { defaultShiftTimes, shiftBounds } from '../shift-times';

export async function generateAutoSchedule(scheduleId: string, expected: VersionExpectation) {
  const actor = await requireManager();
  try {
    return await scheduleTransaction(actor, async (tx) => {
      const { version, schedule } = await editableDraft(tx, actor, scheduleId, expected);
      const { input, assignments: before } = await loadSchedulingInput(tx, scheduleId, actor.facilityId, version.id);
      const output = generateSchedule(input);
      const all = [...input.manualAssignments, ...output.assignments];
      const failures = validateAssignments(input, all, { allowManualOverrides: false });
      if (failures.length) throw new Error(failures.join('; '));
      const locked = await tx.scheduleSlot.findMany({
        where: { scheduleId, isLocked: true },
        select: { date: true, shiftType: true, positionId: true, slotNumber: true },
      });
      await tx.scheduleSlot.deleteMany({ where: { scheduleId, isLocked: false } });
      const nextSlot = new Map<string, number>();
      for (const slot of locked) {
        const key = `${slot.date.toISOString()}|${slot.shiftType}|${slot.positionId}`;
        nextSlot.set(key, Math.max(nextSlot.get(key) ?? 0, slot.slotNumber));
      }
      if (output.assignments.length) {
        await tx.scheduleSlot.createMany({
          data: output.assignments.map((a) => {
            const key = `${a.date.toISOString()}|${a.shiftType}|${a.positionId}`;
            const slotNumber = (nextSlot.get(key) ?? 0) + 1;
            nextSlot.set(key, slotNumber);
            const times = defaultShiftTimes(a.shiftType);
            return {
              scheduleId,
              facilityId: actor.facilityId,
              userId: a.employeeId,
              positionId: a.positionId,
              date: a.date,
              shiftType: a.shiftType,
              slotNumber,
              ...shiftBounds(a.date, times.startTime, times.endTime),
              source: 'AUTOMATIC' as const,
              isLocked: false,
            };
          }),
        });
      }
      const analysis = await saveScheduleAnalysis(tx, version.id, input, all);
      await tx.schedule.update({
        where: { id: schedule.id },
        data: { revision: { increment: 1 }, submissionClosesAt: new Date() },
      });
      await tx.scheduleChange.create({
        data: {
          facilityId: actor.facilityId,
          scheduleId,
          changedById: actor.userId,
          changeType: 'UPDATE',
          reason: 'יצירה אוטומטית מחדש; איושים נעולים נשמרו',
          beforeData: JSON.parse(JSON.stringify(before)),
          afterData: JSON.parse(JSON.stringify(all)),
        },
      });
      return {
        ok: true as const,
        scheduleId,
        totalAssignments: all.length,
        warningCount: analysis.warnings.length,
        errorWarningCount: analysis.warnings.filter((w) => w.severity === 'ERROR').length,
        stats: output.stats,
      };
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'יצירת שיבוץ נכשלה' };
  }
}
