'use client';

import { EmployeesTable } from '@/features/employess/components/employees-table';
import { useEmployeesList } from '@/features/employess/hooks';

type Props = {
  facilityId?: string;
};

export function EmployeesListScreen({ facilityId }: Props) {
  const { data, isLoading, isError } = useEmployeesList(facilityId);

  if (isLoading) {
    return (
      <p className="text-sm text-muted-foreground" dir="rtl">
        טוען עובדים...
      </p>
    );
  }

  if (isError || !data || 'error' in data) {
    return (
      <div dir="rtl">Error: {isError ? 'טעינת העובדים נכשלה' : data && 'error' in data ? data.error : 'שגיאה'}</div>
    );
  }

  return (
    <EmployeesTable
      employees={data.employees}
      positions={data.positions}
      facilityId={facilityId}
      showHeader={!facilityId}
    />
  );
}
