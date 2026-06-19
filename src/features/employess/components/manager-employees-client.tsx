'use client';

import { EmployeesTable } from '@/features/employess/components/employees-table';
import { useEmployeesList } from '@/features/employess/hooks';

export function ManagerEmployeesClient() {
  const { data, isLoading, isError } = useEmployeesList();

  if (isLoading) {
    return <p className="text-sm text-muted-foreground" dir="rtl">טוען עובדים...</p>;
  }

  if (isError || !data || 'error' in data) {
    return (
      <div dir="rtl">
        Error: {isError ? 'טעינת העובדים נכשלה' : data && 'error' in data ? data.error : 'שגיאה'}
      </div>
    );
  }

  return <EmployeesTable employees={data.employees} positions={data.positions} />;
}
