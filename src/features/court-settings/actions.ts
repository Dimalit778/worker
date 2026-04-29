'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/client';
import { requireSession } from '@/lib/db/auth-helpers';
import { SystemRole, type DayCategory, type ShiftType } from '@/generated/prisma/client';
import { managerCourtPositionsWhere } from '@/features/court-settings/queries';

const ALL_SHIFTS: ShiftType[] = ['MORNING', 'EVENING', 'NIGHT'];

const DAY_VALUES = new Set<DayCategory>(['WEEKDAY', 'FRIDAY', 'SATURDAY', 'HOLIDAY']);
const SHIFT_SCOPE_VALUES = new Set<ShiftType | 'ALL'>(['MORNING', 'EVENING', 'NIGHT', 'ALL']);

function nextManagerPositionDisplayOrder(maxDisplayOrder: number | null) {
  if (maxDisplayOrder == null) {
    return 1;
  }
  return maxDisplayOrder + 1;
}

export async function addPositionWithCapacities(params: {
  name: string;
  dayCategory: DayCategory;
  shiftScope: ShiftType | 'ALL';
  amount: number;
}): Promise<{ ok: true } | { error: string }> {
  const session = await requireSession(SystemRole.MANAGER);
  const courtId = session.user.courtId;
  if (!courtId) {
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
    const maxOrder = await prisma.position.aggregate({
      where: managerCourtPositionsWhere(courtId),
      _max: { displayOrder: true },
    });
    const displayOrder = nextManagerPositionDisplayOrder(maxOrder._max.displayOrder);

    await prisma.$transaction(async (tx) => {
      const position = await tx.position.create({
        data: {
          courtId,
          name,
          displayOrder,
          isActive: true,
        },
      });

      for (const shiftType of shifts) {
        await tx.shiftCapacity.create({
          data: {
            courtId,
            positionId: position.id,
            shiftType,
            dayCategory: params.dayCategory,
            amount,
            displayOrder,
            isActive: true,
          },
        });
      }
    });

    revalidatePath('/manager/settings');

    return { ok: true };
  } catch (error) {
    console.error(error);
    return { error: 'הוספת התפקיד נכשלה' };
  }
}

export async function createPosition(name: string): Promise<{ ok: true } | { error: string }> {
  const session = await requireSession(SystemRole.MANAGER);
  const courtId = session.user.courtId;
  if (!courtId) {
    return { error: 'למנהל אין בית משפט משויך' };
  }

  const trimmed = name.trim();
  if (!trimmed) {
    return { error: 'יש להזין שם תפקיד' };
  }

  try {
    const maxOrder = await prisma.position.aggregate({
      where: managerCourtPositionsWhere(courtId),
      _max: { displayOrder: true },
    });
    const displayOrder = nextManagerPositionDisplayOrder(maxOrder._max.displayOrder);

    await prisma.position.create({
      data: {
        courtId,
        name: trimmed,
        displayOrder,
        isActive: true,
      },
    });

    revalidatePath('/manager/settings');
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
  const session = await requireSession(SystemRole.MANAGER);
  const courtId = session.user.courtId;
  if (!courtId) {
    return { error: 'למנהל אין בית משפט משויך' };
  }

  const displayOrder = Math.floor(Number(params.displayOrder));
  if (Number.isNaN(displayOrder) || displayOrder < 1 || displayOrder > 200) {
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
    const existingAtRow = await prisma.position.findFirst({
      where: {
        courtId,
        displayOrder,
        name: { not: 'מנהל' },
      },
      select: { id: true },
      orderBy: [{ isActive: 'desc' }, { createdAt: 'asc' }],
    });

    if (existingAtRow) {
      await prisma.position.update({
        where: { id: existingAtRow.id },
        data: { name, displayOrder, isActive: true },
      });
    } else {
      await prisma.position.upsert({
        where: {
          courtId_name: {
            courtId,
            name,
          },
        },
        update: {
          displayOrder,
          isActive: true,
        },
        create: {
          courtId,
          name,
          displayOrder,
          isActive: true,
        },
      });
    }

    revalidatePath('/manager/draft');
    revalidatePath('/manager/settings');
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
    const self = await tx.position.findFirst({
      where: { id: positionId, courtId: sessionCourtId },
      select: { id: true, name: true },
    });

    if (!self) {
      return { error: 'התפקיד לא נמצא' };
    }

    if (self.name === 'מנהל') {
      return { error: 'לא ניתן לשנות סדר לתפקיד זה' };
    }

    const ordered = await tx.position.findMany({
      where: managerCourtPositionsWhere(sessionCourtId),
      select: { id: true, displayOrder: true },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
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
    const oa = a.displayOrder;
    const ob = b.displayOrder;

    await tx.position.update({ where: { id: a.id }, data: { displayOrder: ob } });
    await tx.position.update({ where: { id: b.id }, data: { displayOrder: oa } });

    await tx.shiftCapacity.updateMany({
      where: { positionId: a.id },
      data: { displayOrder: ob },
    });
    await tx.shiftCapacity.updateMany({
      where: { positionId: b.id },
      data: { displayOrder: oa },
    });

    return { ok: true };
  });
}

export async function movePositionUp(
  positionId: string,
): Promise<{ ok: true } | { error: string }> {
  const session = await requireSession(SystemRole.MANAGER);
  const courtId = session.user.courtId;
  if (!courtId) {
    return { error: 'למנהל אין בית משפט משויך' };
  }

  const res = await swapPositionOrderWithNeighbor(courtId, positionId, 'up');
  if ('ok' in res && res.ok) {
    revalidatePath('/manager/settings');
  }
  return res;
}

export async function movePositionDown(
  positionId: string,
): Promise<{ ok: true } | { error: string }> {
  const session = await requireSession(SystemRole.MANAGER);
  const courtId = session.user.courtId;
  if (!courtId) {
    return { error: 'למנהל אין בית משפט משויך' };
  }

  const res = await swapPositionOrderWithNeighbor(courtId, positionId, 'down');
  if ('ok' in res && res.ok) {
    revalidatePath('/manager/settings');
  }
  return res;
}

export async function addShiftCapacity(params: {
  positionId: string;
  shiftType: ShiftType;
  dayCategory: DayCategory;
  amount: number;
}) {
  try {
    const position = await prisma.position.findUnique({
      where: {
        id: params.positionId,
      },
      select: {
        courtId: true,
        displayOrder: true,
      },
    });

    if (!position) {
      return { error: 'התפקיד לא נמצא' };
    }

    const capacity = await prisma.shiftCapacity.upsert({
      where: {
        courtId_positionId_shiftType_dayCategory: {
          courtId: position.courtId,
          positionId: params.positionId,
          shiftType: params.shiftType,
          dayCategory: params.dayCategory,
        },
      },
      update: {
        amount: params.amount,
        isActive: true,
      },
      create: {
        courtId: position.courtId,
        positionId: params.positionId,
        shiftType: params.shiftType,
        dayCategory: params.dayCategory,
        amount: params.amount,
        isActive: true,
        displayOrder: position.displayOrder,
      },
      select: {
        id: true,
      },
    });

    revalidatePath('/manager/settings');

    return {
      ok: true,
      id: capacity.id,
    };
  } catch (error) {
    console.error(error);
    return { error: 'שמירת התקן נכשלה' };
  }
}

export async function updateShiftCapacity(id: string, amount: number) {
  try {
    await prisma.shiftCapacity.update({
      where: {
        id,
      },
      data: {
        amount,
      },
    });

    revalidatePath('/manager/settings');

    return {
      ok: true,
      id,
    };
  } catch (error) {
    console.error(error);
    return { error: 'עדכון התקן נכשל' };
  }
}
