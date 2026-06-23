'use client';

import { useCallback, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';

import { EmployeeListItem, PositionOption } from '@/features/employess/types';
import { deleteEmployee } from '@/features/employess/actions';
import { deleteAdminEmployee } from '@/features/admin/actions';
import { invalidateEmployeesList } from '@/features/employess/hooks';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

import { EmployeeModal } from './employee-modal';
import { EmployeesDataTable } from './emplloyee-data-table';
import { createEmployeesColumns } from './employee-columns';

export function EmployeesTable({
  employees,
  positions,
  courtId,
  showHeader = true,
}: {
  employees: EmployeeListItem[];
  positions: PositionOption[];
  courtId?: string;
  showHeader?: boolean;
}) {
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: (employeeId: string) =>
      courtId ? deleteAdminEmployee(employeeId) : deleteEmployee(employeeId),
    onSuccess: (result) => {
      if ('error' in result) {
        setError(result.error);
        return;
      }
      setDeleteTarget(null);
      invalidateEmployeesList(queryClient, courtId);
    },
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<EmployeeListItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const deletePending = deleteMutation.isPending;
  const [error, setError] = useState<string | null>(null);

  function openAdd() {
    setEditingEmployee(null);
    setError(null);
    setModalOpen(true);
  }

  const openEdit = useCallback((employee: EmployeeListItem) => {
    setEditingEmployee(employee);
    setError(null);
    setModalOpen(true);
  }, [setEditingEmployee, setError, setModalOpen]);

  function closeModal() {
    setModalOpen(false);
    setEditingEmployee(null);
  }

  const handleDeleteClick = useCallback((employee: EmployeeListItem) => {
    setError(null);
    setDeleteTarget({
      id: employee.id,
      name: `${employee.firstName} ${employee.lastName}`.trim(),
    });
  }, [setDeleteTarget, setError]);

  function handleConfirmDelete() {
    if (!deleteTarget) return;
    setError(null);
    deleteMutation.mutate(deleteTarget.id);
  }

  const columns = useMemo(
    () =>
      createEmployeesColumns({
        onEdit: openEdit,
        onDelete: handleDeleteClick,
        deletePending,
        hideDetailLinks: Boolean(courtId),
      }),
    [courtId, deletePending, handleDeleteClick, openEdit],
  );

  return (
    <div className="space-y-4" dir="rtl">
      {showHeader && (
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">עובדים</h1>
            <p className="text-sm text-muted-foreground">ניהול עובדים, תפקידים וסטטוס פעילות.</p>
          </div>

          <Button type="button" onClick={openAdd}>
            <Plus className="ml-2 h-4 w-4" />
            הוסף עובד
          </Button>
        </div>
      )}

      {!showHeader && (
        <div className="flex justify-end">
          <Button type="button" onClick={openAdd}>
            <Plus className="ml-2 h-4 w-4" />
            הוסף עובד
          </Button>
        </div>
      )}

      <EmployeesDataTable columns={columns} data={employees} />

      {modalOpen && (
        <EmployeeModal
          employee={editingEmployee}
          positions={positions}
          courtId={courtId}
          onClose={closeModal}
        />
      )}

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>מחיקת עובד</AlertDialogTitle>
            <AlertDialogDescription>
              האם אתה בטוח שברצונך למחוק את {deleteTarget?.name}? פעולה זו לא ניתנת לביטול.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter className="gap-2 sm:justify-start">
            <AlertDialogCancel disabled={deletePending}>ביטול</AlertDialogCancel>

            <AlertDialogAction
              disabled={deletePending}
              onClick={(event) => {
                event.preventDefault();
                handleConfirmDelete();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletePending ? 'מוחק...' : 'מחק'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
