'use server';
import { PortalRole } from '@/lib/auth/portal';

import { revalidatePath } from 'next/cache';

import { Prisma, SystemRole } from '@/generated/prisma/client';
import { prisma } from '@/lib/db/client';
import { requireSession } from '@/lib/db/auth-helpers';
import { sendInvite, unusablePasswordHash } from '@/lib/auth/invite';
import { DEFAULT_SHIFT_TIMES } from '@/features/schedules/shift-times';
import { expireAllFacilityData, readAdminCache } from '@/lib/cache/data-cache';
import type {
  AdminActionResult,
  AdminCourtsData,
  CreateAdminCourtParams,
  CreateAdminEmployeeParams,
  UpdateAdminCourtParams,
  UpdateAdminEmployeeParams,
} from '@/features/admin/types';

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
  return readAdminCache(loadAdminCourtsData);
}

async function loadAdminCourtsData(): Promise<AdminCourtsData> {
  const globalRoles = await prisma.role.findMany({
    select: { id: true, name: true, rank: true },
    orderBy: { rank: 'asc' },
  });

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
          users: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              displayName: true,
              phoneNumber: true,
              isReligious: true,
              email: true,
              systemRole: true,
              role: {
                select: {
                  id: true,
                  name: true,
                  rank: true,
                },
              },
            },
            orderBy: [{ role: { rank: 'asc' } }, { displayName: 'asc' }],
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
        positions: globalRoles.map((role) => ({ ...role, isActive: true })),
        employeeCount: court.users.length,
        employees: court.users.map((employee) => ({
          id: employee.id,
          firstName: employee.firstName,
          lastName: employee.lastName,
          displayName: employee.displayName,
          phone: employee.phoneNumber,
          email: employee.email,
          isActive: true,
          isReligious: employee.isReligious,
          systemRole: employee.systemRole,
          position: employee.role,
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

    await prisma.facility.create({
      data: {
        name,
        code,
        districtId,
        shifts: {
          create: DEFAULT_SHIFT_TIMES.map((shift) => ({
            ...shift,
            endDayOffset: shift.shiftType === 'NIGHT' ? 1 : 0,
          })),
        },
      },
    });

    expireAllFacilityData();
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

    expireAllFacilityData();
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
          users: {
            select: { id: true },
          },
        },
      });

      if (!court) {
        throw new Error('COURT_NOT_FOUND');
      }

      const history = await tx.scheduleVersion.count({ where: { facilityId: id, status: { not: 'DRAFT' } } });
      if (history) throw new Error('COURT_HAS_HISTORY');
      const userIds = court.users.map((employee) => employee.id);

      await tx.scheduleSlot.deleteMany({ where: { facilityId: id } });
      await tx.shiftAvailability.deleteMany({ where: { submission: { facilityId: id } } });
      await tx.availabilitySubmission.deleteMany({ where: { facilityId: id } });
      await tx.scheduleChange.deleteMany({ where: { facilityId: id } });
      await tx.schedule.updateMany({ where: { facilityId: id }, data: { draftVersionId: null, publishedVersionId: null } });
      await tx.scheduleVersion.deleteMany({ where: { facilityId: id } });
      await tx.schedule.deleteMany({ where: { facilityId: id } });
      await tx.staffingDateOverride.deleteMany({ where: { facilityId: id } });
      await tx.staffingRequirement.deleteMany({ where: { facilityId: id } });
      await tx.facilityShift.deleteMany({ where: { facilityId: id } });
      await tx.position.deleteMany({ where: { facilityId: id } });

      if (userIds.length > 0) {
        await tx.user.deleteMany({ where: { id: { in: userIds } } });
      }

      await tx.facility.delete({ where: { id } });
    });

    expireAllFacilityData();
    revalidatePath('/admin/courts');
    return { ok: true };
  } catch (error) {
    if (error instanceof Error && error.message === 'COURT_HAS_HISTORY') {
      return { error: 'לא ניתן למחוק מתקן שיש לו סידורים מפורסמים או היסטוריים' };
    }
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
  const phone = params.phone?.trim() || null;

  if (!facilityId || !firstName || !lastName || !displayName || !email || !positionId) {
    return { error: 'שם, שם תצוגה, אימייל ותפקיד הם שדות חובה' };
  }

  if (!email.includes('@')) {
    return { error: 'אימייל לא תקין' };
  }

  try {
    const position = await prisma.role.findUnique({
      where: { id: positionId },
      select: { id: true, rank: true },
    });

    if (!position) {
      return { error: 'התפקיד לא שייך לבית המשפט שנבחר' };
    }

    const passwordHash = await unusablePasswordHash();

    const userId = await prisma.$transaction(async (tx) => {
      const existingUser = await tx.user.findUnique({
        where: { email },
        select: { id: true },
      });

      if (existingUser) {
        throw new Error('USER_EMAIL_EXISTS');
      }

      const created = await tx.user.create({
        data: {
          email,
          passwordHash,
          systemRole: SystemRole.USER,
          firstName,
          lastName,
          displayName,
          phoneNumber: phone,
          roleId: position.id,
          facilityId,
          canEditSchedule: position.rank === 1,
          isReligious: params.isReligious,
        },
        select: { id: true },
      });
      return created.id;
    });

    expireAllFacilityData();
    revalidatePath('/admin/courts');
    revalidatePath('/admin/employees');
    return { ok: true, ...(await sendInvite(userId, email)) };
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
      const employee = await tx.user.findUnique({
        where: { id: employeeId },
        select: { id: true, facilityId: true },
      });

      if (!employee || !employee.facilityId) {
        throw new Error('EMPLOYEE_NOT_FOUND');
      }

      const position = await tx.role.findUnique({
        where: { id: positionId },
        select: { id: true, rank: true },
      });

      if (!position) {
        throw new Error('POSITION_NOT_IN_COURT');
      }

      await tx.user.update({
        where: { id: employeeId },
        data: {
          email,
          firstName,
          lastName,
          displayName,
          phoneNumber: phone,
          roleId: position.id,
          canEditSchedule: position.rank === 1,
          isReligious: params.isReligious,
        },
      });
    });

    expireAllFacilityData();
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
      const employee = await tx.user.findUnique({
        where: { id },
        select: { id: true },
      });

      if (!employee) {
        throw new Error('EMPLOYEE_NOT_FOUND');
      }

      const changes = await tx.scheduleChange.count({ where: { changedById: id } });
      const publishedAssignments = await tx.scheduleSlot.count({ where: { userId: id, version: { status: { not: 'DRAFT' } } } });
      const createdOverrides = await tx.staffingDateOverride.count({ where: { createdById: id } });
      if (changes > 0 || publishedAssignments > 0 || createdOverrides > 0) throw new Error('EMPLOYEE_HAS_HISTORY');
      await tx.scheduleSlot.updateMany({ where: { userId: id }, data: { userId: null } });
      await tx.availabilitySubmission.deleteMany({ where: { userId: id } });
      await tx.user.delete({ where: { id } });
    });

    expireAllFacilityData();
    revalidatePath('/admin/courts');
    revalidatePath('/admin/employees');
    return { ok: true };
  } catch (error) {
    if (error instanceof Error && error.message === 'EMPLOYEE_NOT_FOUND') {
      return { error: 'עובד לא נמצא' };
    }
    if (error instanceof Error && error.message === 'EMPLOYEE_HAS_HISTORY') {
      return { error: 'לא ניתן למחוק עובד שיש לו שיבוצים מפורסמים או היסטוריית שינויי שיבוץ' };
    }

    return { error: uniqueErrorMessage(error, 'מחיקת העובד נכשלה') };
  }
}
