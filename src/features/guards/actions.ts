'use server';

import bcrypt from 'bcryptjs';
import { revalidatePath } from 'next/cache';
import { Position, SystemRole } from '@/generated/prisma/client';
import { prisma } from '@/lib/db/client';
import { requireSession } from '@/lib/db/auth-helpers';
import type { CreateGuardParams, UpdateGuardParams, DeleteGuardParams, GetGuardsResult } from '@/features/guards/types';

export async function createGuard(params: CreateGuardParams): Promise<{ ok: true } | { error: string }> {
  const session = await requireSession(SystemRole.MANAGER);
  const courtId = session.user.courtId;
  if (!courtId) return { error: 'למנהל אין בית משפט משויך' };

  const { firstName, lastName, phone, email, position } = params;

  const passwordHash = await bcrypt.hash('123456', 12);

  await prisma.$transaction(async (tx) => {
    const employee = await tx.employee.create({
      data: { firstName, lastName, phone, position, courtId, isActive: true },
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
}

export async function updateGuard(params: UpdateGuardParams): Promise<{ ok: true } | { error: string }> {
  const session = await requireSession(SystemRole.MANAGER);
  const courtId = session.user.courtId;

  const { employeeId, firstName, lastName, phone, position, isActive } = params;

  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, courtId: courtId ?? '' },
  });
  if (!employee) return { error: 'מאבטח לא נמצא' };

  await prisma.employee.update({
    where: { id: employeeId },
    data: { firstName, lastName, phone, position, isActive },
  });

  revalidatePath('/manager/guards');
  return { ok: true };
}

export async function deleteGuard(
  params: DeleteGuardParams,
): Promise<{ ok: true } | { needsConfirm: true; assignmentCount: number } | { error: string }> {
  const session = await requireSession(SystemRole.MANAGER);
  const courtId = session.user.courtId;

  const { employeeId, force } = params;

  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, courtId: courtId ?? '' },
  });
  if (!employee) return { error: 'מאבטח לא נמצא' };

  const assignmentCount = await prisma.shiftAssignment.count({ where: { employeeId } });

  if (assignmentCount > 0 && !force) {
    return { needsConfirm: true, assignmentCount };
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.deleteMany({ where: { employeeId } });
    await tx.employee.delete({ where: { id: employeeId } });
  });

  revalidatePath('/manager/guards');
  return { ok: true };
}
//get current manager's guards
export async function getGuards(): Promise<GetGuardsResult> {
  const session = await requireSession(SystemRole.MANAGER);

  const managerEmployee = await prisma.employee.findFirst({
    where: { user: { id: session.user.id } },
    select: { courtId: true },
  });
  const courtId = managerEmployee?.courtId ?? null;

  if (!courtId) return [];

  const guards = await prisma.employee.findMany({
    where: { courtId },
    include: { user: { select: { id: true } } },
  });
  console.log(guards);
  return guards.map((guard) => ({
    id: guard.id,
    firstName: guard.firstName,
    lastName: guard.lastName,
    phone: guard.phone,
    position: guard.position as Position,
    isActive: guard.isActive,
  }));
}
