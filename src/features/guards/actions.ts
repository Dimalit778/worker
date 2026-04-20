'use server';

import bcrypt from 'bcryptjs';
import { revalidatePath } from 'next/cache';
import { Employee, Position, SystemRole, User } from '@/generated/prisma/client';
import { prisma } from '@/lib/db/client';
import { requireSession } from '@/lib/auth-helpers';
import type { CreateGuardParams, UpdateGuardParams, DeleteGuardParams, GetGuardsResult } from '@/features/guards/types';

export async function createGuard(params: CreateGuardParams): Promise<{ ok: true } | { error: string }> {
  const session = await requireSession(SystemRole.MANAGER);
  const courtId = session.user.primaryCourtId;
  if (!courtId) return { error: 'למנהל אין בית משפט משויך' };

  const { name, position } = params;

  const passwordHash = await bcrypt.hash('123456', 12);

  await prisma.$transaction(async (tx) => {
    const employee = await tx.employee.create({
      data: { name, position, primaryCourtId: courtId, isActive: true },
    });
    await tx.user.create({
      data: {
        passwordHash,
        systemRole: SystemRole.EMPLOYEE,
        mustChangePassword: true,
        isActive: true,
        employeeId: employee.id,
      },
    });
    await tx.courtEligibility.create({
      data: { employeeId: employee.id, courtId },
    });
  });

  revalidatePath('/manager/guards');
  return { ok: true };
}

export async function updateGuard(params: UpdateGuardParams): Promise<{ ok: true } | { error: string }> {
  const session = await requireSession(SystemRole.MANAGER);
  const courtId = session.user.primaryCourtId;

  const { employeeId, name, position, isActive } = params;

  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, primaryCourtId: courtId ?? '' },
  });
  if (!employee) return { error: 'מאבטח לא נמצא' };

  await prisma.employee.update({
    where: { id: employeeId },
    data: { name, position, isActive },
  });

  revalidatePath('/manager/guards');
  return { ok: true };
}

export async function deleteGuard(
  params: DeleteGuardParams,
): Promise<{ ok: true } | { needsConfirm: true; assignmentCount: number } | { error: string }> {
  const session = await requireSession(SystemRole.MANAGER);
  const courtId = session.user.primaryCourtId;

  const { employeeId, force } = params;

  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, primaryCourtId: courtId ?? '' },
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
    select: { primaryCourtId: true },
  });
  const courtId = managerEmployee?.primaryCourtId ?? null;

  if (!courtId) return [];

  const guards = await prisma.employee.findMany({
    where: { primaryCourtId: courtId },
    include: { user: { select: { id: true } } },
  });
  console.log(guards);
  return guards.map((guard) => ({
    id: guard.id,
    name: guard.name,
    position: guard.position as Position,
    isActive: guard.isActive,
  }));
}
