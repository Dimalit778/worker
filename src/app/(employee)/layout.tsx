import { after } from 'next/server';
import { PortalRole } from '@/lib/auth/portal';
import { requireSession } from '@/lib/db/auth-helpers';
import { prisma } from '@/lib/db/client';
import { syncSubmissionWindows } from '@/features/periods/process-windows';
import { AppShell, type AppNavItem } from '@/components/navigation/app-shell';
import { countIncomingTransfers } from '@/features/requests/queries';
import { ProfileNavigation } from '@/features/profile/components/profile-navigation';

export default async function UserLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession(PortalRole.EMPLOYEE);
  // Send due open/reminder emails after the response so the page does not wait for them.
  after(() => syncSubmissionWindows(session.user.facilityId));

  const [primaryCourt, availabilityStatus, incomingTransfers] = await Promise.all([
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
      if (!user?.facilityId) return null;
      if (user.role.rank === 1) return null;

      const openSchedule = await prisma.schedule.findFirst({
        where: {
          facilityId: user.facilityId,
          status: 'DRAFT',
          submissionOpensAt: { lte: now },
          submissionClosesAt: { gt: now },
        },
        select: { id: true },
      });
      if (!openSchedule) return null;

      const submitted = await prisma.availabilitySubmission.findUnique({
        where: { scheduleId_userId: { scheduleId: openSchedule.id, userId: session.user.id } },
        select: { submittedAt: true },
      });
      return submitted?.submittedAt == null ? ('pending' as const) : ('submitted' as const);
    })(),
    session.user.facilityId ? countIncomingTransfers(session.user.facilityId, session.user.id) : 0,
  ]);

  const navItems: AppNavItem[] = [
    { href: '/employee/home', label: 'בית' },
    { href: '/employee', label: 'שיבוץ' },
    { href: '/employee/schedules', label: 'כל השיבוצים' },
    { href: '/employee/profile', label: 'הפרופיל שלי' },
  ];

  if (availabilityStatus) {
    navItems.splice(2, 0, { href: '/employee/availability', label: 'הגשת שיבוץ', status: availabilityStatus });
  }

  return (
    <AppShell
      roleLabel="עובד"
      fullName={session.user.fullName ?? session.user.email ?? ''}
      courtName={primaryCourt?.name ?? null}
      navItems={navItems}
    >
      <ProfileNavigation incomingTransfers={incomingTransfers} />
      {children}
    </AppShell>
  );
}
