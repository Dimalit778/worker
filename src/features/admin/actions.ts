'use server';

import bcrypt from 'bcryptjs';
import { revalidatePath } from 'next/cache';

import { Prisma, SystemRole } from '@/generated/prisma/client';
import { prisma } from '@/lib/db/client';
import { requireSession } from '@/lib/db/auth-helpers';
import { getInitialPasswordFromEmail } from '@/features/employess/utils';
import type {
  AdminActionResult,
  AdminCourtsData,
  CreateAdminCourtParams,
  CreateAdminEmployeeParams,
  UpdateAdminCourtParams,
  UpdateAdminEmployeeParams,
} from '@/features/admin/types';

const DEFAULT_POSITIONS = [
  { code: 1, name: 'קצין מתקן', displayOrder: 1, color: '#2563eb' },
  { code: 2, name: 'אחמ״ש', displayOrder: 2, color: '#16a34a' },
  { code: 3, name: 'בקר', displayOrder: 3, color: '#64748b' },
  { code: 4, name: 'מאבטח', displayOrder: 4, color: '#dc2626' },
];

function normalizeText(value: string) {
  return value.trim();
}

function normalizeCourtCode(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, '_');
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function uniqueErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    return 'קיים כבר רשומה עם אותו קוד או אימייל';
  }

  console.error(error);
  return fallback;
}

async function assertAdmin() {
  await requireSession(SystemRole.ADMIN);
}

export async function getAdminCourtsData(): Promise<AdminCourtsData> {
  await assertAdmin();

  const regions = await prisma.region.findMany({
    select: {
      id: true,
      name: true,
      code: true,
      courts: {
        select: {
          id: true,
          name: true,
          code: true,
          regionId: true,
          positions: {
            select: {
              id: true,
              name: true,
              code: true,
              isActive: true,
            },
            orderBy: [{ code: 'asc' }, { name: 'asc' }],
          },
          employees: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              displayName: true,
              phone: true,
              isActive: true,
              isReligious: true,
              position: {
                select: {
                  id: true,
                  name: true,
                  code: true,
                },
              },
              user: {
                select: {
                  email: true,
                  systemRole: true,
                },
              },
            },
            orderBy: [{ position: { code: 'asc' } }, { displayName: 'asc' }],
          },
        },
        orderBy: [{ name: 'asc' }],
      },
    },
    orderBy: [{ name: 'asc' }],
  });

  return {
    regions: regions.map((region) => ({
      ...region,
      courts: region.courts.map((court) => ({
        ...court,
        employeeCount: court.employees.length,
        employees: court.employees.map((employee) => ({
          id: employee.id,
          firstName: employee.firstName,
          lastName: employee.lastName,
          displayName: employee.displayName,
          phone: employee.phone,
          email: employee.user?.email ?? '',
          isActive: employee.isActive,
          isReligious: employee.isReligious,
          systemRole: employee.user?.systemRole ?? null,
          position: employee.position,
        })),
      })),
    })),
  };
}

export async function createAdminCourt(params: CreateAdminCourtParams): Promise<AdminActionResult> {
  await assertAdmin();

  const name = normalizeText(params.name);
  const code = normalizeCourtCode(params.code);
  const regionId = normalizeText(params.regionId);

  if (!name || !code || !regionId) {
    return { error: 'שם בית משפט, קוד ומחוז הם שדות חובה' };
  }

  try {
    const region = await prisma.region.findUnique({ where: { id: regionId }, select: { id: true } });
    if (!region) {
      return { error: 'מחוז לא נמצא' };
    }

    await prisma.$transaction(async (tx) => {
      const court = await tx.court.create({
        data: {
          name,
          code,
          regionId,
        },
      });

      await tx.position.createMany({
        data: DEFAULT_POSITIONS.map((position) => ({
          ...position,
          courtId: court.id,
          isActive: true,
        })),
      });
    });

    revalidatePath('/admin/courts');
    return { ok: true };
  } catch (error) {
    return { error: uniqueErrorMessage(error, 'יצירת בית המשפט נכשלה') };
  }
}

export async function updateAdminCourt(params: UpdateAdminCourtParams): Promise<AdminActionResult> {
  await assertAdmin();

  const courtId = normalizeText(params.courtId);
  const name = normalizeText(params.name);
  const code = normalizeCourtCode(params.code);
  const regionId = normalizeText(params.regionId);

  if (!courtId || !name || !code || !regionId) {
    return { error: 'שם בית משפט, קוד ומחוז הם שדות חובה' };
  }

  try {
    const [court, region] = await Promise.all([
      prisma.court.findUnique({ where: { id: courtId }, select: { id: true } }),
      prisma.region.findUnique({ where: { id: regionId }, select: { id: true } }),
    ]);

    if (!court) {
      return { error: 'בית המשפט לא נמצא' };
    }
    if (!region) {
      return { error: 'מחוז לא נמצא' };
    }

    await prisma.court.update({
      where: { id: courtId },
      data: { name, code, regionId },
    });

    revalidatePath('/admin/courts');
    return { ok: true };
  } catch (error) {
    return { error: uniqueErrorMessage(error, 'עדכון בית המשפט נכשל') };
  }
}

export async function deleteAdminCourt(courtId: string): Promise<AdminActionResult> {
  await assertAdmin();

  const id = normalizeText(courtId);
  if (!id) {
    return { error: 'בית משפט לא תקין' };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const court = await tx.court.findUnique({
        where: { id },
        select: {
          id: true,
          employees: {
            select: {
              id: true,
              user: {
                select: { id: true },
              },
            },
          },
        },
      });

      if (!court) {
        throw new Error('COURT_NOT_FOUND');
      }

      const employeeIds = court.employees.map((employee) => employee.id);
      const userIds = court.employees.flatMap((employee) => (employee.user ? [employee.user.id] : []));

      if (userIds.length > 0) {
        const externalScheduleRefs = await tx.workSchedule.count({
          where: {
            createdById: { in: userIds },
            courtId: { not: id },
          },
        });

        if (externalScheduleRefs > 0) {
          throw new Error('COURT_USERS_HAVE_EXTERNAL_SCHEDULES');
        }
      }

      await tx.workSchedule.deleteMany({ where: { courtId: id } });

      if (userIds.length > 0) {
        await tx.user.deleteMany({ where: { id: { in: userIds } } });
      }

      if (employeeIds.length > 0) {
        await tx.employee.deleteMany({ where: { id: { in: employeeIds } } });
      }

      await tx.court.delete({ where: { id } });
    });

    revalidatePath('/admin/courts');
    return { ok: true };
  } catch (error) {
    if (error instanceof Error && error.message === 'COURT_NOT_FOUND') {
      return { error: 'בית המשפט לא נמצא' };
    }
    if (error instanceof Error && error.message === 'COURT_USERS_HAVE_EXTERNAL_SCHEDULES') {
      return { error: 'לא ניתן למחוק בית משפט שעובדיו יצרו שיבוצים בבתי משפט אחרים' };
    }

    return { error: uniqueErrorMessage(error, 'מחיקת בית המשפט נכשלה') };
  }
}

export async function createAdminEmployee(params: CreateAdminEmployeeParams): Promise<AdminActionResult> {
  await assertAdmin();

  const courtId = normalizeText(params.courtId);
  const firstName = normalizeText(params.firstName);
  const lastName = normalizeText(params.lastName);
  const displayName = normalizeText(params.displayName);
  const email = normalizeEmail(params.email);
  const positionId = normalizeText(params.positionId);
  const phone = params.phone?.trim() || null;

  if (!courtId || !firstName || !lastName || !displayName || !email || !positionId) {
    return { error: 'שם, שם תצוגה, אימייל ותפקיד הם שדות חובה' };
  }

  if (!email.includes('@')) {
    return { error: 'אימייל לא תקין' };
  }

  try {
    const position = await prisma.position.findFirst({
      where: {
        id: positionId,
        courtId,
      },
      select: { id: true },
    });

    if (!position) {
      return { error: 'התפקיד לא שייך לבית המשפט שנבחר' };
    }

    const passwordHash = await bcrypt.hash(getInitialPasswordFromEmail(email), 12);

    await prisma.$transaction(async (tx) => {
      const existingUser = await tx.user.findUnique({
        where: { email },
        select: { id: true },
      });

      if (existingUser) {
        throw new Error('USER_EMAIL_EXISTS');
      }

      const employee = await tx.employee.create({
        data: {
          firstName,
          lastName,
          displayName,
          phone,
          positionId,
          courtId,
          isActive: params.isActive,
          isReligious: params.isReligious,
        },
      });

      await tx.user.create({
        data: {
          email,
          passwordHash,
          systemRole: SystemRole.EMPLOYEE,
          mustChangePassword: true,
          employeeId: employee.id,
        },
      });
    });

    revalidatePath('/admin/courts');
    revalidatePath('/admin/employees');
    return { ok: true };
  } catch (error) {
    if (error instanceof Error && error.message === 'USER_EMAIL_EXISTS') {
      return { error: 'כבר קיים משתמש עם האימייל הזה' };
    }

    return { error: uniqueErrorMessage(error, 'יצירת העובד נכשלה') };
  }
}

export async function updateAdminEmployee(params: UpdateAdminEmployeeParams): Promise<AdminActionResult> {
  await assertAdmin();

  const employeeId = normalizeText(params.employeeId);
  const firstName = normalizeText(params.firstName);
  const lastName = normalizeText(params.lastName);
  const displayName = normalizeText(params.displayName);
  const email = normalizeEmail(params.email);
  const positionId = normalizeText(params.positionId);
  const phone = params.phone?.trim() || null;

  if (!employeeId || !firstName || !lastName || !displayName || !email || !positionId) {
    return { error: 'שם, שם תצוגה, אימייל ותפקיד הם שדות חובה' };
  }

  if (!email.includes('@')) {
    return { error: 'אימייל לא תקין' };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const employee = await tx.employee.findUnique({
        where: { id: employeeId },
        select: {
          id: true,
          courtId: true,
          user: {
            select: { id: true, email: true },
          },
        },
      });

      if (!employee) {
        throw new Error('EMPLOYEE_NOT_FOUND');
      }

      const position = await tx.position.findFirst({
        where: {
          id: positionId,
          courtId: employee.courtId,
        },
        select: { id: true },
      });

      if (!position) {
        throw new Error('POSITION_NOT_IN_COURT');
      }

      await tx.employee.update({
        where: { id: employeeId },
        data: {
          firstName,
          lastName,
          displayName,
          phone,
          positionId,
          isActive: params.isActive,
          isReligious: params.isReligious,
        },
      });

      if (employee.user) {
        await tx.user.update({
          where: { id: employee.user.id },
          data: { email },
        });
      } else {
        const passwordHash = await bcrypt.hash(getInitialPasswordFromEmail(email), 12);
        await tx.user.create({
          data: {
            email,
            passwordHash,
            systemRole: SystemRole.EMPLOYEE,
            mustChangePassword: true,
            employeeId,
          },
        });
      }
    });

    revalidatePath('/admin/courts');
    revalidatePath('/admin/employees');
    return { ok: true };
  } catch (error) {
    if (error instanceof Error && error.message === 'EMPLOYEE_NOT_FOUND') {
      return { error: 'עובד לא נמצא' };
    }
    if (error instanceof Error && error.message === 'POSITION_NOT_IN_COURT') {
      return { error: 'התפקיד לא שייך לבית המשפט של העובד' };
    }

    return { error: uniqueErrorMessage(error, 'עדכון העובד נכשל') };
  }
}

export async function deleteAdminEmployee(employeeId: string): Promise<AdminActionResult> {
  await assertAdmin();

  const id = normalizeText(employeeId);
  if (!id) {
    return { error: 'עובד לא תקין' };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const employee = await tx.employee.findUnique({
        where: { id },
        select: {
          id: true,
          user: {
            select: { id: true },
          },
        },
      });

      if (!employee) {
        throw new Error('EMPLOYEE_NOT_FOUND');
      }

      if (employee.user) {
        const blockingRefs = await Promise.all([
          tx.workSchedule.count({ where: { createdById: employee.user.id } }),
          tx.workScheduleVersion.count({ where: { createdById: employee.user.id } }),
          tx.scheduleChangeLog.count({ where: { changedById: employee.user.id } }),
        ]);

        if (blockingRefs.some((count) => count > 0)) {
          throw new Error('EMPLOYEE_HAS_HISTORY');
        }

        await tx.user.delete({ where: { id: employee.user.id } });
      }

      await tx.employee.delete({ where: { id } });
    });

    revalidatePath('/admin/courts');
    revalidatePath('/admin/employees');
    return { ok: true };
  } catch (error) {
    if (error instanceof Error && error.message === 'EMPLOYEE_NOT_FOUND') {
      return { error: 'עובד לא נמצא' };
    }
    if (error instanceof Error && error.message === 'EMPLOYEE_HAS_HISTORY') {
      return { error: 'לא ניתן למחוק עובד שיצר שיבוצים או שינויי שיבוץ היסטוריים' };
    }

    return { error: uniqueErrorMessage(error, 'מחיקת העובד נכשלה') };
  }
}
