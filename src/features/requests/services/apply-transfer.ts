import type { Prisma, Schedule, ScheduleSlot } from '@/generated/prisma/client';
import type { ScheduleActor } from '@/features/schedules/services/transactions';
import { recordSlotChanges } from '@/features/schedules/change-log/record';
import { loadSchedulingInput } from '@/features/schedules/generation/queries';
import { computeManualViolations } from '@/features/scheduling-engine/manual-violations';
import type { EngineAssignment } from '@/features/scheduling-engine/types';
import { transferDecision, type TransferCheck } from '../rules';

export const VERSION_CHANGED = 'הגרסה השתנתה: המשמרת כבר אינה משובצת לעובד המבקש';

const toEngine = (a: { userId: string | null; facilityId: string; positionId: string; date: Date; shiftType: EngineAssignment['shiftType']; slotNumber: number; isLocked: boolean; source: EngineAssignment['source'] }): EngineAssignment => ({
  employeeId: a.userId ?? '', facilityId: a.facilityId, positionId: a.positionId, date: a.date, shiftType: a.shiftType,
  slotIndex: Math.max(0, a.slotNumber - 1), isManualOverride: a.isLocked, source: a.source,
});

/**
 * Re-checks a PENDING_MANAGER transfer against the schedule's CURRENT published version.
 * Must run inside scheduleTransaction (facility lock + manager permission).
 */
export async function checkTransfer(tx: Prisma.TransactionClient, actor: ScheduleActor, requestId: string, now = new Date()) {
  const request = await tx.employeeRequest.findFirst({
    where: { id: requestId, facilityId: actor.facilityId, type: 'SHIFT_SWAP' },
    include: { slot: true, requester: { select: { displayName: true } }, target: { select: { id: true, displayName: true, isActive: true, facilityId: true, role: { select: { rank: true } } } } },
  });
  if (!request) throw new Error('הבקשה לא נמצאה');
  const blocking: string[] = [];
  const violations: TransferCheck['violations'] = [];
  const result = (extra: { current?: ScheduleSlot; schedule?: Schedule } = {}) =>
    ({ request, check: { blocking, violations } as TransferCheck, ...extra });

  if (request.status !== 'PENDING_MANAGER') { blocking.push('הבקשה כבר טופלה'); return result(); }
  if (!request.slot || !request.targetUserId || !request.target) { blocking.push('בקשת ההעברה אינה שלמה'); return result(); }
  const schedule = await tx.schedule.findFirst({ where: { id: request.slot.scheduleId, facilityId: actor.facilityId } });
  if (!schedule?.publishedVersionId) { blocking.push(VERSION_CHANGED); return result(); }
  const current = await tx.scheduleSlot.findFirst({ where: {
    versionId: schedule.publishedVersionId, date: request.slot.date, shiftType: request.slot.shiftType,
    positionId: request.slot.positionId, slotNumber: request.slot.slotNumber,
  } });
  if (!current || current.userId !== request.requesterId) { blocking.push(VERSION_CHANGED); return result({ schedule }); }
  if (current.startsAt <= now) blocking.push('המשמרת כבר התחילה או הסתיימה');
  if (!request.target.isActive) blocking.push('העובד המקבל אינו פעיל');
  if (request.target.facilityId !== actor.facilityId) blocking.push('העובד המקבל אינו שייך למתקן');
  if (request.target.role.rank === 1) blocking.push('העובד המקבל אינו משובץ במשמרות');
  // The DB allows only one DRAFT version per schedule, so a new published version cannot be built while a correction is open.
  if (schedule.draftVersionId) blocking.push('קיימת טיוטת תיקון פתוחה לשיבוץ זה. יש לפרסם אותה לפני אישור ההעברה');
  if (blocking.length) return result({ current, schedule });

  const data = await loadSchedulingInput(tx, schedule.id, actor.facilityId, schedule.publishedVersionId, schedule);
  const others = data.assignments.filter(a => a.id !== current.id).map(toEngine);
  const candidate = toEngine({ ...current, userId: request.targetUserId, source: 'MANUAL' });
  const manual = computeManualViolations(data.input, others, candidate);
  blocking.push(...manual.blocking);
  // Includes TIME_OFF: loadSchedulingInput carries approved vacations into the engine input.
  violations.push(...manual.violations.map(v => ({ code: v.code, message: v.message })));
  return result({ current, schedule });
}

export class TransferOverrideRequired extends Error {
  constructor(readonly violations: TransferCheck['violations']) { super('נדרש נימוק לאישור חריגה'); }
}

/** Approve a transfer in place, preserving the original and stable request/slot IDs. */
export async function applyTransfer(tx: Prisma.TransactionClient, actor: ScheduleActor, requestId: string, overrideReason?: string) {
  const reason = overrideReason?.trim() || undefined;
  const { request, check, current, schedule } = await checkTransfer(tx, actor, requestId);
  const decision = transferDecision(check, reason);
  if (decision === 'BLOCKED') throw new Error(check.blocking.join('; '));
  if (decision === 'NEEDS_OVERRIDE') throw new TransferOverrideRequired(check.violations);
  if (!current || !schedule?.publishedVersionId || !request.targetUserId) throw new Error(VERSION_CHANGED);
  const before = [current];
  const note = `הועבר מ${request.requester.displayName} ל${request.target?.displayName ?? ''} (בקשת העברה)`;
  const moved = await tx.scheduleSlot.update({ where: { id: current.id }, data: {
    userId: request.targetUserId, source: 'MANUAL', note,
  } });
  await tx.scheduleVersion.update({ where: { id: schedule.publishedVersionId }, data: { revision: { increment: 1 } } });
  await recordSlotChanges(tx, actor, schedule.id, schedule.publishedVersionId, before, [moved],
    check.violations.map(v => ({ ...v, employeeId: request.targetUserId! })), `אושרה העברת משמרת${reason ? ` · ${reason}` : ''}`, request.id);
  const now = new Date();
  const updated = await tx.employeeRequest.updateMany({
    where: { id: request.id, facilityId: actor.facilityId, status: 'PENDING_MANAGER' },
    data: { status: 'APPROVED', decidedById: actor.userId, decidedAt: now, overrideReason: check.violations.length ? reason : null },
  });
  if (updated.count !== 1) throw new Error('הבקשה כבר טופלה');
  return { versionId: schedule.publishedVersionId, scheduleId: schedule.id };
}
