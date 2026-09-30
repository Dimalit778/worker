import { PortalRole } from '@/lib/auth/portal';
import { requireSession } from '@/lib/db/auth-helpers';
import { prisma } from '@/lib/db/client';
import { syncSubmissionWindows } from '@/features/periods/process-windows';
import { LogoutButton } from '@/components/ui/logout-button';
import { UserNav } from './user-nav';

export default async function UserLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession(PortalRole.EMPLOYEE);
  await syncSubmissionWindows(session.user.facilityId);

  const [primaryCourt, hasOpenPeriod] = await Promise.all([
    session.user.facilityId ? prisma.facility.findUnique({ where: { id: session.user.facilityId } }) : null,
    (async () => {
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: {
          employeeId: true,
          employee: { select: { primaryShiftRole: { select: { code: true } } } },
        },
      });
      if (!user?.employeeId) return false;
      if (user.employee?.primaryShiftRole.code === 1) return false;

      const openPeriod = await prisma.roster.findFirst({
        where: { archivedAt: null, facilityId: session.user.facilityId ?? '', period: { submissionState: 'OPEN' } },
        select: { periodId: true },
      });
      if (!openPeriod) return false;

      const submitted = await prisma.availabilitySubmission.findUnique({
        where: { periodId_employeeId: { periodId: openPeriod.periodId, employeeId: user.employeeId } },
        select: { isSubmitted: true },
      });
      return !submitted?.isSubmitted;
    })(),
  ]);

  const navItems = [
    { href: '/employee', label: 'שיבוץ', notify: false },
    { href: '/employee/availability', label: 'הגש שיבוץ', notify: false },
    { href: '/employee/submissions', label: 'ההגשות שלי', notify: hasOpenPeriod },
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
