import { requireSession } from '@/lib/auth-helpers'
import { Role } from '@/generated/prisma/client'
import { prisma } from '@/lib/db/client'

export default async function GuardLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession(Role.GUARD)

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
        </div>
      </header>
      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-4">
        {children}
      </main>
    </div>
  )
}
