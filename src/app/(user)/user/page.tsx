import { requireSession } from '@/lib/auth-helpers'
import { Role } from '@/generated/prisma/client'
import { Card, CardContent } from '@/components/ui/card'

export default async function UserDashboardPage() {
  const session = await requireSession(Role.GUARD)

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold">שלום, {session.user.name}</h1>

      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground text-sm text-center">
            אין תקופת תזמון פעילה כרגע.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
