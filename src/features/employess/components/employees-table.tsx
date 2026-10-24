'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import type { EmployeeListItem, PositionOption } from '@/features/employess/types';
import { Button } from '@/components/ui/button';
import { EmployeeModal } from './employee-modal';
import { EmployeesDataTable } from './emplloyee-data-table';
import { createEmployeesColumns } from './employee-columns';

export function EmployeesTable({
  employees,
  positions,
  facilityId,
  currentUserId,
  showHeader = true,
}: {
  employees: EmployeeListItem[];
  positions: PositionOption[];
  facilityId?: string;
  currentUserId?: string;
  showHeader?: boolean;
}) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const columns = useMemo(
    () => createEmployeesColumns({ positions, facilityId, currentUserId }),
    [positions, facilityId, currentUserId],
  );

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex items-center justify-between gap-3">
        {showHeader && (
          <div>
            <h1 className="text-2xl font-bold">עובדים</h1>
            <p className="text-sm text-muted-foreground">ניהול עובדים, תפקידים וסטטוס פעילות.</p>
          </div>
        )}
        <Button type="button" className={!showHeader ? 'ms-auto' : undefined} onClick={() => setModalOpen(true)}>
          <Plus className="ml-2 h-4 w-4" />
          הוסף עובד
        </Button>
      </div>
      <EmployeesDataTable
        columns={columns}
        data={employees}
        onRowClick={facilityId ? undefined : (employee) => router.push(`/manager/employees/${employee.id}`)}
      />
      {modalOpen && (
        <EmployeeModal employee={null} positions={positions} facilityId={facilityId} onClose={() => setModalOpen(false)} />
      )}
    </div>
  );
}
