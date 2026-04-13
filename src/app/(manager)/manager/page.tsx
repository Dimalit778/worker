import { requireSession } from '@/lib/auth-helpers'
import { Role } from '@prisma/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default async function ManagerDashboardPage() {
  await requireSession(Role.MANAGER)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">לוח בקרה</h1>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">תקופות פעילות</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">—</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">הגשות</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">—</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">שומרים</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">—</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground text-sm">
            אין תקופות תזמון. לחץ &quot;תקופה חדשה&quot; להתחיל.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
