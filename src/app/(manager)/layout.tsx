import { after } from 'next/server';
import { PortalRole } from '@/lib/auth/portal';
import { requireSession } from '@/lib/db/auth-helpers';
import { prisma } from '@/lib/db/client';
import { syncSubmissionWindows } from '@/features/periods/process-windows';
import { ManagerAppShell } from './manager-app-shell';
import { countOpenUrgent } from '@/features/requests/queries';

const navItems = [
  { href: '/manager', label: 'ראשי' },
  { href: '/manager/schedule', label: 'שיבוץ ' },
  { href: '/manager/draft', label: 'שיבוץ בהכנה' },
  { href: '/manager/requests', label: 'בקשות' },
  { href: '/manager/employees', label: 'עובדים' },
  { href: '/manager/settings', label: 'הגדרות' },
  { href: '/manager/profile', label: 'הפרופיל שלי' },
] as const;

export default async function ManagerLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession(PortalRole.MANAGER);
  // Send due open/reminder emails after the response so the page does not wait for them.
  after(() => syncSubmissionWindows(session.user.facilityId));

  const [court, urgentCount, hasClosedDraft] = session.user.facilityId
    ? await Promise.all([
        prisma.facility.findUnique({ where: { id: session.user.facilityId } }),
        countOpenUrgent(session.user.facilityId),
        // The draft tab appears only once the submission deadline has passed and the schedule is not yet published.
        prisma.schedule.count({
          where: { facilityId: session.user.facilityId, status: 'DRAFT', draftVersionId: { not: null }, submissionClosesAt: { lte: new Date() } },
        }).then(count => count > 0),
      ])
    : [null, 0, false];
  const items = navItems
    .filter(item => item.href !== '/manager/draft' || hasClosedDraft)
    .map(item => (item.href === '/manager/requests' ? { ...item, badge: urgentCount } : item));

  return (
    <ManagerAppShell fullName={session.user.fullName ?? session.user.email ?? ''} courtName={court?.name ?? null} navItems={items}>
      {children}
    </ManagerAppShell>
  );
}
