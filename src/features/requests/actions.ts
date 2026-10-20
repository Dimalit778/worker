'use server';

import type { EmployeeRequestStatus } from '@/generated/prisma/client';
import { prisma } from '@/lib/db/client';
import { requireEmployee, requireManager } from '@/lib/db/auth-helpers';
import { expireFacilityData } from '@/lib/cache/data-cache';
import { todayUtcDateForTimeZone } from '@/features/periods/utils';
import { scheduleTransaction } from '@/features/schedules/services/transactions';
import { canEmployeeFillPosition } from '@/features/scheduling-engine/role-eligibility';
import {
  cleanText, nextRequestStatus, OPEN_STATUSES, parseIsoDate, TIME_OFF_MAX_DAYS, URGENT_MAX_DAYS,
  validateDateRange, type RequestAction,
} from './rules';
import { findAffectedSlots, getEmployeeRequests, getManagerQueue, getTransferOptions, positionRank, type QueueFilter } from './queries';
import { applyTransfer, TransferOverrideRequired } from './services/apply-transfer';
import type { ActionResult, ApproveResult } from './types';

const today = () => todayUtcDateForTimeZone('Asia/Jerusalem');
const message = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);

export async function fetchMyRequests() {
  const { facilityId, userId } = await requireEmployee();
  return getEmployeeRequests(facilityId, userId);
}

export async function fetchTransferOptions() {
  const { facilityId, userId } = await requireEmployee();
  return getTransferOptions(facilityId, userId);
}

export async function fetchRequestQueue(filter: QueueFilter = 'open') {
  const { facilityId } = await requireManager();
  return getManagerQueue(facilityId, ['open', 'closed', 'all'].includes(filter) ? filter : 'open');
}

export async function createDateRequest(input: { type: 'TIME_OFF' | 'URGENT_ABSENCE'; startDate: string; endDate: string; reason?: string }): Promise<ActionResult> {
  const { facilityId, userId } = await requireEmployee();
  if (input.type !== 'TIME_OFF' && input.type !== 'URGENT_ABSENCE') return { ok: false, error: 'סוג בקשה לא תקין' };
  const start = parseIsoDate(input.startDate);
  const end = parseIsoDate(input.endDate);
  const error = validateDateRange(start, end, today(), input.type === 'TIME_OFF' ? TIME_OFF_MAX_DAYS : URGENT_MAX_DAYS);
  if (error) return { ok: false, error };
  const reason = cleanText(input.reason);
  if (input.type === 'URGENT_ABSENCE' && reason.length < 2) return { ok: false, error: 'יש לפרט את סיבת ההיעדרות' };
  const overlap = await prisma.employeeRequest.findFirst({ where: {
    facilityId, requesterId: userId, type: input.type, status: { in: [...OPEN_STATUSES, 'APPROVED'] },
    startDate: { lte: end! }, endDate: { gte: start! },
  }, select: { id: true } });
  if (overlap) return { ok: false, error: 'קיימת כבר בקשה לתאריכים אלה' };
  await prisma.employeeRequest.create({ data: {
    facilityId, requesterId: userId, type: input.type, status: 'PENDING_MANAGER',
    startDate: start, endDate: end, reason: reason || null,
  } });
  return { ok: true };
}

export async function createTransferRequest(input: { slotId: string; targetUserId: string; reason?: string }): Promise<ActionResult> {
  const { facilityId, userId } = await requireEmployee();
  if (!input.targetUserId || input.targetUserId === userId) return { ok: false, error: 'יש לבחור עובד אחר' };
  const slot = await prisma.scheduleSlot.findFirst({
    where: { id: input.slotId, facilityId, userId, startsAt: { gt: new Date() }, version: { publishedFor: { is: { facilityId } } } },
    include: { position: { include: { baseRole: { select: { rank: true } } } } },
  });
  if (!slot) return { ok: false, error: 'המשמרת לא נמצאה בשיבוץ המפורסם' };
  const target = await prisma.user.findFirst({
    where: { id: input.targetUserId, facilityId, isActive: true, role: { rank: { not: 1 } } },
    select: { role: { select: { rank: true } } },
  });
  if (!target || !canEmployeeFillPosition(target.role.rank, positionRank(slot.position))) return { ok: false, error: 'העובד שנבחר אינו יכול לקבל משמרת זו' };
  const open = await prisma.employeeRequest.findFirst({ where: { facilityId, requesterId: userId, type: 'SHIFT_SWAP', slotId: slot.id, status: { in: [...OPEN_STATUSES] } }, select: { id: true } });
  if (open) return { ok: false, error: 'כבר קיימת בקשת העברה פתוחה למשמרת זו' };
  await prisma.employeeRequest.create({ data: {
    facilityId, requesterId: userId, type: 'SHIFT_SWAP', status: 'PENDING_PEER',
    slotId: slot.id, targetUserId: input.targetUserId, reason: cleanText(input.reason) || null,
  } });
  return { ok: true };
}

/** Optimistic status transition: only succeeds if the row is still in the status the guard was computed from. */
async function employeeTransition(requestId: string, action: Extract<RequestAction, 'CANCEL' | 'PEER_ACCEPT' | 'PEER_DECLINE'>): Promise<ActionResult> {
  const { facilityId, userId } = await requireEmployee();
  const owner = action === 'CANCEL' ? { requesterId: userId } : { targetUserId: userId };
  const request = await prisma.employeeRequest.findFirst({ where: { id: requestId, facilityId, ...owner } });
  if (!request) return { ok: false, error: 'הבקשה לא נמצאה' };
  const next = nextRequestStatus(request, action, today());
  if (!next) return { ok: false, error: 'לא ניתן לבצע פעולה זו במצב הנוכחי של הבקשה' };
  const updated = await prisma.employeeRequest.updateMany({
    where: { id: requestId, facilityId, ...owner, status: request.status },
    data: { status: next, ...(action === 'CANCEL' ? {} : { peerRespondedAt: new Date() }) },
  });
  if (updated.count === 1) expireFacilityData(facilityId);
  return updated.count === 1 ? { ok: true } : { ok: false, error: 'הבקשה עודכנה בינתיים. יש לרענן' };
}

export async function cancelRequest(requestId: string) {
  return employeeTransition(requestId, 'CANCEL');
}

export async function respondToTransfer(requestId: string, accept: boolean) {
  return employeeTransition(requestId, accept ? 'PEER_ACCEPT' : 'PEER_DECLINE');
}

export async function approveRequest(requestId: string, input: { decisionNote?: string; overrideReason?: string } = {}): Promise<ApproveResult> {
  const actor = await requireManager();
  const decisionNote = cleanText(input.decisionNote);
  try {
    return await scheduleTransaction(actor, async tx => {
      const request = await tx.employeeRequest.findFirst({ where: { id: requestId, facilityId: actor.facilityId } });
      if (!request) throw new Error('הבקשה לא נמצאה');
      if (!nextRequestStatus(request, 'APPROVE', today())) throw new Error('הבקשה כבר טופלה');
      if (request.type === 'SHIFT_SWAP') {
        await applyTransfer(tx, actor, requestId, cleanText(input.overrideReason));
        if (decisionNote) await tx.employeeRequest.update({ where: { id: requestId }, data: { decisionNote } });
        return { ok: true as const, affectedSlots: [] };
      }
      if (request.type === 'URGENT_ABSENCE' && decisionNote.length < 2) throw new Error('יש לתאר כיצד טופלה ההיעדרות');
      const updated = await tx.employeeRequest.updateMany({
        where: { id: requestId, facilityId: actor.facilityId, status: request.status },
        data: { status: 'APPROVED', decidedById: actor.userId, decidedAt: new Date(), decisionNote: decisionNote || null },
      });
      if (updated.count !== 1) throw new Error('הבקשה כבר טופלה');
      const affectedSlots = request.startDate && request.endDate
        ? await findAffectedSlots(tx, actor.facilityId, request.requesterId, request.startDate, request.endDate)
        : [];
      return {
        ok: true as const, affectedSlots,
        note: affectedSlots.length ? 'השיבוצים הקיימים לא שונו. יש לטפל בהם ידנית בטיוטת תיקון.' : undefined,
      };
    });
  } catch (e) {
    if (e instanceof TransferOverrideRequired) return { ok: false, requiresOverride: true, violations: e.violations };
    return { ok: false, error: message(e, 'אישור הבקשה נכשל') };
  }
}

export async function rejectRequest(requestId: string, decisionNoteInput: string): Promise<ActionResult> {
  const actor = await requireManager();
  const decisionNote = cleanText(decisionNoteInput);
  if (decisionNote.length < 2) return { ok: false, error: 'יש לציין סיבת דחייה' };
  try {
    return await scheduleTransaction(actor, async tx => {
      const request = await tx.employeeRequest.findFirst({ where: { id: requestId, facilityId: actor.facilityId } });
      if (!request || !nextRequestStatus(request, 'REJECT', today())) throw new Error('לא ניתן לדחות בקשה זו');
      const updated = await tx.employeeRequest.updateMany({
        where: { id: requestId, facilityId: actor.facilityId, status: request.status as EmployeeRequestStatus },
        data: { status: 'REJECTED', decidedById: actor.userId, decidedAt: new Date(), decisionNote },
      });
      if (updated.count !== 1) throw new Error('הבקשה כבר טופלה');
      return { ok: true as const };
    });
  } catch (e) {
    return { ok: false, error: message(e, 'דחיית הבקשה נכשלה') };
  }
}
