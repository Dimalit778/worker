import { requireSession } from '@/lib/auth-helpers'
import { SystemRole } from '@/generated/prisma/client'
import { Card, CardContent } from '@/components/ui/card'

export default async function ManagerGuardsPage() {
  await requireSession(SystemRole.MANAGER)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">מאבטחים</h1>
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground text-sm">מאבטחי בית המשפט שלך — בקרוב.</p>
        </CardContent>
      </Card>
    </div>
  )
}
