'use server';
import { generateSchedule } from '@/features/scheduling-engine/generate-schedule';
import { validateAssignments } from '@/features/scheduling-engine/validate';
import { requireManager } from '@/lib/db/auth-helpers';
import { scheduleTransaction, editableDraft, type VersionExpectation } from '../services/transactions';
import { loadSchedulingInput } from './queries';
import { saveScheduleAnalysis } from './recalculate';

export async function generateAutoSchedule(scheduleId: string, expected: VersionExpectation) {
  const actor = await requireManager();
  try {
    return await scheduleTransaction(actor, async tx => {
      const { version, schedule } = await editableDraft(tx, actor, scheduleId, expected);
      const { input, assignments: before } = await loadSchedulingInput(tx, scheduleId, actor.facilityId, version.id);
      const output = generateSchedule(input);
      const all = [...input.manualAssignments, ...output.assignments];
      const failures = validateAssignments(input, all);
      if (failures.length) throw new Error(failures.join('; '));
      await tx.shiftAssignment.deleteMany({ where: { versionId: version.id, isLocked: false } });
      if (output.assignments.length) await tx.shiftAssignment.createMany({ data: output.assignments.map(a => ({ scheduleId, versionId: version.id, facilityId: actor.facilityId, employeeId: a.employeeId, shiftRoleId: a.positionId, date: a.date, shiftType: a.shiftType, source: 'AUTOMATIC', isLocked: false })) });
      const analysis = await saveScheduleAnalysis(tx, version.id, input, all);
      await tx.rosterVersion.update({ where: { id: version.id }, data: { revision: { increment: 1 } } });
      await tx.schedulePeriod.update({ where: { id: schedule.periodId }, data: { submissionState: 'CLOSED' } });
      await tx.roster.update({ where: { id: scheduleId }, data: { generatedAt: new Date() } });
      await tx.scheduleChangeLog.create({ data: { scheduleId, versionId: version.id, changedById: actor.userId, changeType: 'UPDATE', message: 'יצירה אוטומטית מחדש; איושים נעולים נשמרו', beforeData: JSON.parse(JSON.stringify(before)), afterData: JSON.parse(JSON.stringify(all)) } });
      return { ok: true as const, scheduleId, totalAssignments: all.length, warningCount: analysis.warnings.length, errorWarningCount: analysis.warnings.filter(w => w.severity === 'ERROR').length, stats: output.stats };
    });
  } catch (e) { return { error: e instanceof Error ? e.message : 'יצירת שיבוץ נכשלה' }; }
}
