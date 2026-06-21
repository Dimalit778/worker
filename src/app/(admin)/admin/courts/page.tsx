import { requireSession } from '@/lib/db/auth-helpers';
import { SystemRole } from '@/generated/prisma/client';
import { getAdminCourtsData } from '@/features/admin/actions';
import { AdminCourtsClient } from '@/features/admin/components/admin-courts-client';

export default async function AdminCourtsPage() {
  await requireSession(SystemRole.ADMIN);
  const data = await getAdminCourtsData();

  return <AdminCourtsClient data={data} />;
}
