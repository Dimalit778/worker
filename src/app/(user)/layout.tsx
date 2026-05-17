import { requireSession } from '@/lib/db/auth-helpers';
import { PeriodStatus, SystemRole } from '@/generated/prisma/client';
import { prisma } from '@/lib/db/client';
import { LogoutButton } from '@/components/ui/logout-button';
import { UserNav } from './user-nav';

export default async function UserLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession(SystemRole.EMPLOYEE);

  const [primaryCourt, hasOpenPeriod] = await Promise.all([
    session.user.courtId ? prisma.court.findUnique({ where: { id: session.user.courtId } }) : null,
    (async () => {
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { employeeId: true },
      });
      if (!user?.employeeId) return false;

      const openPeriod = await prisma.schedulePeriod.findFirst({
        where: { status: PeriodStatus.OPEN_FOR_SUBMISSION },
        select: { id: true },
      });
      if (!openPeriod) return false;

      const submitted = await prisma.availabilitySubmission.findUnique({
        where: { periodId_employeeId: { periodId: openPeriod.id, employeeId: user.employeeId } },
        select: { isSubmitted: true },
      });
      return !submitted?.isSubmitted;
    })(),
  ]);

  const navItems = [
    { href: '/user', label: 'שיבוץ', notify: false },
    { href: '/user/availability', label: 'הגש שיבוץ', notify: false },
    { href: '/user/submissions', label: 'ההגשות שלי', notify: hasOpenPeriod },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="sticky top-0 z-50 border-b bg-card px-4 py-3">
        <div className="flex items-center justify-between ">
          <div className="text-sm text-muted-foreground">{primaryCourt?.name ?? '—'}</div>
          <UserNav items={navItems} />
          <LogoutButton />
        </div>
      </header>
      <main className="flex-1  px-4 py-4">{children}</main>
    </div>
  );
}
