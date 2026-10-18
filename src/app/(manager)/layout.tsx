import { PortalRole } from '@/lib/auth/portal';
import { requireSession } from '@/lib/db/auth-helpers';
import { prisma } from '@/lib/db/client';
import { syncSubmissionWindows } from '@/features/periods/process-windows';
import { ManagerAppShell } from './manager-app-shell';
import { countOpenUrgent } from '@/features/requests/queries';

const navItems = [
  { href: '/manager', label: 'ראשי' },
  { href: '/manager/schedule', label: 'שיבוץ ' },
  { href: '/manager/schedule/changes', label: 'היסטוריית שינויים' },
  { href: '/manager/draft', label: 'שיבוץ בהכנה' },
  { href: '/manager/requests', label: 'בקשות' },
  { href: '/manager/employees', label: 'עובדים' },
  { href: '/manager/settings', label: 'הגדרות' },
] as const;

export default async function ManagerLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession(PortalRole.MANAGER);
  await syncSubmissionWindows(session.user.facilityId);

  const [court, urgentCount] = session.user.facilityId
    ? await Promise.all([prisma.facility.findUnique({ where: { id: session.user.facilityId } }), countOpenUrgent(session.user.facilityId)])
    : [null, 0];
  const items = navItems.map(item => (item.href === '/manager/requests' ? { ...item, badge: urgentCount } : item));

  return (
    <ManagerAppShell fullName={session.user.fullName ?? session.user.email ?? ''} courtName={court?.name ?? null} navItems={items}>
      {children}
    </ManagerAppShell>
  );
}
