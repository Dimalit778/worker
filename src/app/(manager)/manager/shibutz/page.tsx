import { requireSession } from '@/lib/auth-helpers'
import { SystemRole } from '@/generated/prisma/client'
import { getShibutzPageData } from '@/features/shibutz/queries'
import { ShibutzGrid } from '@/features/shibutz/components/shibutz-grid'

export default async function ManagerShibutzPage() {
  const session = await requireSession(SystemRole.MANAGER)
  const courtId = session.user.primaryCourtId ?? ''

  const data = await getShibutzPageData(courtId, { includeGuards: true })

  if (!data.found) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">שיבוץ</h1>
        <p className="text-sm text-muted-foreground">אין תקופת תזמון פעילה.</p>
      </div>
    )
  }

  return <ShibutzGrid {...data} />
}
