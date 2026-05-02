import { requireSession } from '@/lib/db/auth-helpers';
import { SystemRole } from '@/generated/prisma/client';
import { prisma } from '@/lib/db/client';
import { ManagerAppShell } from './manager-app-shell';

const navItems = [
  { href: '/manager', label: 'לוח בקרה' },
  { href: '/manager/draft', label: 'בהכנה' },
  { href: '/manager/schedule', label: 'שיבוץ עבודה' },
  { href: '/manager/periods', label: 'תקופות' },
  { href: '/manager/employees', label: 'עובדים' },
  { href: '/manager/settings', label: 'הגדרות' },
] as const;

export default async function ManagerLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession(SystemRole.MANAGER);

  const court = session.user.courtId ? await prisma.court.findUnique({ where: { id: session.user.courtId } }) : null;

  return (
    <ManagerAppShell fullName={session.user.fullName ?? ''} courtName={court?.name ?? null} navItems={navItems}>
      {children}
    </ManagerAppShell>
  );
}
