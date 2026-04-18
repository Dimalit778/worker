import Link from 'next/link'
import { requireSession } from '@/lib/auth-helpers'
import { SystemRole } from '@/generated/prisma/client'
import { prisma } from '@/lib/db/client'
import { LogoutButton } from '@/components/ui/logout-button'

const userNavItems = [
  { href: '/user', label: '\u05e8\u05d0\u05e9\u05d9' },
  { href: '/user/shibutz', label: '\u05e9\u05d9\u05d1\u05d5\u05e5' },
  { href: '/user/availability', label: '\u05d6\u05de\u05d9\u05e0\u05d5\u05ea' },
  { href: '/user/schedule', label: '\u05dc\u05d5\u05d7 \u05de\u05e9\u05de\u05e8\u05d5\u05ea' },
]

export default async function UserLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession(SystemRole.EMPLOYEE)

  const primaryCourt = session.user.primaryCourtId
    ? await prisma.court.findUnique({ where: { id: session.user.primaryCourtId } })
    : null

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="sticky top-0 z-50 border-b bg-card px-4 py-3">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <div className="text-xs text-muted-foreground">
            {primaryCourt?.name ?? '—'}
          </div>
          <div>
            <p className="font-semibold text-sm">{session.user.name}</p>
            <p className="text-xs text-muted-foreground text-left">שמירה בתי משפט</p>
          </div>
          <LogoutButton />
        </div>
        <nav className="max-w-lg mx-auto mt-3 flex flex-wrap gap-2 justify-center border-t border-border pt-3">
          {userNavItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-2.5 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-4">
        {children}
      </main>
    </div>
  )
}
