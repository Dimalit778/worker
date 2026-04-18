'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'
import { Position } from '@/features/guards/types'
import { createGuard, updateGuard } from '@/features/guards/actions'
import type { GuardRow } from '@/features/guards/types'

const POSITION_HE: Record<Position, string> = {
  GUARD: 'מאבטח',
  BAKAR: 'בקר',
  SHIFT_MANAGER: 'אחמ״ש',
  FACILITY_OFFICER: 'קצין מתקן',
}

type Props = {
  guard: GuardRow | null  // null = create mode
  onClose: () => void
}

export function GuardModal({ guard, onClose }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [createdNumber, setCreatedNumber] = useState<string | null>(null)
  const isEdit = guard !== null

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const name = fd.get('name') as string
    const position = fd.get('position') as Position
    const isActive = fd.has('isActive')

    setError(null)
    startTransition(async () => {
      if (isEdit) {
        const result = await updateGuard({ employeeId: guard.id, name, position, isActive })
        if ('error' in result) {
          setError(result.error)
        } else {
          onClose()
          router.refresh()
        }
      } else {
        const result = await createGuard({ name, position })
        if ('error' in result) {
          setError(result.error)
        } else {
          setCreatedNumber(result.employeeNumber)
          router.refresh()
        }
      }
    })
  }

  // After successful creation: show the generated employee number
  if (createdNumber) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" dir="rtl">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4">
          <h2 className="font-bold text-lg">מאבטח נוסף בהצלחה</h2>
          <p className="text-sm text-muted-foreground">
            מספר העובד שנוצר הוא:
          </p>
          <p className="text-3xl font-bold text-center tracking-widest" dir="ltr">
            {createdNumber}
          </p>
          <p className="text-xs text-muted-foreground text-center">
            הסיסמה הראשונית זהה למספר העובד. המאבטח יתבקש לשנות אותה בכניסה הראשונה.
          </p>
          <button
            onClick={onClose}
            className="w-full bg-foreground text-background rounded-md py-2 text-sm font-medium hover:opacity-90"
          >
            סגור
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" dir="rtl">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-lg">
            {isEdit ? 'עריכת מאבטח' : 'הוספת מאבטח'}
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        {isEdit && guard.employeeNumber && (
          <div className="mb-4 px-3 py-2 bg-muted/40 rounded-md text-sm">
            <span className="text-muted-foreground">מספר עובד: </span>
            <span className="font-mono font-semibold" dir="ltr">{guard.employeeNumber}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">שם מלא *</label>
            <input
              name="name"
              defaultValue={guard?.name ?? ''}
              required
              className="w-full border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">תפקיד *</label>
            <select
              name="position"
              defaultValue={guard?.position ?? Position.GUARD}
              required
              className="w-full border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white"
            >
              {(Object.keys(POSITION_HE) as Position[]).map(pos => (
                <option key={pos} value={pos}>{POSITION_HE[pos]}</option>
              ))}
            </select>
          </div>

          {isEdit && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                name="isActive"
                id="isActive"
                defaultChecked={guard.isActive}
                className="w-4 h-4"
              />
              <label htmlFor="isActive" className="text-sm font-medium">פעיל</label>
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={pending}
              className="flex-1 bg-foreground text-background rounded-md py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
            >
              {pending ? 'שומר...' : 'שמור'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-border rounded-md py-2 text-sm hover:bg-muted"
            >
              ביטול
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
