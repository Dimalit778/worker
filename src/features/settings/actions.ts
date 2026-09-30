'use server';
import { PortalRole } from '@/lib/auth/portal';

import { prisma } from '@/lib/db/client';
import { requireSession } from '@/lib/db/auth-helpers';
import { type DayCategory, type ShiftType } from '@/generated/prisma/client';
import {
  getPositions,
  getShiftCapacities,
  getShiftStaffingPositions,
  getSubmissionWindowRule,
  managerCourtPositionsWhere,
} from '@/features/settings/queries';
import { ruleOrderError, type SubmissionWindowRule } from '@/features/periods/submission-window';

const ALL_SHIFTS: ShiftType[] = ['MORNING', 'EVENING', 'NIGHT'];

const DAY_VALUES = new Set<DayCategory>(['WEEKDAY', 'FRIDAY', 'SATURDAY']);
const SHIFT_SCOPE_VALUES = new Set<ShiftType | 'ALL'>(['MORNING', 'EVENING', 'NIGHT', 'ALL']);

function nextManagerPositionCode(maxCode: number | null) {
  if (maxCode == null) {
    return 1;
  }
  return maxCode + 1;
}

export async function addPositionWithCapacities(params: {
  name: string;
  dayCategory: DayCategory;
  shiftScope: ShiftType | 'ALL';
  amount: number;
}): Promise<{ ok: true } | { error: string }> {
  const session = await requireSession(PortalRole.MANAGER);
  const facilityId = session.user.facilityId;
  if (!facilityId) {
    return { error: 'למנהל אין בית משפט משויך' };
  }

  if (!DAY_VALUES.has(params.dayCategory)) {
    return { error: 'סוג יום לא תקין' };
  }
  if (!SHIFT_SCOPE_VALUES.has(params.shiftScope)) {
    return { error: 'סוג משמרת לא תקין' };
  }

  const name = params.name.trim();
  if (!name) {
    return { error: 'יש להזין שם תפקיד' };
  }

  const amount = Math.floor(Number(params.amount));
  if (Number.isNaN(amount) || amount < 0 || amount > 50) {
    return { error: 'כמות חייבת להיות מספר בין 0 ל־50' };
  }

  const shifts: ShiftType[] = params.shiftScope === 'ALL' ? ALL_SHIFTS : [params.shiftScope];

  try {
    const maxCode = await prisma.shiftRole.aggregate({
      where: managerCourtPositionsWhere(facilityId),
      _max: { code: true },
    });
    const code = nextManagerPositionCode(maxCode._max?.code ?? null);

    await prisma.$transaction(async (tx) => {
      const position = await tx.shiftRole.create({
        data: {
          facilityId,
          name,
          code,
          isActive: true,
        },
      });

      for (const shiftType of shifts) {
        await tx.staffingRequirement.create({
          data: {
            facilityId,
            shiftRoleId: position.id,
            shiftType,
            dayCategory: params.dayCategory,
            requiredCount: amount,
            isActive: true,
            displayOrder: code,
          },
        });
      }
    });


    return { ok: true };
  } catch (error) {
    console.error(error);
    return { error: 'הוספת התפקיד נכשלה' };
  }
}

export async function createPosition(name: string): Promise<{ ok: true } | { error: string }> {
  const session = await requireSession(PortalRole.MANAGER);
  const facilityId = session.user.facilityId;
  if (!facilityId) {
    return { error: 'למנהל אין בית משפט משויך' };
  }

  const trimmed = name.trim();
  if (!trimmed) {
    return { error: 'יש להזין שם תפקיד' };
  }

  try {
    const maxCode = await prisma.shiftRole.aggregate({
      where: managerCourtPositionsWhere(facilityId),
      _max: { code: true },
    });
    const code = nextManagerPositionCode(maxCode._max?.code ?? null);

    await prisma.shiftRole.create({
      data: {
        facilityId,
        name: trimmed,
        code,
        isActive: true,
      },
    });

    return { ok: true };
  } catch (error) {
    console.error(error);
    return { error: 'הוספת התפקיד נכשלה' };
  }
}

export async function upsertPositionForDisplayOrder(params: {
  displayOrder: number;
  name: string;
}): Promise<{ ok: true } | { error: string }> {
  const session = await requireSession(PortalRole.MANAGER);
  const facilityId = session.user.facilityId;
  if (!facilityId) {
    return { error: 'למנהל אין בית משפט משויך' };
  }

  const rowCode = Math.floor(Number(params.displayOrder));
  if (Number.isNaN(rowCode) || rowCode < 1 || rowCode > 200) {
    return { error: 'מספר שורה לא תקין' };
  }

  const name = params.name.trim();
  if (!name) {
    return { error: 'יש להזין שם תפקיד' };
  }
  if (name === 'מנהל') {
    return { error: 'לא ניתן לערוך את תפקיד המנהל' };
  }

  try {
    const existingAtRow = await prisma.shiftRole.findFirst({
      where: {
        facilityId,
        code: rowCode,
        name: { not: 'מנהל' },
      },
      select: { id: true },
      orderBy: [{ isActive: 'desc' }, { createdAt: 'asc' }],
    });

    if (existingAtRow) {
      await prisma.shiftRole.update({
        where: { id: existingAtRow.id },
        data: { name, code: rowCode, isActive: true },
      });
    } else {
      await prisma.shiftRole.upsert({
        where: {
          facilityId_name: {
            facilityId,
            name,
          },
        },
        update: {
          code: rowCode,
          isActive: true,
        },
        create: {
          facilityId,
          name,
          code: rowCode,
          isActive: true,
        },
      });
    }

    return { ok: true };
  } catch (error) {
    console.error(error);
    return { error: 'שמירת התפקיד נכשלה' };
  }
}

async function swapPositionOrderWithNeighbor(
  sessionCourtId: string,
  positionId: string,
  direction: 'up' | 'down',
): Promise<{ ok: true } | { error: string }> {
  return prisma.$transaction(async (tx) => {
    const self = await tx.shiftRole.findFirst({
      where: { id: positionId, facilityId: sessionCourtId },
      select: { id: true, name: true },
    });

    if (!self) {
      return { error: 'התפקיד לא נמצא' };
    }

    if (self.name === 'מנהל') {
      return { error: 'לא ניתן לשנות סדר לתפקיד זה' };
    }

    const ordered = await tx.shiftRole.findMany({
      where: managerCourtPositionsWhere(sessionCourtId),
      select: { id: true, code: true },
      orderBy: [{ code: 'asc' }, { createdAt: 'asc' }],
    });

    const index = ordered.findIndex((p) => p.id === positionId);
    if (index === -1) {
      return { error: 'התפקיד לא נמצא' };
    }

    const j = direction === 'up' ? index - 1 : index + 1;
    if (j < 0 || j >= ordered.length) {
      return { error: 'לא ניתן להזיז את התפקיד' };
    }

    const a = ordered[index]!;
    const b = ordered[j]!;
    const codeA = a.code;
    const codeB = b.code;

    const maxRow = await tx.shiftRole.aggregate({
      where: { facilityId: sessionCourtId },
      _max: { code: true },
    });
    let tempCode = (maxRow._max.code ?? 0) + 1;
    while (tempCode === codeA || tempCode === codeB) {
      tempCode += 1;
    }

    await tx.shiftRole.update({ where: { id: a.id }, data: { code: tempCode } });
    await tx.shiftRole.update({ where: { id: b.id }, data: { code: codeA } });
    await tx.shiftRole.update({ where: { id: a.id }, data: { code: codeB } });

    await tx.staffingRequirement.updateMany({
      where: { shiftRoleId: a.id },
      data: { displayOrder: codeB },
    });
    await tx.staffingRequirement.updateMany({
      where: { shiftRoleId: b.id },
      data: { displayOrder: codeA },
    });

    return { ok: true };
  });
}

export async function updatePositionColor(
  positionId: string,
  color: string | null,
): Promise<{ ok: true } | { error: string }> {
  const session = await requireSession(PortalRole.MANAGER);
  const facilityId = session.user.facilityId;
  if (!facilityId) return { error: 'למנהל אין בית משפט משויך' };

  try {
    await prisma.shiftRole.update({
      where: { id: positionId, facilityId },
      data: { color },
    });
    return { ok: true };
  } catch {
    return { error: 'עדכון הצבע נכשל' };
  }
}

export async function movePositionUp(positionId: string): Promise<{ ok: true } | { error: string }> {
  const session = await requireSession(PortalRole.MANAGER);
  const facilityId = session.user.facilityId;
  if (!facilityId) {
    return { error: 'למנהל אין בית משפט משויך' };
  }

  const res = await swapPositionOrderWithNeighbor(facilityId, positionId, 'up');
  if ('ok' in res && res.ok) {
  }
  return res;
}

export async function movePositionDown(positionId: string): Promise<{ ok: true } | { error: string }> {
  const session = await requireSession(PortalRole.MANAGER);
  const facilityId = session.user.facilityId;
  if (!facilityId) {
    return { error: 'למנהל אין בית משפט משויך' };
  }

  const res = await swapPositionOrderWithNeighbor(facilityId, positionId, 'down');
  if ('ok' in res && res.ok) {
  }
  return res;
}

export async function addStaffingRequirement(params: {
  positionId: string;
  shiftType: ShiftType;
  dayCategory: DayCategory;
  amount: number;
}) {
  try {
    const position = await prisma.shiftRole.findUnique({
      where: {
        id: params.positionId,
      },
      select: {
        facilityId: true,
        code: true,
      },
    });

    if (!position) {
      return { error: 'התפקיד לא נמצא' };
    }

    const capacity = await prisma.staffingRequirement.upsert({
      where: {
        facilityId_shiftRoleId_shiftType_dayCategory: {
          facilityId: position.facilityId,
          shiftRoleId: params.positionId,
          shiftType: params.shiftType,
          dayCategory: params.dayCategory,
        },
      },
      update: {
        requiredCount: params.amount,
        isActive: true,
      },
      create: {
        facilityId: position.facilityId,
        shiftRoleId: params.positionId,
        shiftType: params.shiftType,
        dayCategory: params.dayCategory,
        requiredCount: params.amount,
        isActive: true,
        displayOrder: position.code,
      },
      select: {
        id: true,
      },
    });


    return {
      ok: true,
      id: capacity.id,
    };
  } catch (error) {
    console.error(error);
    return { error: 'שמירת התקן נכשלה' };
  }
}

export async function updateStaffingRequirement(id: string, amount: number) {
  try {
    await prisma.staffingRequirement.update({
      where: {
        id,
      },
      data: {
        requiredCount: amount,
      },
    });


    return {
      ok: true,
      id,
    };
  } catch (error) {
    console.error(error);
    return { error: 'עדכון התקן נכשל' };
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

  await prisma.facility.update({
    where: { id: facilityId },
    data: {
      submissionOpenWeekday: rule.openWeekday,
      submissionOpenTime: rule.openTime,
      submissionCloseWeekday: rule.closeWeekday,
      submissionCloseTime: rule.closeTime,
    },
  });

  return { ok: true };
}

export async function updatePositionCapability(positionId: string, requiredCapability: 'GUARD' | 'CONTROLLER' | 'SHIFT_MANAGER') {
  const session = await requireSession(PortalRole.MANAGER);
  if (!['GUARD','CONTROLLER','SHIFT_MANAGER'].includes(requiredCapability)) return { error: 'כשירות לא תקינה' };
  const result = await prisma.shiftRole.updateMany({ where: { id: positionId, facilityId: session.user.facilityId ?? '' }, data: { requiredCapability } });
  return result.count ? { ok: true as const } : { error: 'תפקיד לא נמצא' };
}
