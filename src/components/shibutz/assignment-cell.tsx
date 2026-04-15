'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { GuardPicker } from './guard-picker'
import { assignGuard, reassignGuard, removeAssignment } from '@/app/(manager)/manager/shibutz/actions'
import type { AssignmentSummary, GuardSummary, ShiftType } from './types'

type Props = {
  /** null = closed cell (Friday night / Saturday) */
  closed: boolean
  assignment: AssignmentSummary | null
  guards: GuardSummary[]
  scheduleId: string | null
  periodId: string
  courtId: string
  /** ISO date YYYY-MM-DD */
  date: string
  shiftType: ShiftType
  isOpeningDuty: boolean
}

export function AssignmentCell({
  closed, assignment, guards, scheduleId, periodId, courtId, date, shiftType, isOpeningDuty,
}: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  if (closed) {
    return <td className="border border-border bg-black" />
  }

  function handleSelect(guardId: string) {
    setOpen(false)
    startTransition(async () => {
      if (assignment) {
        await reassignGuard(assignment.id, guardId)
      } else {
        await assignGuard({ scheduleId, periodId, userId: guardId, courtId, date, shiftType, isOpeningDuty })
      }
      router.refresh()
    })
  }

  function handleRemove() {
    if (!assignment) return
    setOpen(false)
    startTransition(async () => {
      await removeAssignment(assignment.id)
      router.refresh()
    })
  }

  return (
    <td
      className={cn(
        'relative border border-border text-center text-xs cursor-pointer select-none transition-colors',
        'min-w-[62px] h-[26px] px-1',
        assignment ? 'hover:bg-accent/60' : 'bg-muted/40 hover:bg-accent/30',
        pending && 'opacity-50 pointer-events-none',
        open && 'ring-2 ring-primary ring-inset'
      )}
      onClick={() => setOpen(v => !v)}
    >
      <span className="truncate block max-w-[58px] mx-auto">
        {assignment?.userName ?? ''}
      </span>

      {open && (
        <GuardPicker
          guards={guards}
          currentUserId={assignment?.userId ?? null}
          onSelect={handleSelect}
          onRemove={handleRemove}
          onClose={() => setOpen(false)}
        />
      )}
    </td>
  )
}
