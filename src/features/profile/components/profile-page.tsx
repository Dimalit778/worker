import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { UserRound } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { requireSession } from '@/lib/db/auth-helpers';
import { prisma } from '@/lib/db/client';

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 rounded-md border bg-background p-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-words text-sm font-medium">{children}</dd>
    </div>
  );
}

export async function ProfilePage() {
  const session = await requireSession();
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      firstName: true,
      lastName: true,
      displayName: true,
      email: true,
      phoneNumber: true,
      isReligious: true,
      isActive: true,
      role: { select: { name: true } },
      facility: { select: { name: true, district: { select: { name: true } } } },
    },
  });

  if (!user) notFound();

  return (
    <div className="mx-auto max-w-4xl space-y-6" dir="rtl">
      <Card>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex size-14 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <UserRound className="size-7" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <p className="break-words text-xl font-semibold">{user.firstName} {user.lastName}</p>
            </div>
            <Badge variant="secondary">{user.isActive ? 'חשבון פעיל' : 'חשבון מושבת'}</Badge>
          </div>
          <dl className="grid gap-3 sm:grid-cols-3">
            <Detail label="תפקיד">{user.role.name}</Detail>
            <Detail label="מתקן">{user.facility.name}</Detail>
            <Detail label="מחוז">{user.facility.district.name}</Detail>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><h2 className="text-base font-medium">פרטים אישיים</h2></CardHeader>
        <CardContent>
          <dl className="grid gap-3 sm:grid-cols-2">
            <Detail label="שם פרטי">{user.firstName}</Detail>
            <Detail label="שם משפחה">{user.lastName}</Detail>
            <Detail label="שם תצוגה">{user.displayName}</Detail>
            <Detail label="אימייל"><bdi dir="ltr">{user.email}</bdi></Detail>
            <Detail label="טלפון"><bdi dir="ltr">{user.phoneNumber?.trim() || 'לא הוזן'}</bdi></Detail>
            <Detail label="שומר שבת">{user.isReligious ? 'כן' : 'לא'}</Detail>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
