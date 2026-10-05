'use server';
import { PortalRole } from '@/lib/auth/portal';

import { prisma } from '@/lib/db/client';
import { requireManager, requireSession } from '@/lib/db/auth-helpers';
import { scheduleTransaction } from '@/features/schedules/services/transactions';
import { reconcileDraftCapacity } from '@/features/schedules/services/reconcile-capacity';
import { type DayCategory, type ShiftType } from '@/generated/prisma/client';
import {
  getPositions,
  getShiftCapacities,
  getShiftStaffingPositions,
  getSubmissionWindowRule,
  saveSubmissionWindowSetting,
} from '@/features/settings/queries';
import { ruleOrderError, type SubmissionWindowRule } from '@/features/periods/submission-window';

export async function updatePositionColor(
  positionId: string,
  color: string | null,
): Promise<{ ok: true } | { error: string }> {
  const session = await requireSession(PortalRole.MANAGER);
  const facilityId = session.user.facilityId;
  if (!facilityId) return { error: 'למנהל אין בית משפט משויך' };

  try {
    const position = await prisma.position.findFirst({
      where: { id: positionId, OR: [{ facilityId }, { facilityId: null }] },
      select: { id: true },
    });
    if (!position) return { error: 'התפקיד לא נמצא' };

    await prisma.position.update({
      where: { id: position.id },
      data: { color },
    });
    return { ok: true };
  } catch {
    return { error: 'עדכון הצבע נכשל' };
  }
}

export async function addStaffingRequirement(params: {
  positionId: string;
  shiftType: ShiftType;
  dayCategory: DayCategory;
  amount: number;
}) {
  const actor = await requireManager();
  try {
    if (!Number.isInteger(params.amount) || params.amount < 0) throw new Error('התקן חייב להיות מספר שלם ואינו יכול להיות שלילי');
    return await scheduleTransaction(actor, async tx => {
      const position = await tx.position.findFirst({
        where: { id: params.positionId, OR: [{ facilityId: actor.facilityId }, { facilityId: null }] },
        select: { id: true },
      });
      if (!position) throw new Error('התפקיד לא נמצא');
      const capacity = await tx.staffingRequirement.upsert({
        where: { facilityId_positionId_shiftType_dayCategory: {
          facilityId: actor.facilityId, positionId: params.positionId, shiftType: params.shiftType, dayCategory: params.dayCategory,
        } },
        update: { requiredCount: params.amount },
        create: { facilityId: actor.facilityId, positionId: params.positionId, shiftType: params.shiftType, dayCategory: params.dayCategory, requiredCount: params.amount },
        select: { id: true },
      });
      const reconciliation = await reconcileDraftCapacity(tx, actor);
      return { ok: true as const, id: capacity.id, ...reconciliation };
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'שמירת התקן נכשלה' };
  }
}

export async function updateStaffingRequirement(id: string, amount: number) {
  const actor = await requireManager();
  try {
    if (!Number.isInteger(amount) || amount < 0) throw new Error('התקן חייב להיות מספר שלם ואינו יכול להיות שלילי');
    return await scheduleTransaction(actor, async tx => {
      const capacity = await tx.staffingRequirement.findFirst({ where: { id, facilityId: actor.facilityId }, select: { id: true } });
      if (!capacity) throw new Error('התקן לא נמצא');
      await tx.staffingRequirement.update({ where: { id }, data: { requiredCount: amount } });
      const reconciliation = await reconcileDraftCapacity(tx, actor);
      return { ok: true as const, id, ...reconciliation };
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'עדכון התקן נכשל' };
  }
}

export async function fetchManagerPositions() {
  const session = await requireSession(PortalRole.MANAGER);
  const facilityId = session.user.facilityId ?? '';
  return getPositions(facilityId);
}

export async function fetchManagerShiftCapacities() {
  const session = await requireSession(PortalRole.MANAGER);
  const facilityId = session.user.facilityId ?? '';
  return getShiftCapacities(facilityId);
}

export async function fetchManagerShiftStaffingPositions() {
  const session = await requireSession(PortalRole.MANAGER);
  const facilityId = session.user.facilityId ?? '';
  return getShiftStaffingPositions(facilityId);
}

export async function fetchSubmissionWindowRule() {
  const session = await requireSession(PortalRole.MANAGER);
  const facilityId = session.user.facilityId ?? '';
  return getSubmissionWindowRule(facilityId);
}

export async function saveSubmissionWindowRule(
  rule: SubmissionWindowRule,
): Promise<{ ok: true } | { error: string }> {
  const session = await requireSession(PortalRole.MANAGER);
  const facilityId = session.user.facilityId;
  if (!facilityId) return { error: 'למנהל אין בית משפט משויך' };

  const ruleError = ruleOrderError(rule);
  if (ruleError) return { error: ruleError };

  await saveSubmissionWindowSetting(facilityId, rule);

  return { ok: true };
}

