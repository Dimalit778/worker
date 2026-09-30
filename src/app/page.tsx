import { PortalRole } from '@/lib/auth/portal';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth';

export default async function RootPage() {
  const session = await getServerSession(authOptions);

  if (!session) redirect('/login');
  if (session.user.portal === PortalRole.EMPLOYEE) redirect('/employee');
  if (session.user.portal === PortalRole.MANAGER) redirect('/manager');
  redirect('/admin');
}
