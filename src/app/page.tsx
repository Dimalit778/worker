import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { Role } from '@/generated/prisma/client'

export default async function RootPage() {
  const session = await getServerSession(authOptions)

  if (!session) redirect('/login')
  if (session.user.role === Role.GUARD) redirect('/guard')
  redirect('/manager')
}
