'use server';

import bcrypt from 'bcryptjs';
import { revalidatePath } from 'next/cache';
import { SystemRole } from '@/generated/prisma/client';
import { prisma } from '@/lib/db/client';
import { requireSession } from '@/lib/db/auth-helpers';
import type {
  CreateEmployeeParams,
  EmployeeDetailData,
  EmployeeSubmissionsData,
  EmployeesPageData,
  UpdateEmployeeParams,
} from '@/features/employess/types';
import { availabilityEntriesToRecord } from '@/features/availability/utils';
import { getInitialPasswordFromEmail } from './utils';

export async function createEmployee(params: CreateEmployeeParams): Promise<{ ok: true } | { error: string }> {
  const session = await requireSession(SystemRole.MANAGER);

  const courtId = session.user.courtId;
  if (!courtId) return { error: 'למנהל אין בית משפט משויך' };

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

  const initialPassword = getInitialPasswordFromEmail(email);
  const passwordHash = await bcrypt.hash(initialPassword, 12);

  try {
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
          isActive: true,
          isReligious,
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

    revalidatePath('/manager/guards');
    return { ok: true };
  } catch (error) {
    if (error instanceof Error && error.message === 'USER_EMAIL_EXISTS') {
      return { error: 'כבר קיים משתמש עם האימייל הזה' };
    }

    console.error(error);
    return { error: 'יצירת עובד נכשלה' };
  }
}
export async function updateEmployee(params: UpdateEmployeeParams): Promise<{ ok: true } | { error: string }> {
  const session = await requireSession(SystemRole.MANAGER);
  const courtId = session.user.courtId;

  const { employeeId, firstName, lastName, phone, displayName, isReligious, positionId, isActive } = params;

  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, courtId: courtId ?? '' },
  });
  if (!employee) return { error: 'מאבטח לא נמצא' };

  await prisma.employee.update({
    where: { id: employeeId },
    data: { firstName, lastName, phone, displayName, isReligious, positionId, isActive },
  });

  revalidatePath('/manager/guards');
  return { ok: true };
}

export async function deleteEmployee(employeeId: string): Promise<{ ok: true } | { error: string }> {
  const session = await requireSession(SystemRole.MANAGER);
  const courtId = session.user.courtId;

  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, courtId: courtId ?? '' },
  });
  if (!employee) return { error: 'עובד לא נמצא' };

  await prisma.$transaction(async (tx) => {
    await tx.user.deleteMany({ where: { employeeId } });
    await tx.employee.delete({ where: { id: employeeId } });
  });

  revalidatePath('/manager/employees');
  return { ok: true };
}

export async function getEmployeesPageData(): Promise<EmployeesPageData> {
  const session = await requireSession(SystemRole.MANAGER);

  const courtId = session.user.courtId;
  if (!courtId) return { error: 'למנהל אין בית משפט משויך' };

  const [employees, positions] = await Promise.all([
    prisma.employee.findMany({
      where: { courtId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        displayName: true,
        isReligious: true,
        isActive: true,
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
          },
        },
      },
      orderBy: [{ position: { code: 'asc' } }, { displayName: 'asc' }],
    }),

    prisma.position.findMany({
      where: {
        courtId,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        code: true,
      },
      orderBy: [{ code: 'asc' }, { createdAt: 'asc' }],
    }),
  ]);

  return {
    employees: employees.map((employee) => ({
      id: employee.id,
      firstName: employee.firstName,
      lastName: employee.lastName,
      phone: employee.phone,
      email: employee.user?.email ?? '',
      displayName: employee.displayName,
      isReligious: employee.isReligious,
      isActive: employee.isActive,
      position: {
        id: employee.position.id,
        name: employee.position.name,
        code: employee.position.code,
      },
    })),
    positions,
  };
}

export async function getManagerEmployeeDetail(employeeId: string): Promise<EmployeeDetailData> {
  const session = await requireSession(SystemRole.MANAGER);
  const courtId = session.user.courtId;
  if (!courtId) return { error: 'למנהל אין בית משפט משויך' };

  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, courtId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      displayName: true,
      phone: true,
      isActive: true,
      isReligious: true,
      createdAt: true,
      updatedAt: true,
      position: {
        select: {
          id: true,
          name: true,
          code: true,
          isActive: true,
        },
      },
      court: {
        select: {
          id: true,
          name: true,
          code: true,
          region: {
            select: {
              name: true,
            },
          },
        },
      },
      user: {
        select: {
          id: true,
          email: true,
          mustChangePassword: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
  });

  if (!employee) return { error: 'עובד לא נמצא' };

  const [
    submittedCount,
    totalAvailabilityRecords,
    selectedSlots,
    assignments,
    manualAssignments,
    warnings,
    fairnessRecordCount,
    recentAssignments,
    fairnessRecords,
  ] = await Promise.all([
    prisma.availabilitySubmission.count({ where: { employeeId, isSubmitted: true } }),
    prisma.availabilitySubmission.count({ where: { employeeId } }),
    prisma.availabilitySlot.count({
      where: {
        isAvailable: true,
        submission: { employeeId },
      },
    }),
    prisma.shiftAssignment.count({ where: { employeeId, courtId } }),
    prisma.shiftAssignment.count({ where: { employeeId, courtId, isManualOverride: true } }),
    prisma.scheduleWarning.count({ where: { employeeId, courtId } }),
    prisma.fairnessRecord.count({ where: { employeeId } }),
    prisma.shiftAssignment.findMany({
      where: { employeeId, courtId },
      orderBy: { date: 'desc' },
      take: 8,
      select: {
        id: true,
        date: true,
        shiftType: true,
        isManualOverride: true,
        position: {
          select: {
            name: true,
          },
        },
        schedule: {
          select: {
            name: true,
          },
        },
      },
    }),
    prisma.fairnessRecord.findMany({
      where: { employeeId },
      orderBy: { schedule: { startDate: 'desc' } },
      take: 6,
      select: {
        id: true,
        totalShifts: true,
        morningShifts: true,
        eveningShifts: true,
        nightShifts: true,
        weekendShifts: true,
        schedule: {
          select: {
            name: true,
          },
        },
      },
    }),
  ]);

  return {
    employee: {
      id: employee.id,
      firstName: employee.firstName,
      lastName: employee.lastName,
      displayName: employee.displayName,
      phone: employee.phone,
      email: employee.user?.email ?? '',
      isActive: employee.isActive,
      isReligious: employee.isReligious,
      createdAt: employee.createdAt.toISOString(),
      updatedAt: employee.updatedAt.toISOString(),
      position: employee.position,
      court: {
        id: employee.court.id,
        name: employee.court.name,
        code: employee.court.code,
        regionName: employee.court.region.name,
      },
      user: employee.user
        ? {
            id: employee.user.id,
            email: employee.user.email,
            mustChangePassword: employee.user.mustChangePassword,
            createdAt: employee.user.createdAt.toISOString(),
            updatedAt: employee.user.updatedAt.toISOString(),
          }
        : null,
    },
    stats: {
      submissions: submittedCount,
      totalAvailabilityRecords,
      selectedSlots,
      assignments,
      manualAssignments,
      warnings,
      fairnessRecords: fairnessRecordCount,
    },
    recentAssignments: recentAssignments.map((assignment) => ({
      id: assignment.id,
      date: assignment.date.toISOString().slice(0, 10),
      shiftType: assignment.shiftType,
      isManualOverride: assignment.isManualOverride,
      positionName: assignment.position.name,
      periodName: assignment.schedule.name,
    })),
    fairnessRecords: fairnessRecords.map((record) => ({
      id: record.id,
      periodName: record.schedule.name,
      totalShifts: record.totalShifts,
      morningShifts: record.morningShifts,
      eveningShifts: record.eveningShifts,
      nightShifts: record.nightShifts,
      weekendShifts: record.weekendShifts,
    })),
  };
}

export async function getManagerEmployeeSubmissions(employeeId: string): Promise<EmployeeSubmissionsData> {
  const session = await requireSession(SystemRole.MANAGER);
  const courtId = session.user.courtId;
  if (!courtId) return { error: 'למנהל אין בית משפט משויך' };

  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, courtId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      displayName: true,
      isActive: true,
      position: {
        select: {
          name: true,
        },
      },
    },
  });

  if (!employee) return { error: 'עובד לא נמצא' };

  const periods = await prisma.schedule.findMany({
    where: { courtId },
    orderBy: { startDate: 'desc' },
    select: {
      id: true,
      name: true,
      startDate: true,
      endDate: true,
      submissionDeadline: true,
      status: true,
      availabilitySubmissions: {
        where: { employeeId },
        take: 1,
        select: {
          id: true,
          isSubmitted: true,
          submittedAt: true,
          slots: true,
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
      positionName: employee.position.name,
      isActive: employee.isActive,
    },
    periods: periods.map((period) => {
      const availability = period.availabilitySubmissions[0] ?? null;
      const slots = availability?.slots ?? [];
      const entries = availabilityEntriesToRecord(slots);

      return {
        id: period.id,
        name: period.name,
        startDate: period.startDate.toISOString().slice(0, 10),
        endDate: period.endDate.toISOString().slice(0, 10),
        submissionDeadline: period.submissionDeadline.toISOString(),
        status: period.status,
        availabilityId: availability?.id ?? null,
        isSubmitted: availability?.isSubmitted ?? false,
        submittedAt: availability?.submittedAt?.toISOString() ?? null,
        entries,
        selectedSlotCount: Object.values(entries).filter(Boolean).length,
      };
    }),
  };
}
