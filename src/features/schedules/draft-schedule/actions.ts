'use server';
import { requireManager } from '@/lib/db/auth-helpers';
import { scheduleTransaction, checkedVersion, type VersionExpectation } from '../services/transactions';
import { loadSchedulingInput } from '../generation/queries';
import { saveScheduleAnalysis } from '../generation/recalculate';
import { validateAssignments } from '@/features/scheduling-engine/validate';

export async function finalizeSchedule(scheduleId: string, expected: VersionExpectation) {
  const actor = await requireManager();
  try {
    return await scheduleTransaction(actor, async tx => {
      const { version } = await checkedVersion(tx, actor, scheduleId, expected);
      if (!version || version.status !== 'DRAFT') throw new Error('לא נמצאה טיוטה');
      const data = await loadSchedulingInput(tx, scheduleId, actor.facilityId, version.id);
      const failures = validateAssignments(data.input, data.allAssignments);
      if (failures.length) throw new Error(failures.join('; '));
      return { ok: true as const };
    });
  } catch (e) { return { error: e instanceof Error ? e.message : 'בדיקת השיבוץ נכשלה' }; }
}

export async function publishSchedule(scheduleId: string, options: VersionExpectation & { confirmIssues?: boolean; reason: string }) {
  const actor = await requireManager();
  try {
    if (!options.reason?.trim()) throw new Error('יש להזין סיבת פרסום או שינוי');
    return await scheduleTransaction(actor, async tx => {
      const { version } = await checkedVersion(tx, actor, scheduleId, options);
      if (!version || version.status !== 'DRAFT') throw new Error('לא נמצאה טיוטה לפרסום');
      const data = await loadSchedulingInput(tx, scheduleId, actor.facilityId, version.id);
      const failures = validateAssignments(data.input, data.allAssignments);
      if (failures.length) throw new Error(failures.join('; '));
      const analysis = await saveScheduleAnalysis(tx, version.id, data.input, data.allAssignments);
      if (analysis.warnings.length && !options.confirmIssues) return { requiresConfirmation: true as const, issueCount: analysis.warnings.length, message: `קיימות ${analysis.warnings.length} אזהרות, לרבות חוסרים אפשריים. לפרסם בכל זאת?` };
      await tx.rosterVersion.updateMany({ where: { scheduleId, isActive: true }, data: { isActive: false } });
      await tx.rosterVersion.update({ where: { id: version.id }, data: { status: 'PUBLISHED', isActive: true, publishedAt: new Date(), revision: { increment: 1 }, note: options.reason.trim() } });
      await tx.schedulePeriod.update({ where: { id: data.schedule.periodId }, data: { submissionState: 'CLOSED' } });
      await tx.scheduleChangeLog.create({ data: { scheduleId, versionId: version.id, changedById: actor.userId, changeType: 'PUBLISH', reason: options.reason.trim(), message: options.confirmIssues ? 'פורסם עם אישור אזהרות' : 'פורסם', afterData: { revision: version.revision, confirmedWarnings: options.confirmIssues ? analysis.warnings.map(w => w.message) : [] } } });
      return { ok: true as const };
    });
  } catch (e) { return { error: e instanceof Error ? e.message : 'פרסום נכשל' }; }
}
