import { requireSession } from '@/lib/db/auth-helpers';
import { SystemRole } from '@/generated/prisma/client';
import { getAdminCourtsData } from '@/features/admin/actions';
import { AdminPanel } from '@/features/admin/screens/admin-panel';
import { CourtsOverview } from '@/features/admin/screens/courts-overview';

export default async function AdminDashboardPage() {
  await requireSession(SystemRole.ADMIN);
  const data = await getAdminCourtsData();

  return (
    <div className="space-y-8 p-6">
      <AdminPanel data={data} />
      <CourtsOverview data={data} />
    </div>
  );
}
