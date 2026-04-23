import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth';
import { SystemRole } from '@/generated/prisma/client';

export default async function RootPage() {
  console.log('RootPage');
  const session = await getServerSession(authOptions);

  if (!session) redirect('/login');
  if (session.user.systemRole === SystemRole.EMPLOYEE) redirect('/user');
  if (session.user.systemRole === SystemRole.MANAGER) redirect('/manager');
  redirect('/admin');
}
