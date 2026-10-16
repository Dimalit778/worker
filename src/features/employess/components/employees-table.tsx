'use client';

import { useCallback, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';

import { EmployeeListItem, FutureAssignment, PositionOption } from '@/features/employess/types';
import { setEmployeeActive } from '@/features/employess/actions';
import { deleteAdminEmployee } from '@/features/admin/actions';
import { invalidateEmployeesList } from '@/features/employess/hooks';
import { SHIFT_LABELS } from '@/features/schedules/constants';
import type { ShiftType } from '@/generated/prisma/client';
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
  facilityId,
  showHeader = true,
}: {
  employees: EmployeeListItem[];
  positions: PositionOption[];
  facilityId?: string;
  showHeader?: boolean;
}) {
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: (employeeId: string) => deleteAdminEmployee(employeeId),
    onSuccess: (result) => {
      if ('error' in result) {
        setError(result.error);
        return;
      }
      setDeleteTarget(null);
      invalidateEmployeesList(queryClient, facilityId);
    },
  });

  const activeMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => setEmployeeActive(id, isActive),
    onSuccess: (result) => {
      if ('error' in result) {
        setError(result.error);
        setActiveTarget(null);
        return;
      }
      invalidateEmployeesList(queryClient, facilityId);
      if (result.futureAssignments.length > 0) {
        setDeactivationResult({ name: activeTarget?.name ?? '', assignments: result.futureAssignments });
      }
      setActiveTarget(null);
    },
  });

  const [activeTarget, setActiveTarget] = useState<{ id: string; name: string; activate: boolean } | null>(null);
  const [deactivationResult, setDeactivationResult] = useState<{
    name: string;
    assignments: FutureAssignment[];
  } | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<EmployeeListItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const deletePending = deleteMutation.isPending || activeMutation.isPending;
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

  const handleToggleActive = useCallback((employee: EmployeeListItem) => {
    setError(null);
    setActiveTarget({
      id: employee.id,
      name: `${employee.firstName} ${employee.lastName}`.trim(),
      activate: !employee.isActive,
    });
  }, [setActiveTarget, setError]);

  function handleConfirmActive() {
    if (!activeTarget) return;
    setError(null);
    activeMutation.mutate({ id: activeTarget.id, isActive: activeTarget.activate });
  }

  function handleConfirmDelete() {
    if (!deleteTarget) return;
    setError(null);
    deleteMutation.mutate(deleteTarget.id);
  }

  const columns = useMemo(
    () =>
      createEmployeesColumns({
        onEdit: openEdit,
        onDelete: facilityId ? handleDeleteClick : undefined,
        onToggleActive: facilityId ? undefined : handleToggleActive,
        deletePending,
        hideDetailLinks: Boolean(facilityId),
      }),
    [facilityId, deletePending, handleDeleteClick, handleToggleActive, openEdit],
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
          facilityId={facilityId}
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

      <AlertDialog
        open={Boolean(activeTarget)}
        onOpenChange={(open) => {
          if (!open) setActiveTarget(null);
        }}
      >
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>{activeTarget?.activate ? 'הפעלה מחדש של עובד' : 'השבתת עובד'}</AlertDialogTitle>
            <AlertDialogDescription>
              {activeTarget?.activate
                ? `להפעיל מחדש את ${activeTarget.name}? העובד יוכל להתחבר ולהשתבץ שוב.`
                : `להשבית את ${activeTarget?.name}? העובד לא יוכל להתחבר ולא ישובץ בשיבוצים חדשים. ההיסטוריה והשיבוצים הקיימים נשמרים.`}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter className="gap-2 sm:justify-start">
            <AlertDialogCancel disabled={activeMutation.isPending}>ביטול</AlertDialogCancel>
            <AlertDialogAction
              disabled={activeMutation.isPending}
              onClick={(event) => {
                event.preventDefault();
                handleConfirmActive();
              }}
            >
              {activeMutation.isPending ? 'מעדכן...' : activeTarget?.activate ? 'הפעל' : 'השבת'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(deactivationResult)}
        onOpenChange={(open) => {
          if (!open) setDeactivationResult(null);
        }}
      >
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>שיבוצים עתידיים שדורשים טיפול</AlertDialogTitle>
            <AlertDialogDescription>
              {deactivationResult?.name} הושבת, אך עדיין משובץ במשמרות עתידיות. השיבוצים לא הוסרו אוטומטית.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <ul className="max-h-64 space-y-1 overflow-y-auto text-sm">
            {deactivationResult?.assignments.map((assignment) => (
              <li key={assignment.slotId} className="rounded-md border px-3 py-2">
                {assignment.date} · {SHIFT_LABELS[assignment.shiftType as ShiftType] ?? assignment.shiftType} ·{' '}
                {assignment.positionName} · {assignment.periodName}
                {assignment.versionStatus === 'DRAFT' ? ' (טיוטה)' : ' (פורסם)'}
              </li>
            ))}
          </ul>

          <AlertDialogFooter className="gap-2 sm:justify-start">
            <AlertDialogCancel>סגור</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
