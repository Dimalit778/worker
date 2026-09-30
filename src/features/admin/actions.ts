'use server';
import { PortalRole } from '@/lib/auth/portal';
import { Capability } from '@/generated/prisma/client';

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
  { code: 1, name: 'קצין מתקן', requiredCapability: Capability.SHIFT_MANAGER, displayOrder: 1, color: '#2563eb' },
  { code: 2, name: 'אחמ״ש', requiredCapability: Capability.SHIFT_MANAGER, displayOrder: 2, color: '#16a34a' },
  { code: 3, name: 'בקר', requiredCapability: Capability.CONTROLLER, displayOrder: 3, color: '#64748b' },
  { code: 4, name: 'מאבטח', requiredCapability: Capability.GUARD, displayOrder: 4, color: '#dc2626' },
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
  await requireSession(PortalRole.ADMIN);
}

export async function getAdminCourtsData(): Promise<AdminCourtsData> {
  await assertAdmin();

  const regions = await prisma.district.findMany({
    select: {
      id: true,
      name: true,
      code: true,
      facilities: {
        select: {
          id: true,
          name: true,
          code: true,
          districtId: true,
          shiftRoles: {
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
              capability: true,
              firstName: true,
              lastName: true,
              displayName: true,
              phone: true,
              isActive: true,
              isReligious: true,
              primaryShiftRole: {
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
            orderBy: [{ primaryShiftRole: { code: 'asc' } }, { displayName: 'asc' }],
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
      courts: region.facilities.map((court) => ({
        ...court,
        positions: court.shiftRoles,
        employeeCount: court.employees.length,
        employees: court.employees.map((employee) => ({
          id: employee.id,
          capability: employee.capability,
          firstName: employee.firstName,
          lastName: employee.lastName,
          displayName: employee.displayName,
          phone: employee.phone,
          email: employee.user?.email ?? '',
          isActive: employee.isActive,
          isReligious: employee.isReligious,
          systemRole: employee.user?.systemRole ?? null,
          position: employee.primaryShiftRole,
        })),
      })),
    })),
  };
}

export async function createAdminCourt(params: CreateAdminCourtParams): Promise<AdminActionResult> {
  await assertAdmin();

  const name = normalizeText(params.name);
  const code = normalizeCourtCode(params.code);
  const districtId = normalizeText(params.districtId);

  if (!name || !code || !districtId) {
    return { error: 'שם בית משפט, קוד ומחוז הם שדות חובה' };
  }

  try {
    const region = await prisma.district.findUnique({ where: { id: districtId }, select: { id: true } });
    if (!region) {
      return { error: 'מחוז לא נמצא' };
    }

    await prisma.$transaction(async (tx) => {
      const court = await tx.facility.create({
        data: {
          name,
          code,
          districtId,
        },
      });

      await tx.shiftRole.createMany({
        data: DEFAULT_POSITIONS.map((position) => ({
          ...position,
          facilityId: court.id,
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

  const facilityId = normalizeText(params.facilityId);
  const name = normalizeText(params.name);
  const code = normalizeCourtCode(params.code);
  const districtId = normalizeText(params.districtId);

  if (!facilityId || !name || !code || !districtId) {
    return { error: 'שם בית משפט, קוד ומחוז הם שדות חובה' };
  }

  try {
    const [court, region] = await Promise.all([
      prisma.facility.findUnique({ where: { id: facilityId }, select: { id: true } }),
      prisma.district.findUnique({ where: { id: districtId }, select: { id: true } }),
    ]);

    if (!court) {
      return { error: 'בית המשפט לא נמצא' };
    }
    if (!region) {
      return { error: 'מחוז לא נמצא' };
    }

    await prisma.facility.update({
      where: { id: facilityId },
      data: { name, code, districtId },
    });

    revalidatePath('/admin/courts');
    return { ok: true };
  } catch (error) {
    return { error: uniqueErrorMessage(error, 'עדכון בית המשפט נכשל') };
  }
}

export async function deleteAdminCourt(facilityId: string): Promise<AdminActionResult> {
  await assertAdmin();

  const id = normalizeText(facilityId);
  if (!id) {
    return { error: 'בית משפט לא תקין' };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const court = await tx.facility.findUnique({
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
        const externalScheduleRefs = await tx.roster.count({
          where: {
            createdById: { in: userIds },
            facilityId: { not: id },
          },
        });

        if (externalScheduleRefs > 0) {
          throw new Error('COURT_USERS_HAVE_EXTERNAL_SCHEDULES');
        }
      }

      await tx.roster.deleteMany({ where: { facilityId: id } });

      if (userIds.length > 0) {
        await tx.user.deleteMany({ where: { id: { in: userIds } } });
      }

      if (employeeIds.length > 0) {
        await tx.employee.deleteMany({ where: { id: { in: employeeIds } } });
      }

      await tx.facility.delete({ where: { id } });
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

  const facilityId = normalizeText(params.facilityId);
  const firstName = normalizeText(params.firstName);
  const lastName = normalizeText(params.lastName);
  const displayName = normalizeText(params.displayName);
  const email = normalizeEmail(params.email);
  const positionId = normalizeText(params.positionId);
  if (!params.capability || !Object.values(Capability).includes(params.capability)) return { error: 'יש לבחור כשירות' };
  const phone = params.phone?.trim() || null;

  if (!facilityId || !firstName || !lastName || !displayName || !email || !positionId) {
    return { error: 'שם, שם תצוגה, אימייל ותפקיד הם שדות חובה' };
  }

  if (!email.includes('@')) {
    return { error: 'אימייל לא תקין' };
  }

  try {
    const position = await prisma.shiftRole.findFirst({
      where: {
        id: positionId,
        facilityId,
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
          capability: params.capability,
          primaryShiftRoleId: positionId,
          facilityId,
          isActive: params.isActive,
          isReligious: params.isReligious,
        },
      });

      await tx.user.create({
        data: {
          email,
          passwordHash,
          systemRole: SystemRole.USER,
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
  if (!params.capability || !Object.values(Capability).includes(params.capability)) return { error: 'יש לבחור כשירות' };
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
          facilityId: true,
          user: {
            select: { id: true, email: true },
          },
        },
      });

      if (!employee) {
        throw new Error('EMPLOYEE_NOT_FOUND');
      }

      const position = await tx.shiftRole.findFirst({
        where: {
          id: positionId,
          facilityId: employee.facilityId,
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
          capability: params.capability,
          primaryShiftRoleId: positionId,
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
            systemRole: SystemRole.USER,
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

      await tx.employee.update({ where: { id }, data: { isActive: false } });
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
