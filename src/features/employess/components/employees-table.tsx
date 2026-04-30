'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EmployeeListItem, PositionOption } from '@/features/employess/types';
import { deleteEmployee } from '@/features/employess/actions';
import { EmployeeModal } from './employee-modal';
import { Button } from '@/components/ui/button';

const POSITION_STYLE: Record<number, string> = {
  1: 'bg-slate-800 text-white',
  2: 'bg-blue-100 text-blue-800',
  3: 'bg-slate-100 text-slate-600',
  4: 'bg-orange-100 text-orange-800',
};

export function EmployeesTable({
  employees,
  positions,
}: {
  employees: EmployeeListItem[];
  positions: PositionOption[];
}) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<EmployeeListItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [deletePending, startDeleteTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function openAdd() {
    setEditingEmployee(null);
    setError(null);
    setModalOpen(true);
  }

  function openEdit(employee: EmployeeListItem) {
    setEditingEmployee(employee);
    setError(null);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingEmployee(null);
  }
  function handleDeleteClick(employee: EmployeeListItem) {
    setError(null);
    setDeleteTarget({
      id: employee.id,
      name: `${employee.firstName} ${employee.lastName}`.trim(),
    });
  }

  function handleConfirmDelete() {
    if (!deleteTarget) return;

    startDeleteTransition(async () => {
      const result = await deleteEmployee(deleteTarget.id);

      if ('error' in result) {
        setError(result.error);
        return;
      }

      setDeleteTarget(null);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">עובדים</h1>
        <button
          onClick={openAdd}
          className="bg-foreground text-background text-sm px-4 py-2 rounded-md hover:opacity-90"
        >
          + הוסף עובד
        </button>
      </div>

      <div className="border border-border rounded-lg overflow-hidden bg-white">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-muted/50 text-right">
              <th className="px-4 py-3 font-medium border-b border-border w-10">#</th>
              <th className="px-4 py-3 font-medium border-b border-border">שם</th>
              <th className="px-4 py-3 font-medium border-b border-border">תפקיד</th>
              <th className="px-4 py-3 font-medium border-b border-border">טלפון</th>
              <th className="px-4 py-3 font-medium border-b border-border">אימייל</th>
              <th className="px-4 py-3 font-medium border-b border-border">סטטוס</th>
              <th className="px-4 py-3 border-b border-border w-16"></th>
            </tr>
          </thead>
          <tbody>
            {employees.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  אין עובדים. לחץ על &quot;+ הוסף עובד&quot; להוספה.
                </td>
              </tr>
            )}
            {employees.map((employee, i) => (
              <tr
                key={employee.id}
                className={cn(
                  'border-b border-border last:border-0 hover:bg-muted/20 transition-colors',
                  !employee.isActive && 'opacity-50',
                )}
              >
                <td className="px-4 py-3 text-muted-foreground">{i + 1}</td>
                <td className="px-4 py-3 font-medium">
                  {employee.firstName} {employee.lastName}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      'text-xs  px-2 py-0.5 rounded-md font-semibold',
                      POSITION_STYLE[employee.position.code],
                    )}
                  >
                    {employee.position.name}
                  </span>
                </td>
                <td className="px-4 py-3">{employee.phone}</td>
                <td className="px-4 py-3">{employee.email}</td>
                <td className="px-4 py-3">
                  {employee.isActive ? (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-800 font-medium">
                      פעיל
                    </span>
                  ) : (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
                      לא פעיל
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2 justify-end">
                    <button
                      onClick={() => openEdit(employee)}
                      className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-muted"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteClick(employee)}
                      disabled={deletePending}
                      className="text-muted-foreground hover:text-destructive p-1 rounded hover:bg-destructive/10 disabled:opacity-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modalOpen && <EmployeeModal employee={editingEmployee ?? null} positions={positions} onClose={closeModal} />}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-sm rounded-lg bg-background p-6 shadow-lg">
            <h2 className="text-lg font-bold">מחיקת עובד</h2>

            <p className="mt-2 text-sm text-muted-foreground">האם אתה בטוח שברצונך למחוק את {deleteTarget.name}?</p>

            <div className="mt-6 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)} disabled={deletePending}>
                ביטול
              </Button>

              <Button type="button" variant="destructive" onClick={handleConfirmDelete} disabled={deletePending}>
                {deletePending ? 'מוחק...' : 'מחק'}
              </Button>
            </div>
          </div>
        </div>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
