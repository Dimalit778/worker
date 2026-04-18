import { requireSession } from '@/lib/auth-helpers'
import { SystemRole } from '@/generated/prisma/client'
import { Card, CardContent } from '@/components/ui/card'

export default async function ManagerPeriodsPage() {
  await requireSession(SystemRole.MANAGER)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">תקופות</h1>
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground text-sm">ניהול תקופות תזמון — בקרוב.</p>
        </CardContent>
      </Card>
    </div>
  )
}
