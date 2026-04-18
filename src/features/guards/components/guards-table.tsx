'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Position, type GuardRow } from '@/features/guards/types'
import { deleteGuard } from '@/features/guards/actions'
import { GuardModal } from './guard-modal'

export type { GuardRow }

const POSITION_HE: Record<Position, string> = {
  GUARD: 'מאבטח',
  BAKAR: 'בקר',
  SHIFT_MANAGER: 'אחמ״ש',
  FACILITY_OFFICER: 'קצין מתקן',
}

const POSITION_STYLE: Record<Position, string> = {
  SHIFT_MANAGER: 'bg-slate-800 text-white',
  BAKAR: 'bg-blue-100 text-blue-800',
  GUARD: 'bg-slate-100 text-slate-600',
  FACILITY_OFFICER: 'bg-orange-100 text-orange-800',
}

type DeleteTarget = {
  id: string
  name: string
  assignmentCount: number
}

export function GuardsTable({ guards }: { guards: GuardRow[] }) {
  const router = useRouter()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingGuard, setEditingGuard] = useState<GuardRow | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null)
  const [deletePending, startDeleteTransition] = useTransition()

  function openAdd() {
    setEditingGuard(null)
    setModalOpen(true)
  }

  function openEdit(guard: GuardRow) {
    setEditingGuard(guard)
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setEditingGuard(null)
  }

  function handleDeleteClick(guard: GuardRow) {
    startDeleteTransition(async () => {
      const result = await deleteGuard({ employeeId: guard.id })
      if ('needsConfirm' in result) {
        setDeleteTarget({ id: guard.id, name: guard.name, assignmentCount: result.assignmentCount })
      } else if ('ok' in result) {
        router.refresh()
      }
    })
  }

  function handleForceDelete() {
    if (!deleteTarget) return
    startDeleteTransition(async () => {
      await deleteGuard({ employeeId: deleteTarget.id, force: true })
      setDeleteTarget(null)
      router.refresh()
    })
  }

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">מאבטחים</h1>
        <button
          onClick={openAdd}
          className="bg-foreground text-background text-sm px-4 py-2 rounded-md hover:opacity-90"
        >
          + הוסף מאבטח
        </button>
      </div>

      <div className="border border-border rounded-lg overflow-hidden bg-white">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-muted/50 text-right">
              <th className="px-4 py-3 font-medium border-b border-border w-10">#</th>
              <th className="px-4 py-3 font-medium border-b border-border">שם</th>
              <th className="px-4 py-3 font-medium border-b border-border">תפקיד</th>
              <th className="px-4 py-3 font-medium border-b border-border">מספר עובד</th>
              <th className="px-4 py-3 font-medium border-b border-border">סטטוס</th>
              <th className="px-4 py-3 border-b border-border w-16"></th>
            </tr>
          </thead>
          <tbody>
            {guards.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  אין מאבטחים. לחץ על &quot;+ הוסף מאבטח&quot; להוספה.
                </td>
              </tr>
            )}
            {guards.map((guard, i) => (
              <tr
                key={guard.id}
                className={cn(
                  'border-b border-border last:border-0 hover:bg-muted/20 transition-colors',
                  !guard.isActive && 'opacity-50',
                )}
              >
                <td className="px-4 py-3 text-muted-foreground">{i + 1}</td>
                <td className="px-4 py-3 font-medium">{guard.name}</td>
                <td className="px-4 py-3">
                  <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', POSITION_STYLE[guard.position])}>
                    {POSITION_HE[guard.position]}
                  </span>
                </td>
                <td className="px-4 py-3 font-mono text-muted-foreground" dir="ltr">
                  {guard.employeeNumber ?? '—'}
                </td>
                <td className="px-4 py-3">
                  {guard.isActive
                    ? <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-800 font-medium">פעיל</span>
                    : <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">לא פעיל</span>
                  }
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2 justify-end">
                    <button
                      onClick={() => openEdit(guard)}
                      className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-muted"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteClick(guard)}
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

      {modalOpen && <GuardModal guard={editingGuard} onClose={closeModal} />}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" dir="rtl">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <h2 className="font-bold text-lg">מחיקת מאבטח</h2>
            <p className="text-sm text-muted-foreground">
              למאבטח <span className="font-semibold text-foreground">{deleteTarget.name}</span> יש{' '}
              {deleteTarget.assignmentCount} שיבוצים. מחיקה תסיר אותם לצמיתות. להמשיך?
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleForceDelete}
                disabled={deletePending}
                className="flex-1 bg-destructive text-destructive-foreground rounded-md py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
              >
                מחק
              </button>
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 border border-border rounded-md py-2 text-sm hover:bg-muted"
              >
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
