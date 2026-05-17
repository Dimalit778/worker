import { requireSession } from '@/lib/db/auth-helpers';
import { SystemRole } from '@/generated/prisma/client';
import { getEmployeesPageData } from '@/features/employess/actions';
import { EmployeesTable } from '@/features/employess/components/employees-table';

export default async function ManagerEmployeesPage() {
  await requireSession(SystemRole.MANAGER);
  const data = await getEmployeesPageData();

  if ('error' in data) {
    return <div>Error: {data.error}</div>;
  }
  return <EmployeesTable employees={data.employees} positions={data.positions} />;
}
