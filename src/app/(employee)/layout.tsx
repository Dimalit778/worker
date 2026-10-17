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
      const now = new Date();
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: {
          facilityId: true,
          role: { select: { rank: true } },
        },
      });
      if (!user?.facilityId) return false;
      if (user.role.rank === 1) return false;

      const openSchedule = await prisma.schedule.findFirst({
        where: {
          facilityId: user.facilityId,
          status: 'DRAFT',
          submissionOpensAt: { lte: now },
          submissionClosesAt: { gt: now },
        },
        select: { id: true },
      });
      if (!openSchedule) return false;

      const submitted = await prisma.availabilitySubmission.findUnique({
        where: { scheduleId_userId: { scheduleId: openSchedule.id, userId: session.user.id } },
        select: { submittedAt: true },
      });
      return submitted?.submittedAt == null;
    })(),
  ]);

  const navItems = [
    { href: '/employee', label: 'שיבוץ', notify: false },
    { href: '/employee/availability', label: 'הגשת זמינות', notify: false },
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
