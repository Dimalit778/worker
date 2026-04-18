'use server'

import bcrypt from 'bcryptjs'
import { revalidatePath } from 'next/cache'
import { Position, SystemRole } from '@/generated/prisma/client'
import { prisma } from '@/lib/db/client'
import { requireSession } from '@/lib/auth-helpers'

type CreateGuardParams = {
  name: string
  position: Position
}

type UpdateGuardParams = {
  employeeId: string
  name: string
  position: Position
  isActive: boolean
}

type DeleteGuardParams = {
  employeeId: string
  force?: boolean
}

async function generateNextEmployeeNumber(): Promise<string> {
  const users = await prisma.user.findMany({
    where: { employeeNumber: { not: null } },
    select: { employeeNumber: true },
  })
  const max = users.reduce((acc, u) => {
    const n = parseInt(u.employeeNumber!, 10)
    return isNaN(n) ? acc : Math.max(acc, n)
  }, 1000)
  return String(max + 1)
}

export async function createGuard(
  params: CreateGuardParams,
): Promise<{ ok: true; employeeNumber: string } | { error: string }> {
  const session = await requireSession(SystemRole.MANAGER)
  const courtId = session.user.primaryCourtId
  if (!courtId) return { error: 'למנהל אין בית משפט משויך' }

  const { name, position } = params

  const employeeNumber = await generateNextEmployeeNumber()
  const passwordHash = await bcrypt.hash(employeeNumber, 12)

  await prisma.$transaction(async (tx) => {
    const employee = await tx.employee.create({
      data: { name, position, primaryCourtId: courtId, isActive: true },
    })
    await tx.user.create({
      data: {
        employeeNumber,
        passwordHash,
        systemRole: SystemRole.EMPLOYEE,
        mustChangePassword: true,
        isActive: true,
        employeeId: employee.id,
      },
    })
    await tx.courtEligibility.create({
      data: { employeeId: employee.id, courtId },
    })
  })

  revalidatePath('/manager/guards')
  return { ok: true, employeeNumber }
}

export async function updateGuard(
  params: UpdateGuardParams,
): Promise<{ ok: true } | { error: string }> {
  const session = await requireSession(SystemRole.MANAGER)
  const courtId = session.user.primaryCourtId

  const { employeeId, name, position, isActive } = params

  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, primaryCourtId: courtId ?? '' },
  })
  if (!employee) return { error: 'מאבטח לא נמצא' }

  await prisma.employee.update({
    where: { id: employeeId },
    data: { name, position, isActive },
  })

  revalidatePath('/manager/guards')
  return { ok: true }
}

export async function deleteGuard(params: DeleteGuardParams): Promise<
  { ok: true } | { needsConfirm: true; assignmentCount: number } | { error: string }
> {
  const session = await requireSession(SystemRole.MANAGER)
  const courtId = session.user.primaryCourtId

  const { employeeId, force } = params

  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, primaryCourtId: courtId ?? '' },
  })
  if (!employee) return { error: 'מאבטח לא נמצא' }

  const assignmentCount = await prisma.shiftAssignment.count({ where: { employeeId } })

  if (assignmentCount > 0 && !force) {
    return { needsConfirm: true, assignmentCount }
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.deleteMany({ where: { employeeId } })
    await tx.employee.delete({ where: { id: employeeId } })
  })

  revalidatePath('/manager/guards')
  return { ok: true }
}
