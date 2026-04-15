// src/app/(manager)/manager/shibutz/page.tsx
import { requireSession } from '@/lib/auth-helpers'
import { Role } from '@/generated/prisma/client'
import { prisma } from '@/lib/db/client'
import { getCurrentSchedulingPeriod } from '@/lib/periods/current-scheduling-period'
import { ShibutzGrid } from '@/components/shibutz/shibutz-grid'
import type { AssignmentMap, CapacityMap } from '@/components/shibutz/types'

const DEFAULT_CAPACITY: CapacityMap = { MORNING: 15, EVENING: 6, NIGHT: 3 }

export default async function ManagerShibutzPage() {
  const session = await requireSession(Role.MANAGER)
  const courtId = session.user.primaryCourtId ?? ''

  // 1. Current period
  const periodRow = await getCurrentSchedulingPeriod()
  if (!periodRow) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">שיבוץ</h1>
        <p className="text-sm text-muted-foreground">אין תקופת תזמון פעילה.</p>
      </div>
    )
  }

  // 2. Latest schedule for this period
  const scheduleRow = await prisma.schedule.findFirst({
    where: { periodId: periodRow.id },
    orderBy: { generatedAt: 'desc' },
  })

  // 3. Assignments for that schedule
  const rawAssignments = scheduleRow
    ? await prisma.shiftAssignment.findMany({
        where: { scheduleId: scheduleRow.id },
        include: { user: { select: { name: true } } },
        orderBy: { createdAt: 'asc' },
      })
    : []

  // 4. Build AssignmentMap
  const assignments: AssignmentMap = {}
  for (const a of rawAssignments) {
    const iso = a.date.toISOString().slice(0, 10)
    const key = `${iso}-${a.shiftType}`
    if (!assignments[key]) assignments[key] = []
    assignments[key].push({
      id: a.id,
      userId: a.userId,
      userName: a.user.name,
      isOpeningDuty: a.isOpeningDuty,
    })
  }

  // 5. Active guards
  const guards = await prisma.user.findMany({
    where: { role: 'GUARD', isActive: true },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  })

  // 6. Capacity rules (per shift type for manager's court, fallback to defaults)
  const capacityRules = courtId
    ? await prisma.shiftCapacityRule.findMany({ where: { courtId } })
    : []

  const capacity: CapacityMap = { ...DEFAULT_CAPACITY }
  for (const rule of capacityRules) {
    if (rule.dayOfWeek === null) {
      capacity[rule.shiftType] = rule.maxStaff
    }
  }

  // Serialise Date → ISO string for client component
  const startDate = periodRow.startDate.toISOString().slice(0, 10)

  return (
    <ShibutzGrid
      periodId={periodRow.id}
      periodName={periodRow.name}
      startDate={startDate}
      endDate={periodRow.endDate.toISOString().slice(0, 10)}
      scheduleId={scheduleRow?.id ?? null}
      assignments={assignments}
      guards={guards}
      capacity={capacity}
      courtId={courtId}
    />
  )
}
