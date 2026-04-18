import { requireSession } from '@/lib/auth-helpers';
import { SystemRole } from '@/generated/prisma/client';
import Link from 'next/link';
import { LogoutButton } from '@/components/ui/logout-button';

const navItems = [
  { href: '/manager', label: 'לוח בקרה' },
  { href: '/manager/shibutz', label: 'שיבוץ' },
  { href: '/manager/periods', label: 'תקופות' },
  { href: '/manager/guards', label: 'מאבטחים' },
  { href: '/manager/settings', label: 'הגדרות' },
];

export default async function ManagerLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession(SystemRole.MANAGER);

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar */}
      <aside className="w-56 border-e bg-card flex flex-col shrink-0">
        <div className="p-4 border-b">
          <p className="font-bold text-sm">שמירה בתי משפט</p>
          <p className="text-xs text-muted-foreground mt-0.5">{session.user.name}</p>
        </div>
        <nav className="flex-1 p-2 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="p-2 border-t">
          <LogoutButton className="w-full justify-start" />
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 p-6 overflow-auto">{children}</main>
    </div>
  );
}
