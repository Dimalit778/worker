'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { MailPlus, Pencil, Trash2, UserCheck, UserX } from 'lucide-react';

import { EmployeeListItem, FutureAssignment, PositionOption } from '@/features/employess/types';
import { deleteEmployee, resendEmployeeInvite, setEmployeeActive } from '@/features/employess/actions';
import { deleteAdminEmployee } from '@/features/admin/actions';
import { invalidateEmployeeDetail, invalidateEmployeesList } from '@/features/employess/hooks';
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
import { InviteNotice } from './invite-notice';

export function EmployeeActions({
  employee,
  positions,
  facilityId,
  currentUserId,
  compact = false,
}: {
  employee: EmployeeListItem;
  positions: PositionOption[];
  facilityId?: string;
  currentUserId?: string;
  compact?: boolean;
}) {
  const queryClient = useQueryClient();
  const router = useRouter();

  const deleteMutation = useMutation({
    mutationFn: (employeeId: string) =>
      facilityId ? deleteAdminEmployee(employeeId) : deleteEmployee(employeeId),
    onSuccess: (result) => {
      if ('error' in result) {
        setError(result.error);
        return;
      }
      setDeleteTarget(null);
      invalidateEmployeesList(queryClient, facilityId);
      if (!facilityId) router.push('/manager/employees');
    },
    onError: () => setError('מחיקת העובד נכשלה. נסה שוב.'),
  });

  const activeMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => setEmployeeActive(id, isActive),
    onSuccess: (result) => {
      if ('error' in result) {
        setError(result.error);
        setActiveTarget(null);
        return;
      }
      invalidateEmployeeDetail(queryClient, employee.id);
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
  const { mutate: resendInvite } = useMutation({
    mutationFn: (employeeId: string) => resendEmployeeInvite(employeeId),
    onSuccess: (result) => {
      if ('error' in result) {
        setError(result.error);
        return;
      }
      setInviteResult({ inviteLink: result.inviteLink, emailError: result.emailError });
    },
    onError: () => setError('שליחת ההזמנה נכשלה'),
  });
  const [inviteResult, setInviteResult] = useState<{ inviteLink?: string; emailError?: string } | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<EmployeeListItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const deletePending = deleteMutation.isPending || activeMutation.isPending;
  const [error, setError] = useState<string | null>(null);

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
  const handleResendInvite = useCallback(
    (employee: EmployeeListItem) => {
      setError(null);
      setInviteResult(null);
      resendInvite(employee.id);
    },
    [resendInvite, setError, setInviteResult],
  );

  function handleConfirmDelete() {
    if (!deleteTarget) return;
    setError(null);
    deleteMutation.mutate(deleteTarget.id);
  }

  const buttonSize = compact ? 'icon' : 'default';
  const buttonClass = compact ? 'h-8 w-8' : undefined;

  return (
    <div className="space-y-4" dir="rtl">
      <div className={compact ? 'flex items-center justify-end gap-1' : 'flex flex-wrap items-center gap-2'}>
        <Button
          type="button"
          variant={compact ? 'ghost' : 'outline'}
          size={buttonSize}
          className={buttonClass}
          aria-label="עריכה"
          title="עריכה"
          disabled={positions.length === 0}
          onClick={() => openEdit(employee)}
        >
          {compact ? <Pencil className="size-4" /> : 'עריכת עובד'}
        </Button>
        <Button
          type="button"
          variant={compact ? 'ghost' : 'outline'}
          size={buttonSize}
          className={buttonClass}
          aria-label="שליחת הזמנה מחדש"
          title="שליחת הזמנה מחדש"
          onClick={() => handleResendInvite(employee)}
        >
          {compact ? <MailPlus className="size-4" /> : 'שליחת הזמנה מחדש'}
        </Button>
        {!facilityId && (
          <Button
            type="button"
            variant={compact ? 'ghost' : 'outline'}
            size={buttonSize}
            className={buttonClass}
            disabled={deletePending || employee.id === currentUserId}
            aria-label={employee.isActive ? 'השבתה' : 'הפעלה מחדש'}
            title={employee.isActive ? 'השבתה' : 'הפעלה מחדש'}
            onClick={() => handleToggleActive(employee)}
          >
            {compact
              ? employee.isActive ? <UserX className="size-4" /> : <UserCheck className="size-4" />
              : employee.isActive ? 'השבתת עובד' : 'הפעלה מחדש'}
          </Button>
        )}
        {employee.id !== currentUserId && (
          <Button
            type="button"
            variant={compact ? 'ghost' : 'destructive'}
            size={buttonSize}
            className={compact ? 'h-8 w-8 text-destructive hover:text-destructive' : undefined}
            disabled={deletePending}
            aria-label="מחיקת עובד לצמיתות"
            title="מחיקת עובד לצמיתות"
            onClick={() => handleDeleteClick(employee)}
          >
            {compact ? <Trash2 className="size-4" /> : 'מחיקת עובד'}
          </Button>
        )}
      </div>

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
              האם אתה בטוח שברצונך למחוק את {deleteTarget?.name}? העובד יוסר מרשימת העובדים ולא יוכל להתחבר
              או להשתבץ מחדש. שמו ושיבוציו בעבר ובסידור הנוכחי יישמרו. פעולה זו לא ניתנת לביטול.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

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

          <ul className="space-y-1 text-sm md:max-h-64 md:overflow-y-auto">
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
      {inviteResult && <InviteNotice inviteLink={inviteResult.inviteLink} emailError={inviteResult.emailError} />}

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
