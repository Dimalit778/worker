import { requireSession } from '@/lib/auth-helpers'
import { SystemRole } from '@/generated/prisma/client'
import { CurrentPeriodPanel } from '@/components/scheduling/current-period-panel'
import { getCurrentSchedulingPeriod } from '@/lib/periods/current-scheduling-period'

export default async function UserShibutzPage() {
  await requireSession(SystemRole.EMPLOYEE)

  const row = await getCurrentSchedulingPeriod()
  const period = row
    ? {
        name: row.name,
        startDate: row.startDate,
        endDate: row.endDate,
        submissionDeadline: row.submissionDeadline,
        status: row.status,
      }
    : null

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold">{'\u05e9\u05d9\u05d1\u05d5\u05e5'}</h1>
      <CurrentPeriodPanel period={period} />
    </div>
  )
}
