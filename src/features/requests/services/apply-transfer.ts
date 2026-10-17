import { Prisma, type Schedule, type ScheduleSlot } from '@/generated/prisma/client';
import type { ScheduleActor } from '@/features/schedules/services/transactions';
import { loadSchedulingInput } from '@/features/schedules/generation/queries';
import { computeManualViolations } from '@/features/scheduling-engine/manual-violations';
import type { EngineAssignment } from '@/features/scheduling-engine/types';
import { loadApprovedTimeOff } from '../queries';
import { toIsoDate, transferDecision, type TransferCheck } from '../rules';

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
  violations.push(...manual.violations.map(v => ({ code: v.code, message: v.message })));
  const timeOff = await loadApprovedTimeOff(tx, actor.facilityId, current.date, current.date);
  if (timeOff.get(request.targetUserId)?.has(toIsoDate(current.date))) {
    violations.push({ code: 'TIME_OFF', message: 'לעובד המקבל אושרה חופשה בתאריך זה' });
  }
  return result({ current, schedule });
}

export class TransferOverrideRequired extends Error {
  constructor(readonly violations: TransferCheck['violations']) { super('נדרש נימוק לאישור חריגה'); }
}

/**
 * Approves a one-way shift transfer: copies the published version into a new version with the slot
 * reassigned, publishes it (same capacity snapshot) and marks the request APPROVED.
 * Write order respects the SQL triggers: slots are inserted while the new version is still DRAFT,
 * then the version is flipped to PUBLISHED and the schedule pointer switched. The previous published
 * version stays untouched as history.
 */
export async function applyTransfer(tx: Prisma.TransactionClient, actor: ScheduleActor, requestId: string, overrideReason?: string) {
  const reason = overrideReason?.trim() || undefined;
  const { request, check, current, schedule } = await checkTransfer(tx, actor, requestId);
  const decision = transferDecision(check, reason);
  if (decision === 'BLOCKED') throw new Error(check.blocking.join('; '));
  if (decision === 'NEEDS_OVERRIDE') throw new TransferOverrideRequired(check.violations);
  if (!current || !schedule?.publishedVersionId || !request.targetUserId) throw new Error(VERSION_CHANGED);
  const previous = await tx.scheduleVersion.findUniqueOrThrow({ where: { id: schedule.publishedVersionId } });
  const max = await tx.scheduleVersion.aggregate({ where: { scheduleId: schedule.id }, _max: { number: true } });
  const version = await tx.scheduleVersion.create({ data: {
    scheduleId: schedule.id, facilityId: actor.facilityId, number: (max._max.number ?? 0) + 1,
  } });
  const slots = await tx.scheduleSlot.findMany({ where: { versionId: previous.id } });
  const note = `הועבר מ${request.requester.displayName} ל${request.target?.displayName ?? ''} (בקשת העברה)`;
  await tx.scheduleSlot.createMany({ data: slots.map(slot => {
    const moved = slot.id === current.id;
    return {
      scheduleId: schedule.id, facilityId: actor.facilityId, versionId: version.id,
      positionId: slot.positionId, date: slot.date, shiftType: slot.shiftType, slotNumber: slot.slotNumber,
      startsAt: slot.startsAt, endsAt: slot.endsAt, isLocked: slot.isLocked,
      userId: moved ? request.targetUserId : slot.userId,
      source: moved ? 'MANUAL' as const : slot.source,
      note: moved ? note : slot.note,
    };
  }) });
  const now = new Date();
  await tx.scheduleVersion.update({ where: { id: version.id }, data: {
    status: 'PUBLISHED', publishedAt: now, revision: previous.revision + 1,
    capacitySnapshot: previous.capacitySnapshot ?? Prisma.JsonNull,
  } });
  await tx.schedule.update({ where: { id: schedule.id }, data: { publishedVersionId: version.id } });
  const slotKey = { date: toIsoDate(current.date), shiftType: current.shiftType, positionId: current.positionId, slotNumber: current.slotNumber };
  await tx.scheduleChange.create({ data: {
    facilityId: actor.facilityId, scheduleId: schedule.id, versionId: version.id, changedById: actor.userId,
    changeType: check.violations.length ? 'MANUAL_OVERRIDE' : 'UPDATE',
    reason: reason ?? 'אושרה העברת משמרת',
    beforeData: { ...slotKey, userId: request.requesterId, versionId: previous.id },
    afterData: { ...slotKey, userId: request.targetUserId, versionId: version.id, requestId: request.id, violations: check.violations },
  } });
  const updated = await tx.employeeRequest.updateMany({
    where: { id: request.id, facilityId: actor.facilityId, status: 'PENDING_MANAGER' },
    data: { status: 'APPROVED', decidedById: actor.userId, decidedAt: now, overrideReason: check.violations.length ? reason : null },
  });
  if (updated.count !== 1) throw new Error('הבקשה כבר טופלה');
  return { versionId: version.id, scheduleId: schedule.id };
}
