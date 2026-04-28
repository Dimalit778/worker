import { requireSession } from '@/lib/db/auth-helpers';
import { SystemRole } from '@/generated/prisma/client';
import { getEmployees, getPositions } from '@/features/employess/actions';
import { EmployeesTable } from '@/features/employess/components/employees-table';

export default async function ManagerEmployeesPage() {
  await requireSession(SystemRole.MANAGER);
  const employees = await getEmployees();
  const positions = await getPositions();

  return (
    <div className="space-y-6">
      <EmployeesTable employees={employees} positions={positions} />
    </div>
  );
}
