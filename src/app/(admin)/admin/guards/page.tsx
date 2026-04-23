import { requireSession } from '@/lib/db/auth-helpers';
import { SystemRole } from '@/generated/prisma/client';
import { Card, CardContent } from '@/components/ui/card';

export default async function AdminGuardsPage() {
  await requireSession(SystemRole.ADMIN);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">מאבטחים</h1>
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground text-sm">ניהול מאבטחים — בקרוב.</p>
        </CardContent>
      </Card>
    </div>
  );
}
