import { requireSession } from '@/lib/auth-helpers'
import { SystemRole } from '@/generated/prisma/client'
import { Card, CardContent } from '@/components/ui/card'

export default async function AdminManagersPage() {
  await requireSession(SystemRole.ADMIN)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">מנהלים</h1>
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground text-sm">ניהול מנהלי בתי משפט — בקרוב.</p>
        </CardContent>
      </Card>
    </div>
  )
}
