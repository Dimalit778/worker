'use server';
import { periodScheduleStatus } from '@/features/schedules/period-status';
import { PortalRole } from '@/lib/auth/portal';

import bcrypt from 'bcryptjs';
import { SystemRole, Capability } from '@/generated/prisma/client';
import { prisma } from '@/lib/db/client';
import { requireSession } from '@/lib/db/auth-helpers';
import type {
  CreateEmployeeParams,
  EmployeeDetailData,
  EmployeeSubmissionsData,
  EmployeesPageData,
  UpdateEmployeeParams,
} from '@/features/employess/types';
import { availabilityPreferencesToRecord, countAvailableEntries } from '@/features/availability/utils';
import { getInitialPasswordFromEmail } from './utils';

export async function createEmployee(params: CreateEmployeeParams): Promise<{ ok: true } | { error: string }> {
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

  if (!params.capability || !Object.values(Capability).includes(params.capability)) return { error: 'יש לבחור כשירות' };
  const position = await prisma.shiftRole.findFirst({ where: { id: positionId, facilityId, isActive: true } });
  if (!position) return { error: 'התפקיד אינו שייך למתקן' };
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
          primaryShiftRoleId: positionId,
          capability: params.capability,
          facilityId,
          isActive: true,
          isReligious,
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
  const session = await requireSession(PortalRole.MANAGER);
  const facilityId = session.user.facilityId;

  const { employeeId, firstName, lastName, phone, displayName, isReligious, positionId, isActive } = params;

  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, facilityId: facilityId ?? '' },
  });
  if (!employee) return { error: 'מאבטח לא נמצא' };

  if (!params.capability || !Object.values(Capability).includes(params.capability)) return { error: 'יש לבחור כשירות' };
  await prisma.employee.update({
    where: { id: employeeId },
    data: { firstName, lastName, phone, displayName, isReligious, primaryShiftRoleId: positionId, isActive, capability: params.capability },
  });

  return { ok: true };
}

export async function deleteEmployee(employeeId: string): Promise<{ ok: true } | { error: string }> {
  const session = await requireSession(PortalRole.MANAGER);
  const facilityId = session.user.facilityId;

  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, facilityId: facilityId ?? '' },
  });
  if (!employee) return { error: 'עובד לא נמצא' };

  await prisma.$transaction(async (tx) => {
    await tx.employee.update({ where: { id: employeeId }, data: { isActive: false } });
  });

  return { ok: true };
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
    prisma.employee.findMany({
      where: { facilityId: targetCourtId },
      select: {
        id: true,
        capability: true,
      firstName: true,
        lastName: true,
        phone: true,
        displayName: true,
        isReligious: true,
        isActive: true,
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
          },
        },
      },
      orderBy: [{ primaryShiftRole: { code: 'asc' } }, { displayName: 'asc' }],
    }),

    prisma.shiftRole.findMany({
      where: {
        facilityId: targetCourtId,
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
      capability: employee.capability,
      firstName: employee.firstName,
      lastName: employee.lastName,
      phone: employee.phone,
      email: employee.user?.email ?? '',
      displayName: employee.displayName,
      isReligious: employee.isReligious,
      isActive: employee.isActive,
      position: {
        id: employee.primaryShiftRole.id,
        name: employee.primaryShiftRole.name,
        code: employee.primaryShiftRole.code,
      },
    })),
    positions,
  };
}

export async function getManagerEmployeeDetail(employeeId: string): Promise<EmployeeDetailData> {
  const session = await requireSession(PortalRole.MANAGER);
  const facilityId = session.user.facilityId;
  if (!facilityId) return { error: 'למנהל אין בית משפט משויך' };

  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, facilityId },
    select: {
      id: true,
      capability: true,
      firstName: true,
      lastName: true,
      displayName: true,
      phone: true,
      isActive: true,
      isReligious: true,
      createdAt: true,
      updatedAt: true,
      primaryShiftRole: {
        select: {
          id: true,
          name: true,
          code: true,
          isActive: true,
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
    prisma.shiftAvailability.count({
      where: {
        submission: { employeeId },
      },
    }),
    prisma.shiftAssignment.count({ where: { employeeId, facilityId, version: { status: 'PUBLISHED', isActive: true } } }),
    Promise.resolve(0),
    prisma.scheduleWarning.count({ where: { employeeId, facilityId, version: { status: 'PUBLISHED', isActive: true } } }),
    prisma.employeeScheduleStats.count({ where: { employeeId, version: { status: 'PUBLISHED', isActive: true } } }),
    prisma.shiftAssignment.findMany({
      where: { employeeId, facilityId, version: { status: 'PUBLISHED', isActive: true } },
      orderBy: { date: 'desc' },
      take: 8,
      select: {
        id: true,
        date: true,
        shiftType: true,
        shiftRole: {
          select: {
            name: true,
          },
        },
        schedule: {
          select: {
            period: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    }),
    prisma.employeeScheduleStats.findMany({
      where: { employeeId, version: { status: 'PUBLISHED', isActive: true } },
      orderBy: { schedule: { period: { startDate: 'desc' } } },
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
            period: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    }),
  ]);

  return {
    employee: {
      id: employee.id,
      capability: employee.capability,
      firstName: employee.firstName,
      lastName: employee.lastName,
      displayName: employee.displayName,
      phone: employee.phone,
      email: employee.user?.email ?? '',
      isActive: employee.isActive,
      isReligious: employee.isReligious,
      createdAt: employee.createdAt.toISOString(),
      updatedAt: employee.updatedAt.toISOString(),
      position: employee.primaryShiftRole,
      court: {
        id: employee.facility.id,
        name: employee.facility.name,
        code: employee.facility.code,
        regionName: employee.facility.district.name,
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
      isManualOverride: false,
      positionName: assignment.shiftRole.name,
      periodName: assignment.schedule.period.name,
    })),
    fairnessRecords: fairnessRecords.map((record) => ({
      id: record.id,
      periodName: record.schedule.period.name,
      totalShifts: record.totalShifts,
      morningShifts: record.morningShifts,
      eveningShifts: record.eveningShifts,
      nightShifts: record.nightShifts,
      weekendShifts: record.weekendShifts,
    })),
  };
}

export async function getManagerEmployeeSubmissions(employeeId: string): Promise<EmployeeSubmissionsData> {
  const session = await requireSession(PortalRole.MANAGER);
  const facilityId = session.user.facilityId;
  if (!facilityId) return { error: 'למנהל אין בית משפט משויך' };

  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, facilityId },
    select: {
      id: true,
      capability: true,
      firstName: true,
      lastName: true,
      displayName: true,
      isActive: true,
      primaryShiftRole: {
        select: {
          name: true,
        },
      },
    },
  });

  if (!employee) return { error: 'עובד לא נמצא' };

  const periods = await prisma.roster.findMany({
    where: { facilityId },
    orderBy: { period: { startDate: 'desc' } },
    select: {
      id: true,
      archivedAt: true,
      versions: { select: { status: true, isActive: true } },
      period: {
        select: {
          name: true,
          submissionState: true,
          startDate: true,
          endDate: true,
          submissionDeadline: true,
          availabilitySubmissions: {
            where: { employeeId },
            take: 1,
            select: {
              id: true,
              isSubmitted: true,
              submittedAt: true,
              shiftAvailabilities: true,
            },
          },
        },
      },
    },
  });

  return {
    employee: {
      id: employee.id,
      displayName: employee.displayName,
      capability: employee.capability,
      firstName: employee.firstName,
      lastName: employee.lastName,
      positionName: employee.primaryShiftRole.name,
      isActive: employee.isActive,
    },
    periods: periods.map((period) => {
      const availability = period.period.availabilitySubmissions[0] ?? null;
      const shifts = availability?.shiftAvailabilities ?? [];
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
        name: period.period.name,
        startDate: period.period.startDate.toISOString().slice(0, 10),
        endDate: period.period.endDate.toISOString().slice(0, 10),
        submissionDeadline: period.period.submissionDeadline.toISOString(),
        status: periodScheduleStatus({
          archivedAt: period.archivedAt,
          submissionState: period.period.submissionState,
          versions: period.versions,
        }),
        availabilityId: availability?.id ?? null,
        isSubmitted: availability?.isSubmitted ?? false,
        submittedAt: availability?.submittedAt?.toISOString() ?? null,
        entries,
        selectedSlotCount: countAvailableEntries(entries),
      };
    }),
  };
}
