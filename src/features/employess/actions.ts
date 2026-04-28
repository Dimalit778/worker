'use server';

import bcrypt from 'bcryptjs';
import { revalidatePath } from 'next/cache';
import { Position, SystemRole } from '@/generated/prisma/client';
import { prisma } from '@/lib/db/client';
import { requireSession } from '@/lib/db/auth-helpers';
import type {
  CreateEmployeeParams,
  UpdateEmployeeParams,
  EmployeeAndPosition,
  PositionOption,
} from '@/features/employess/types';
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

  if (!firstName || !lastName || !email || !positionId) {
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
          phone,
          positionId,
          courtId,
          isActive: true,
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

  const { employeeId, firstName, lastName, phone, positionId, isActive } = params;

  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, courtId: courtId ?? '' },
  });
  if (!employee) return { error: 'מאבטח לא נמצא' };

  await prisma.employee.update({
    where: { id: employeeId },
    data: { firstName, lastName, phone, positionId, isActive },
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
//get current manager's guards
export async function getEmployees(): Promise<EmployeeAndPosition[]> {
  const session = await requireSession(SystemRole.MANAGER);

  const managerEmployee = await prisma.employee.findFirst({
    where: { user: { id: session.user.id } },
    select: { courtId: true },
  });
  const courtId = managerEmployee?.courtId ?? null;

  if (!courtId) return [];

  const employees = await prisma.employee.findMany({
    where: { courtId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phone: true,
      user: { select: { id: true, email: true } },
      position: { select: { id: true, name: true, displayOrder: true } },
      isActive: true,
    },
  });
  return employees.map((employee) => {
    if (!employee.user) {
      throw new Error(`Employee ${employee.id} has no user`);
    }

    return {
      id: employee.id,
      firstName: employee.firstName,
      lastName: employee.lastName,
      phone: employee.phone,
      email: employee.user.email,
      isActive: employee.isActive,
      position: {
        id: employee.position.id,
        name: employee.position.name,
        displayOrder: employee.position.displayOrder,
      },
    };
  });
}

export async function getPositions(): Promise<PositionOption[]> {
  const session = await requireSession(SystemRole.MANAGER);

  const courtId = session.user.courtId;

  if (!courtId) {
    return [];
  }

  return prisma.position.findMany({
    where: {
      courtId,
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      displayOrder: true,
    },
    orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
  });
}
