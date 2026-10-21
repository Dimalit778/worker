import { requireSession } from '@/lib/db/auth-helpers';
import { SystemRole } from '@/generated/prisma/client';
import { AppShell } from '@/components/navigation/app-shell';

const navItems = [
  { href: '/admin', label: 'לוח בקרה' },
  { href: '/admin/courts', label: 'בתי משפט' },
  { href: '/admin/employees', label: 'עובדים' },
  { href: '/admin/config', label: 'הגדרות מערכת' },
  { href: '/admin/profile', label: 'הפרופיל שלי' },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession(SystemRole.ADMIN);

  return (
    <AppShell
      fullName={session.user.fullName ?? session.user.name ?? session.user.email ?? ''}
      courtName="ניהול מערכת"
      roleLabel="מנהל מערכת"
      navItems={navItems}
    >
      {children}
    </AppShell>
  );
}
