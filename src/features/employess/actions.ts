'use server';
import { periodScheduleStatus } from '@/features/schedules/period-status';
import { PortalRole } from '@/lib/auth/portal';

import { SystemRole } from '@/generated/prisma/client';
import { prisma } from '@/lib/db/client';
import { requireSession } from '@/lib/db/auth-helpers';
import type {
  CreateEmployeeParams,
  EmployeeDetailData,
  EmployeeSubmissionsData,
  EmployeesPageData,
  SetEmployeeActiveResult,
  UpdateEmployeeParams,
} from '@/features/employess/types';
import { availabilityPreferencesToRecord, countAvailableEntries } from '@/features/availability/utils';
import { toFutureAssignments } from './utils';
import { sendInvite, unusablePasswordHash, type InviteResult } from '@/lib/auth/invite';
import { expireEmployeeData } from '@/lib/cache/data-cache';

export type CreateEmployeeResult = ({ ok: true } & Partial<InviteResult>) | { error: string };

export async function deleteEmployee(employeeId: string): Promise<{ ok: true } | { error: string }> {
  const session = await requireSession(PortalRole.MANAGER);
  const facilityId = session.user.facilityId;
  if (!facilityId) return { error: 'למנהל אין בית משפט משויך' };
  const id = employeeId.trim();
  if (!id) return { error: 'עובד לא תקין' };
  if (id === session.user.id) return { error: 'לא ניתן למחוק את המשתמש שלך' };

  try {
    const deletedAt = new Date();
    const result = await prisma.user.updateMany({
      where: { id, facilityId, systemRole: SystemRole.USER, canEditSchedule: false, deletedAt: null },
      data: { deletedAt, isActive: false, deactivatedAt: deletedAt },
    });
    if (result.count === 0) return { error: 'עובד לא נמצא' };

    expireEmployeeData(facilityId);
    return { ok: true };
  } catch {
    return { error: 'מחיקת העובד נכשלה. נסה שוב.' };
  }
}

export async function createEmployee(params: CreateEmployeeParams): Promise<CreateEmployeeResult> {
  const session = await requireSession(PortalRole.MANAGER);

  const facilityId = session.user.facilityId;
  if (!facilityId) return { error: 'למנהל אין בית משפט משויך' };

  const firstName = params.firstName.trim();
  const lastName = params.lastName.trim();
  const phone = params.phone?.trim() || null;
  const email = params.email.trim().toLowerCase();
  const positionId = params.positionId;
  const displayName = params.displayName.trim();
  const isReligious = params.isReligious ?? false;
  if (!firstName || !lastName || !email || !positionId || !displayName) {
    return { error: 'שם פרטי, שם משפחה, אימייל ותפקיד הם שדות חובה' };
  }

  if (!email.includes('@')) {
    return { error: 'מייל לא תקין' };
  }

  const role = await prisma.role.findUnique({ where: { id: positionId } });
  if (!role) return { error: 'התפקיד אינו שייך למתקן' };
  const passwordHash = await unusablePasswordHash();

  try {
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
          roleId: role.id,
          facilityId,
          canEditSchedule: role.rank === 1,
          isReligious,
        },
        select: { id: true },
      });
      return created.id;
    });

    expireEmployeeData(facilityId);
    return { ok: true, ...(await sendInvite(userId, email)) };
  } catch (error) {
    if (error instanceof Error && error.message === 'USER_EMAIL_EXISTS') {
      return { error: 'כבר קיים משתמש עם האימייל הזה' };
    }

    console.error(error);
    return { error: 'יצירת עובד נכשלה' };
  }
}
export async function updateEmployee(params: UpdateEmployeeParams): Promise<{ ok: true } | { error: string }> {
  const session = await requireSession(PortalRole.MANAGER);
  const facilityId = session.user.facilityId;

  const { employeeId, firstName, lastName, phone, displayName, isReligious, positionId } = params;

  const employee = await prisma.user.findFirst({
    where: { id: employeeId, facilityId: facilityId ?? '', deletedAt: null },
  });
  if (!employee) return { error: 'מאבטח לא נמצא' };

  await prisma.user.update({
    where: { id: employeeId, facilityId: facilityId ?? '', deletedAt: null },
    data: { firstName, lastName, phoneNumber: phone, displayName, isReligious, roleId: positionId },
  });
  expireEmployeeData(employee.facilityId!);

  return { ok: true };
}

export async function resendEmployeeInvite(employeeId: string): Promise<CreateEmployeeResult> {
  const session = await requireSession();
  const isAdmin = session.user.systemRole === SystemRole.ADMIN;
  if (!isAdmin && session.user.portal !== PortalRole.MANAGER) return { error: 'אין הרשאה' };

  const employee = await prisma.user.findFirst({
    // Managers may only re-invite regular employees, never other managers or admins.
    where: {
      id: employeeId,
      deletedAt: null,
      ...(isAdmin ? {} : { facilityId: session.user.facilityId ?? '', systemRole: SystemRole.USER, canEditSchedule: false }),
    },
    select: { id: true, email: true },
  });
  if (!employee) return { error: 'עובד לא נמצא' };

  // The account may already be in use, so the link goes only to the employee's own email, never back to the caller.
  const { emailError } = await sendInvite(employee.id, employee.email);
  return emailError ? { ok: true, emailError } : { ok: true };
}

export async function setEmployeeActive(employeeId: string, isActive: boolean): Promise<SetEmployeeActiveResult> {
  const session = await requireSession(PortalRole.MANAGER);
  const facilityId = session.user.facilityId;
  if (!facilityId) return { error: 'למנהל אין בית משפט משויך' };

  const employee = await prisma.user.findFirst({
    where: { id: employeeId, facilityId, deletedAt: null },
    select: { id: true, isActive: true, systemRole: true },
  });
  if (!employee || employee.systemRole === SystemRole.ADMIN) return { error: 'עובד לא נמצא' };
  if (employee.id === session.user.id && !isActive) return { error: 'לא ניתן להשבית את המשתמש שלך' };

  await prisma.user.update({
    where: { id: employeeId, facilityId, deletedAt: null },
    data: { isActive, deactivatedAt: isActive ? null : new Date() },
  });
  expireEmployeeData(facilityId);

  if (isActive) return { ok: true, isActive, futureAssignments: [] };

  // Future assignments in the current draft/published versions are reported, never deleted.
  const slots = await prisma.scheduleSlot.findMany({
    where: {
      userId: employeeId,
      facilityId,
      startsAt: { gte: new Date() },
      version: { OR: [{ draftFor: { isNot: null } }, { publishedFor: { isNot: null } }] },
    },
    select: {
      id: true,
      date: true,
      startsAt: true,
      shiftType: true,
      position: { select: { name: true } },
      schedule: { select: { name: true } },
      version: { select: { status: true } },
    },
  });

  return { ok: true, isActive, futureAssignments: toFutureAssignments(slots) };
}

export async function getEmployeesPageData(facilityId?: string): Promise<EmployeesPageData> {
  const session = await requireSession();

  let targetCourtId: string;

  if (session.user.systemRole === SystemRole.ADMIN) {
    if (!facilityId) return { error: 'יש לבחור בית משפט' };

    const court = await prisma.facility.findUnique({
      where: { id: facilityId },
      select: { id: true },
    });
    if (!court) return { error: 'בית משפט לא נמצא' };

    targetCourtId = facilityId;
  } else if (session.user.portal === PortalRole.MANAGER) {
    if (!session.user.facilityId) return { error: 'למנהל אין בית משפט משויך' };
    if (facilityId && facilityId !== session.user.facilityId) return { error: 'אין הרשאה' };

    targetCourtId = session.user.facilityId;
  } else {
    return { error: 'אין הרשאה' };
  }

  const [employees, positions] = await Promise.all([
    prisma.user.findMany({
      where: { facilityId: targetCourtId, deletedAt: null },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phoneNumber: true,
        email: true,
        displayName: true,
        isReligious: true,
        isActive: true,
        role: {
          select: {
            id: true,
            name: true,
            rank: true,
          },
        },
      },
      orderBy: [{ role: { rank: 'asc' } }, { displayName: 'asc' }],
    }),

    prisma.role.findMany({
      select: {
        id: true,
        name: true,
        rank: true,
      },
      orderBy: [{ rank: 'asc' }],
    }),
  ]);

  return {
    employees: employees.map((employee) => ({
      id: employee.id,
      firstName: employee.firstName,
      lastName: employee.lastName,
      phone: employee.phoneNumber,
      email: employee.email,
      displayName: employee.displayName,
      isReligious: employee.isReligious,
      isActive: employee.isActive,
      position: employee.role,
    })),
    positions,
  };
}

export async function getManagerEmployeeDetail(employeeId: string): Promise<EmployeeDetailData> {
  const session = await requireSession(PortalRole.MANAGER);
  const facilityId = session.user.facilityId;
  if (!facilityId) return { error: 'למנהל אין בית משפט משויך' };

  const employee = await prisma.user.findFirst({
    where: { id: employeeId, facilityId, deletedAt: null },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      displayName: true,
      phoneNumber: true,
      isReligious: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      role: {
        select: {
          id: true,
          name: true,
          rank: true,
        },
      },
      facility: {
        select: {
          id: true,
          name: true,
          code: true,
          district: {
            select: {
              name: true,
            },
          },
        },
      },
      email: true,
    },
  });

  if (!employee || !employee.facility) return { error: 'עובד לא נמצא' };

  const [
    submittedCount,
    totalAvailabilityRecords,
    selectedSlots,
    assignments,
    recentAssignments,
  ] = await Promise.all([
    prisma.availabilitySubmission.count({ where: { userId: employeeId, submittedAt: { not: null } } }),
    prisma.availabilitySubmission.count({ where: { userId: employeeId } }),
    prisma.shiftAvailability.count({
      where: {
        submission: { userId: employeeId },
      },
    }),
    prisma.scheduleSlot.count({ where: { userId: employeeId, facilityId, version: { publishedFor: { is: { status: 'PUBLISHED' } } } } }),
    prisma.scheduleSlot.findMany({
      where: { userId: employeeId, facilityId, version: { publishedFor: { is: { status: 'PUBLISHED' } } } },
      orderBy: { date: 'desc' },
      take: 8,
      select: {
        id: true,
        date: true,
        shiftType: true,
        position: { select: { name: true } },
        schedule: { select: { name: true } },
      },
    }),
  ]);

  return {
    employee: {
      id: employee.id,
      firstName: employee.firstName,
      lastName: employee.lastName,
      displayName: employee.displayName,
      phone: employee.phoneNumber,
      email: employee.email,
      isActive: employee.isActive,
      isReligious: employee.isReligious,
      createdAt: employee.createdAt.toISOString(),
      updatedAt: employee.updatedAt.toISOString(),
      position: { ...employee.role, isActive: true },
      court: {
        id: employee.facility.id,
        name: employee.facility.name,
        code: employee.facility.code,
        regionName: employee.facility.district.name,
      },
      user: {
        id: employee.id,
        email: employee.email,
        mustChangePassword: false,
        createdAt: employee.createdAt.toISOString(),
        updatedAt: employee.updatedAt.toISOString(),
      },
    },
    stats: {
      submissions: submittedCount,
      totalAvailabilityRecords,
      selectedSlots,
      assignments,
      manualAssignments: 0,
      warnings: 0,
      fairnessRecords: 0,
    },
    recentAssignments: recentAssignments.map((assignment) => ({
      id: assignment.id,
      date: assignment.date.toISOString().slice(0, 10),
      shiftType: assignment.shiftType,
      isManualOverride: false,
      positionName: assignment.position.name,
      periodName: assignment.schedule.name,
    })),
    fairnessRecords: [],
  };
}

export async function getManagerEmployeeSubmissions(employeeId: string): Promise<EmployeeSubmissionsData> {
  const session = await requireSession(PortalRole.MANAGER);
  const facilityId = session.user.facilityId;
  if (!facilityId) return { error: 'למנהל אין בית משפט משויך' };

  const employee = await prisma.user.findFirst({
    where: { id: employeeId, facilityId, deletedAt: null },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      displayName: true,
      isActive: true,
      role: {
        select: {
          name: true,
        },
      },
    },
  });

  if (!employee) return { error: 'עובד לא נמצא' };

  const periods = await prisma.schedule.findMany({
    where: { facilityId },
    orderBy: { startDate: 'desc' },
    select: {
      id: true,
      name: true,
      status: true,
      startDate: true,
      endDate: true,
      submissionOpensAt: true,
      submissionClosesAt: true,
      submissions: {
        where: { userId: employeeId },
        take: 1,
        select: {
          id: true,
          submittedAt: true,
          availabilities: true,
        },
      },
    },
  });

  return {
    employee: {
      id: employee.id,
      displayName: employee.displayName,
      firstName: employee.firstName,
      lastName: employee.lastName,
      positionName: employee.role.name,
      isActive: employee.isActive,
    },
    periods: periods.map((period) => {
      const availability = period.submissions[0] ?? null;
      const shifts = availability?.availabilities ?? [];
      const entries = availabilityPreferencesToRecord(
        shifts.map((shift) => ({
          date: shift.date,
          shiftType: shift.shiftType,
          isAvailable: shift.preference !== 'UNAVAILABLE',
          preference: shift.preference,
        })),
      );

      return {
        id: period.id,
        name: period.name,
        startDate: period.startDate.toISOString().slice(0, 10),
        endDate: period.endDate.toISOString().slice(0, 10),
        submissionDeadline: period.submissionClosesAt.toISOString(),
        status: periodScheduleStatus(period),
        availabilityId: availability?.id ?? null,
        isSubmitted: availability?.submittedAt != null,
        submittedAt: availability?.submittedAt?.toISOString() ?? null,
        entries,
        selectedSlotCount: countAvailableEntries(entries),
      };
    }),
  };
}
