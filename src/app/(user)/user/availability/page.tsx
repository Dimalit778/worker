import { requireSession } from '@/lib/auth-helpers'
import { SystemRole } from '@/generated/prisma/client'
import { Card, CardContent } from '@/components/ui/card'

export default async function UserAvailabilityPage() {
  await requireSession(SystemRole.EMPLOYEE)

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold">זמינות</h1>
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground text-sm text-center">עדכון זמינות — בקרוב.</p>
        </CardContent>
      </Card>
    </div>
  )
}
