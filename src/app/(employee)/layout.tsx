import { PortalRole } from '@/lib/auth/portal';
import { requireSession } from '@/lib/db/auth-helpers';
import { prisma } from '@/lib/db/client';
import { syncSubmissionWindows } from '@/features/periods/process-windows';
import { EmployeeHeader } from './employee-header';
import { countIncomingTransfers } from '@/features/requests/queries';

export default async function UserLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession(PortalRole.EMPLOYEE);
  await syncSubmissionWindows(session.user.facilityId);

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

  const navItems = [
    { href: '/employee', label: 'שיבוץ', notify: false },
    { href: '/employee/submissions', label: 'ההגשות שלי', notify: false },
    { href: '/employee/requests', label: 'הבקשות שלי', notify: incomingTransfers > 0 },
  ];

  return (
    <div className="app-shell min-h-screen flex flex-col">
      <EmployeeHeader
        fullName={session.user.fullName ?? session.user.email ?? ''}
        courtName={primaryCourt?.name ?? null}
        navItems={navItems}
        availabilityStatus={availabilityStatus}
      />
      <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 md:px-8">{children}</main>
    </div>
  );
}
