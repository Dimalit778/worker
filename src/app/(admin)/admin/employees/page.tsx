import { requireSession } from '@/lib/db/auth-helpers';
import { SystemRole } from '@/generated/prisma/client';
import { getAdminCourtsData } from '@/features/admin/actions';
import { EmployeesOverview } from '@/features/admin/screens/employees-overview';

export default async function AdminEmployeesPage() {
  await requireSession(SystemRole.ADMIN);
  const data = await getAdminCourtsData();

  return <EmployeesOverview data={data} />;
}
