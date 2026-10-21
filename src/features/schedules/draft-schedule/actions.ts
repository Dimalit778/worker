'use server';
import { requireManager } from '@/lib/db/auth-helpers';
import { scheduleTransaction, checkedVersion, freezePublishedVersion, preserveOriginalSchedule, type VersionExpectation } from '../services/transactions';
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

export async function publishSchedule(scheduleId: string, options: VersionExpectation & { confirmIssues?: boolean; reason?: string }) {
  const actor = await requireManager();
  try {
    return await scheduleTransaction(actor, async tx => {
      const { version } = await checkedVersion(tx, actor, scheduleId, options);
      if (!version || version.status !== 'DRAFT') throw new Error('לא נמצאה טיוטה לפרסום');
      const data = await loadSchedulingInput(tx, scheduleId, actor.facilityId, version.id);
      const failures = validateAssignments(data.input, data.allAssignments);
      if (failures.length) throw new Error(failures.join('; '));
      const analysis = await saveScheduleAnalysis(tx, version.id, data.input, data.allAssignments);
      const problems = analysis.warnings.filter((warning) => warning.severity === 'ERROR');
      if (problems.length && !options.confirmIssues) return { requiresConfirmation: true as const, issueCount: problems.length, message: `קיימות ${problems.length} בעיות בשיבוץ. לפרסם בכל זאת?` };
      const now = new Date();
      await freezePublishedVersion(tx, version.id, data.capacities, data.dateOverrides, now);
      await preserveOriginalSchedule(tx, scheduleId, version.id);
      await tx.schedule.update({ where: { id: scheduleId }, data: {
        status: 'PUBLISHED', publishedAt: now, publishedVersionId: version.id, draftVersionId: null,
      } });
      await tx.scheduleChange.create({ data: { facilityId: actor.facilityId, scheduleId, versionId: version.id, changedById: actor.userId, changeType: 'PUBLISH', reason: options.reason?.trim() || 'פרסום שיבוץ', afterData: { revision: version.revision + 1, note: options.confirmIssues ? 'פורסם עם אישור בעיות' : 'פורסם', confirmedWarnings: options.confirmIssues ? problems.map(w => w.message) : [] } } });
      return { ok: true as const };
    });
  } catch (e) { return { error: e instanceof Error ? e.message : 'פרסום נכשל' }; }
}
