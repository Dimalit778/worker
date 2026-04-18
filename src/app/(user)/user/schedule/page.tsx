import { requireSession } from '@/lib/auth-helpers'
import { SystemRole } from '@/generated/prisma/client'
import { Card, CardContent } from '@/components/ui/card'

export default async function UserSchedulePage() {
  await requireSession(SystemRole.EMPLOYEE)

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold">לוח משמרות</h1>
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground text-sm text-center">לוח המשמרות שלך — בקרוב.</p>
        </CardContent>
      </Card>
    </div>
  )
}
