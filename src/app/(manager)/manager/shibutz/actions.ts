'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db/client'
import { requireSession } from '@/lib/auth-helpers'
import { Role, ShiftType } from '@/generated/prisma/client'
import { parseISODateToUtcMidnight } from '@/lib/periods/current-scheduling-period'

type AssignGuardParams = {
  scheduleId: string | null
  periodId: string
  userId: string
  courtId: string
  /** ISO date YYYY-MM-DD */
  date: string
  shiftType: ShiftType
  isOpeningDuty: boolean
}

export async function assignGuard(params: AssignGuardParams): Promise<{ scheduleId: string }> {
  const session = await requireSession(Role.MANAGER)

  const { scheduleId: incomingScheduleId, periodId, userId, courtId, date, shiftType, isOpeningDuty } = params

  let scheduleId = incomingScheduleId

  if (!scheduleId) {
    // Create a new DRAFT schedule for this period
    const schedule = await prisma.schedule.create({
      data: { periodId, generatedById: session.user.id },
    })
    scheduleId = schedule.id
  }

  await prisma.shiftAssignment.create({
    data: {
      scheduleId,
      userId,
      courtId,
      date: parseISODateToUtcMidnight(date),
      shiftType,
      isOpeningDuty,
      isManualOverride: true,
    },
  })

  revalidatePath('/manager/shibutz')
  return { scheduleId }
}

export async function reassignGuard(assignmentId: string, newUserId: string): Promise<void> {
  await requireSession(Role.MANAGER)

  await prisma.shiftAssignment.update({
    where: { id: assignmentId },
    data: { userId: newUserId },
  })

  revalidatePath('/manager/shibutz')
}

export async function removeAssignment(assignmentId: string): Promise<void> {
  await requireSession(Role.MANAGER)

  await prisma.shiftAssignment.delete({ where: { id: assignmentId } })

  revalidatePath('/manager/shibutz')
}
