# Shibutz Grid Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the placeholder shibutz page with a full interactive schedule grid where a manager can view and edit guard assignments for the active 14-day period.

**Architecture:** Server component fetches period, schedule, assignments, guards, and capacity rules, then passes serialised props to a client `ShibutzGrid` that owns `weekIndex` state. Cell clicks open an inline `GuardPicker` (floating panel) that calls server actions and refreshes via `router.refresh()`.

**Tech Stack:** Next.js 16 App Router, React 19, Prisma, Tailwind CSS v4, shadcn-style components (`Button`, `Input` from existing UI), Lucide icons, Vitest.

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `src/components/shibutz/types.ts` | Shared serialisable types for grid props |
| Create | `src/components/shibutz/utils.ts` | Pure helpers: `isClosedCell`, `getRowLabel`, `buildWeekDays` |
| Create | `src/app/(manager)/manager/shibutz/actions.ts` | Server actions: `assignGuard`, `reassignGuard`, `removeAssignment` |
| Create | `src/components/shibutz/week-navigator.tsx` | `‹ ›` week switcher (pure display, no state) |
| Create | `src/components/shibutz/guard-picker.tsx` | Floating dropdown with search + guard list |
| Create | `src/components/shibutz/assignment-cell.tsx` | One grid cell — renders name or blank, opens picker |
| Create | `src/components/shibutz/shift-section.tsx` | RTL table for one shift type (MORNING/EVENING/NIGHT) |
| Create | `src/components/shibutz/shibutz-grid.tsx` | Client root — owns `weekIndex`, composes sections |
| Modify | `src/app/(manager)/manager/shibutz/page.tsx` | Server component — fetch all data, render grid |
| Create | `tests/shibutz-utils.test.ts` | Unit tests for pure helpers |

---

## Task 1: Shared Types

**Files:**
- Create: `src/components/shibutz/types.ts`

- [ ] **Step 1: Create the types file**

```ts
// src/components/shibutz/types.ts
import type { ShiftType } from '@/generated/prisma/client'

export type { ShiftType }

export type GuardSummary = {
  id: string
  name: string
}

export type AssignmentSummary = {
  id: string
  userId: string
  userName: string
  isOpeningDuty: boolean
}

/**
 * Key: `${isoDate}-${shiftType}`  e.g. "2024-03-22-MORNING"
 * Value: assignments sorted by creation order (slot 0 first)
 */
export type AssignmentMap = Record<string, AssignmentSummary[]>

/** Max slots to display per shift type */
export type CapacityMap = { MORNING: number; EVENING: number; NIGHT: number }

export type ShibutzGridProps = {
  periodId: string
  periodName: string
  /** ISO date string YYYY-MM-DD */
  startDate: string
  /** ISO date string YYYY-MM-DD */
  endDate: string
  scheduleId: string | null
  assignments: AssignmentMap
  guards: GuardSummary[]
  capacity: CapacityMap
  /** Manager's court id — required for new assignments */
  courtId: string
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/shibutz/types.ts
git commit -m "feat(shibutz): add shared types"
```

---

## Task 2: Pure Helpers + Tests (TDD)

**Files:**
- Create: `src/components/shibutz/utils.ts`
- Create: `tests/shibutz-utils.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// tests/shibutz-utils.test.ts
import { describe, it, expect } from 'vitest'
import { isClosedCell, getRowLabel, buildWeekDays } from '@/components/shibutz/utils'

describe('isClosedCell', () => {
  it('closes Saturday for any shift', () => {
    expect(isClosedCell(6, 'MORNING')).toBe(true)
    expect(isClosedCell(6, 'EVENING')).toBe(true)
    expect(isClosedCell(6, 'NIGHT')).toBe(true)
  })

  it('closes Friday night only', () => {
    expect(isClosedCell(5, 'NIGHT')).toBe(true)
    expect(isClosedCell(5, 'MORNING')).toBe(false)
    expect(isClosedCell(5, 'EVENING')).toBe(false)
  })

  it('does not close other days', () => {
    expect(isClosedCell(0, 'MORNING')).toBe(false)
    expect(isClosedCell(4, 'NIGHT')).toBe(false)
  })
})

describe('getRowLabel', () => {
  it('returns correct labels for MORNING', () => {
    expect(getRowLabel('MORNING', 0)).toBe('אתמ״ש')
    expect(getRowLabel('MORNING', 1)).toBe('בקר')
    expect(getRowLabel('MORNING', 2)).toBe('בע״ת')
    expect(getRowLabel('MORNING', 3)).toBe('פתיחה')
    expect(getRowLabel('MORNING', 10)).toBe('פתיחה')
  })

  it('returns correct labels for EVENING', () => {
    expect(getRowLabel('EVENING', 0)).toBe('אתמ״ש')
    expect(getRowLabel('EVENING', 1)).toBe('בקר')
    expect(getRowLabel('EVENING', 2)).toBe('פתיחה')
  })

  it('returns correct labels for NIGHT', () => {
    expect(getRowLabel('NIGHT', 0)).toBe('בע״ת')
    expect(getRowLabel('NIGHT', 1)).toBe('פתיחה')
  })
})

describe('buildWeekDays', () => {
  it('returns 7 dates starting from startDate for weekIndex=0', () => {
    const days = buildWeekDays('2024-03-15', 0)
    expect(days).toHaveLength(7)
    expect(days[0].iso).toBe('2024-03-15')
    expect(days[6].iso).toBe('2024-03-21')
  })

  it('returns days 8-14 for weekIndex=1', () => {
    const days = buildWeekDays('2024-03-15', 1)
    expect(days[0].iso).toBe('2024-03-22')
    expect(days[6].iso).toBe('2024-03-28')
  })

  it('sets correct dayOfWeek (0=Sun)', () => {
    // 2024-03-15 is a Friday (5)
    const days = buildWeekDays('2024-03-15', 0)
    expect(days[0].dayOfWeek).toBe(5)
  })

  it('sets correct Hebrew day letter', () => {
    // 2024-03-17 is Sunday (dayOfWeek 0) → 'א'
    const days = buildWeekDays('2024-03-17', 0)
    expect(days[0].letter).toBe('א')
    expect(days[6].letter).toBe('ש')
  })
})
```

- [ ] **Step 2: Run tests — expect failures**

```bash
cd /path/to/project && npx vitest run tests/shibutz-utils.test.ts
```

Expected: failures because `@/components/shibutz/utils` doesn't exist yet.

- [ ] **Step 3: Implement utils**

```ts
// src/components/shibutz/utils.ts
import type { ShiftType } from '@/generated/prisma/client'

/** dayOfWeek: 0=Sunday … 6=Saturday */
export function isClosedCell(dayOfWeek: number, shiftType: ShiftType): boolean {
  if (dayOfWeek === 6) return true                    // all Saturday
  if (dayOfWeek === 5 && shiftType === 'NIGHT') return true  // Friday night
  return false
}

const MORNING_LABELS: Record<number, string> = { 0: 'אתמ״ש', 1: 'בקר', 2: 'בע״ת' }
const EVENING_LABELS: Record<number, string> = { 0: 'אתמ״ש', 1: 'בקר' }
const NIGHT_LABELS:   Record<number, string> = { 0: 'בע״ת' }

export function getRowLabel(shiftType: ShiftType, slotIndex: number): string {
  const map =
    shiftType === 'MORNING' ? MORNING_LABELS :
    shiftType === 'EVENING' ? EVENING_LABELS :
    NIGHT_LABELS
  return map[slotIndex] ?? 'פתיחה'
}

const HEB_LETTERS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'] // index = dayOfWeek (0=Sun…6=Sat)

export type WeekDay = {
  iso: string         // YYYY-MM-DD
  dayOfWeek: number   // 0=Sun … 6=Sat
  letter: string      // א–ש
  label: string       // DD/MM
}

/**
 * Returns the 7 dates for the given week of the period.
 * weekIndex 0 → days 1–7 (startDate … startDate+6)
 * weekIndex 1 → days 8–14 (startDate+7 … startDate+13)
 */
export function buildWeekDays(startDateISO: string, weekIndex: number): WeekDay[] {
  const [y, m, d] = startDateISO.split('-').map(Number)
  const base = new Date(Date.UTC(y, m - 1, d + weekIndex * 7))

  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate() + i))
    const iso = date.toISOString().slice(0, 10)
    const dayOfWeek = date.getUTCDay()   // 0=Sun
    const letter = HEB_LETTERS[dayOfWeek]
    const dd = String(date.getUTCDate()).padStart(2, '0')
    const mm = String(date.getUTCMonth() + 1).padStart(2, '0')
    return { iso, dayOfWeek, letter, label: `${dd}/${mm}` }
  })
}

/** Lookup key into AssignmentMap */
export function assignmentKey(isoDate: string, shiftType: ShiftType): string {
  return `${isoDate}-${shiftType}`
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
npx vitest run tests/shibutz-utils.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/shibutz/utils.ts tests/shibutz-utils.test.ts
git commit -m "feat(shibutz): add pure helpers with tests"
```

---

## Task 3: Server Actions

**Files:**
- Create: `src/app/(manager)/manager/shibutz/actions.ts`

- [ ] **Step 1: Create actions file**

```ts
// src/app/(manager)/manager/shibutz/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db/client'
import { requireSession } from '@/lib/auth-helpers'
import { Role, ShiftType } from '@/generated/prisma/client'
import { parseISODateToUtcMidnight } from '@/lib/periods/current-scheduling-period'

type AssignGuardParams = {
  scheduleId: string | null
  periodId: string
  userId: string
  courtId: string
  /** ISO date YYYY-MM-DD */
  date: string
  shiftType: ShiftType
  isOpeningDuty: boolean
}

export async function assignGuard(params: AssignGuardParams): Promise<{ scheduleId: string }> {
  await requireSession(Role.MANAGER)

  const { scheduleId: incomingScheduleId, periodId, userId, courtId, date, shiftType, isOpeningDuty } = params

  let scheduleId = incomingScheduleId

  if (!scheduleId) {
    // Create a new DRAFT schedule for this period
    const session = await requireSession(Role.MANAGER)
    const schedule = await prisma.schedule.create({
      data: { periodId, generatedById: session.user.id },
    })
    scheduleId = schedule.id
  }

  await prisma.shiftAssignment.create({
    data: {
      scheduleId,
      userId,
      courtId,
      date: parseISODateToUtcMidnight(date),
      shiftType,
      isOpeningDuty,
    },
  })

  revalidatePath('/manager/shibutz')
  return { scheduleId }
}

export async function reassignGuard(assignmentId: string, newUserId: string): Promise<void> {
  await requireSession(Role.MANAGER)

  await prisma.shiftAssignment.update({
    where: { id: assignmentId },
    data: { userId: newUserId },
  })

  revalidatePath('/manager/shibutz')
}

export async function removeAssignment(assignmentId: string): Promise<void> {
  await requireSession(Role.MANAGER)

  await prisma.shiftAssignment.delete({ where: { id: assignmentId } })

  revalidatePath('/manager/shibutz')
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/(manager)/manager/shibutz/actions.ts
git commit -m "feat(shibutz): add server actions for assign/reassign/remove"
```

---

## Task 4: WeekNavigator Component

**Files:**
- Create: `src/components/shibutz/week-navigator.tsx`

- [ ] **Step 1: Create component**

```tsx
// src/components/shibutz/week-navigator.tsx
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

type Props = {
  weekIndex: number          // 0 or 1
  onWeekChange: (w: number) => void
  week0Label: string         // e.g. "22–28 מרץ"
  week1Label: string         // e.g. "15–21 מרץ"
}

export function WeekNavigator({ weekIndex, onWeekChange, week0Label, week1Label }: Props) {
  const label = weekIndex === 0 ? week0Label : week1Label

  return (
    <div className="flex justify-center mb-5" dir="rtl">
      <div className="flex items-center gap-3 bg-white border border-border rounded-xl px-4 py-2 shadow-sm">
        {/* In RTL: ChevronRight = "forward / next week" (sits on the right) */}
        <button
          onClick={() => onWeekChange(0)}
          disabled={weekIndex === 0}
          className={cn(
            'flex items-center justify-center w-8 h-8 rounded-md border border-border bg-muted text-muted-foreground transition-colors',
            weekIndex === 0 ? 'opacity-30 cursor-default' : 'hover:bg-accent'
          )}
          aria-label="שבוע הבא"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        <div className="flex flex-col items-center gap-1 min-w-[180px]">
          <span className="font-semibold text-sm">{label}</span>
          <div className="flex gap-1.5">
            <div className={cn('w-2 h-2 rounded-full', weekIndex === 0 ? 'bg-primary' : 'bg-muted-foreground/30')} />
            <div className={cn('w-2 h-2 rounded-full', weekIndex === 1 ? 'bg-primary' : 'bg-muted-foreground/30')} />
          </div>
        </div>

        {/* ChevronLeft = "back / previous week" (sits on the left in RTL) */}
        <button
          onClick={() => onWeekChange(1)}
          disabled={weekIndex === 1}
          className={cn(
            'flex items-center justify-center w-8 h-8 rounded-md border border-border bg-muted text-muted-foreground transition-colors',
            weekIndex === 1 ? 'opacity-30 cursor-default' : 'hover:bg-accent'
          )}
          aria-label="שבוע קודם"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/shibutz/week-navigator.tsx
git commit -m "feat(shibutz): add WeekNavigator component"
```

---

## Task 5: GuardPicker Component

**Files:**
- Create: `src/components/shibutz/guard-picker.tsx`

- [ ] **Step 1: Create component**

```tsx
// src/components/shibutz/guard-picker.tsx
'use client'

import { useState, useRef, useEffect } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { GuardSummary } from './types'

type Props = {
  guards: GuardSummary[]
  currentUserId: string | null
  onSelect: (guardId: string) => void
  onRemove: () => void
  onClose: () => void
}

export function GuardPicker({ guards, currentUserId, onSelect, onRemove, onClose }: Props) {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const filtered = query.trim()
    ? guards.filter(g => g.name.includes(query.trim()))
    : guards

  // Auto-focus search input
  useEffect(() => { inputRef.current?.focus() }, [])

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  return (
    <div
      ref={panelRef}
      className="absolute z-50 bg-white border border-border rounded-lg shadow-lg w-44 py-1"
      style={{ top: '100%', right: 0 }}
      dir="rtl"
    >
      {/* Search */}
      <div className="px-2 pb-1 pt-1 border-b border-border">
        <input
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="חיפוש..."
          className="w-full text-xs px-2 py-1 border border-border rounded-md outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      {/* Guard list */}
      <ul className="max-h-44 overflow-y-auto">
        {filtered.length === 0 && (
          <li className="px-3 py-2 text-xs text-muted-foreground">לא נמצא</li>
        )}
        {filtered.map(g => (
          <li
            key={g.id}
            onClick={() => onSelect(g.id)}
            className={cn(
              'px-3 py-1.5 text-xs cursor-pointer hover:bg-accent',
              g.id === currentUserId && 'font-semibold bg-accent/50'
            )}
          >
            {g.name}
          </li>
        ))}
      </ul>

      {/* Remove option — only if cell is filled */}
      {currentUserId && (
        <div className="border-t border-border mt-1">
          <button
            onClick={onRemove}
            className="flex items-center gap-1.5 w-full px-3 py-1.5 text-xs text-destructive hover:bg-destructive/10"
          >
            <X className="w-3 h-3" />
            הסר שיבוץ
          </button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/shibutz/guard-picker.tsx
git commit -m "feat(shibutz): add GuardPicker floating dropdown"
```

---

## Task 6: AssignmentCell Component

**Files:**
- Create: `src/components/shibutz/assignment-cell.tsx`

- [ ] **Step 1: Create component**

```tsx
// src/components/shibutz/assignment-cell.tsx
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
    return <td className="border border-border bg-foreground" />
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
```

- [ ] **Step 2: Commit**

```bash
git add src/components/shibutz/assignment-cell.tsx
git commit -m "feat(shibutz): add AssignmentCell with inline GuardPicker"
```

---

## Task 7: ShiftSection Component

**Files:**
- Create: `src/components/shibutz/shift-section.tsx`

- [ ] **Step 1: Create component**

```tsx
// src/components/shibutz/shift-section.tsx
import { cn } from '@/lib/utils'
import { AssignmentCell } from './assignment-cell'
import { isClosedCell, getRowLabel, assignmentKey } from './utils'
import type { ShiftType, AssignmentMap, GuardSummary, CapacityMap } from './types'
import type { WeekDay } from './utils'

type Props = {
  shiftType: ShiftType
  weekDays: WeekDay[]
  assignments: AssignmentMap
  guards: GuardSummary[]
  capacity: CapacityMap
  scheduleId: string | null
  periodId: string
  courtId: string
}

const SHIFT_STYLES: Record<ShiftType, { header: string; label: string; emoji: string }> = {
  MORNING: { header: 'bg-[#0f4c81]', label: 'בוקר',  emoji: '☀️' },
  EVENING: { header: 'bg-[#1d4ed8]', label: 'ערב',   emoji: '🌆' },
  NIGHT:   { header: 'bg-[#4c1d95]', label: 'לילה',  emoji: '🌙' },
}

export function ShiftSection({ shiftType, weekDays, assignments, guards, capacity, scheduleId, periodId, courtId }: Props) {
  const style = SHIFT_STYLES[shiftType]
  const maxSlots = capacity[shiftType]

  return (
    <div className="mb-5" dir="rtl">
      {/* Section header */}
      <div className={cn('flex items-center gap-2 px-3 py-1.5 rounded-t-lg text-white font-bold text-sm', style.header)}>
        <span>{style.emoji}</span>
        <span>{style.label}</span>
      </div>

      {/* RTL table: first <th>/<td> in HTML = rightmost on screen */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse bg-white border border-border border-t-0 rounded-b-lg text-xs" dir="rtl">
          <thead>
            <tr>
              <th className={cn('w-7 px-1 py-1 border border-border text-white font-semibold', style.header)}>#</th>
              <th className={cn('w-14 px-1 py-1 border border-border text-white font-semibold whitespace-nowrap', style.header)}>משמרת</th>
              {weekDays.map(day => (
                <th
                  key={day.iso}
                  className={cn('w-[62px] min-w-[62px] px-1 py-0.5 border border-border text-white text-center', style.header)}
                >
                  <div className="font-bold text-[13px]">{day.letter}</div>
                  <div className="text-[10px] font-normal opacity-70">{day.label}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: maxSlots }, (_, slotIndex) => {
              const rowLabel = getRowLabel(shiftType, slotIndex)
              const isSpecial = slotIndex < 3 && shiftType === 'MORNING'
                || slotIndex < 2 && shiftType === 'EVENING'
                || slotIndex < 1 && shiftType === 'NIGHT'

              return (
                <tr
                  key={slotIndex}
                  className={cn(
                    slotIndex === 0 && 'bg-yellow-50',
                    slotIndex === 1 && shiftType === 'MORNING' && 'bg-green-50',
                    slotIndex % 2 !== 0 && !isSpecial && 'bg-muted/20',
                  )}
                >
                  <td className="w-7 px-1 text-center border border-border text-muted-foreground font-semibold bg-muted/30">
                    {slotIndex + 1}
                  </td>
                  <td className={cn(
                    'w-14 px-1 text-center border border-border bg-muted/30 whitespace-nowrap text-[11px]',
                    isSpecial ? 'font-bold text-foreground' : 'font-medium text-muted-foreground'
                  )}>
                    {rowLabel}
                  </td>
                  {weekDays.map(day => {
                    const key = assignmentKey(day.iso, shiftType)
                    const slotAssignments = assignments[key] ?? []
                    const assignment = slotAssignments[slotIndex] ?? null
                    const isOpening = shiftType === 'MORNING' && slotIndex === 0

                    return (
                      <AssignmentCell
                        key={day.iso}
                        closed={isClosedCell(day.dayOfWeek, shiftType)}
                        assignment={assignment}
                        guards={guards}
                        scheduleId={scheduleId}
                        periodId={periodId}
                        courtId={courtId}
                        date={day.iso}
                        shiftType={shiftType}
                        isOpeningDuty={isOpening}
                      />
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/shibutz/shift-section.tsx
git commit -m "feat(shibutz): add ShiftSection RTL table"
```

---

## Task 8: ShibutzGrid Client Component

**Files:**
- Create: `src/components/shibutz/shibutz-grid.tsx`

- [ ] **Step 1: Create component**

```tsx
// src/components/shibutz/shibutz-grid.tsx
'use client'

import { useState } from 'react'
import { WeekNavigator } from './week-navigator'
import { ShiftSection } from './shift-section'
import { buildWeekDays } from './utils'
import type { ShibutzGridProps } from './types'

export function ShibutzGrid({
  periodId, periodName, startDate, scheduleId,
  assignments, guards, capacity, courtId,
}: ShibutzGridProps) {
  const [weekIndex, setWeekIndex] = useState(0)
  const weekDays = buildWeekDays(startDate, weekIndex)

  // Build human-readable week range labels
  function weekRangeLabel(idx: number): string {
    const days = buildWeekDays(startDate, idx)
    return `${days[0].label}–${days[6].label}`
  }

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-2xl font-bold">שיבוץ</h1>
        <p className="text-sm text-muted-foreground">{periodName}</p>
      </div>

      <WeekNavigator
        weekIndex={weekIndex}
        onWeekChange={setWeekIndex}
        week0Label={`שבוע א׳ — ${weekRangeLabel(0)}`}
        week1Label={`שבוע ב׳ — ${weekRangeLabel(1)}`}
      />

      <ShiftSection
        shiftType="MORNING"
        weekDays={weekDays}
        assignments={assignments}
        guards={guards}
        capacity={capacity}
        scheduleId={scheduleId}
        periodId={periodId}
        courtId={courtId}
      />
      <ShiftSection
        shiftType="EVENING"
        weekDays={weekDays}
        assignments={assignments}
        guards={guards}
        capacity={capacity}
        scheduleId={scheduleId}
        periodId={periodId}
        courtId={courtId}
      />
      <ShiftSection
        shiftType="NIGHT"
        weekDays={weekDays}
        assignments={assignments}
        guards={guards}
        capacity={capacity}
        scheduleId={scheduleId}
        periodId={periodId}
        courtId={courtId}
      />
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/shibutz/shibutz-grid.tsx
git commit -m "feat(shibutz): add ShibutzGrid client component"
```

---

## Task 9: Page Server Component (Data Fetching)

**Files:**
- Modify: `src/app/(manager)/manager/shibutz/page.tsx`

- [ ] **Step 1: Replace page with full data-fetching server component**

```tsx
// src/app/(manager)/manager/shibutz/page.tsx
import { requireSession } from '@/lib/auth-helpers'
import { Role } from '@/generated/prisma/client'
import { prisma } from '@/lib/db/client'
import { getCurrentSchedulingPeriod } from '@/lib/periods/current-scheduling-period'
import { ShibutzGrid } from '@/components/shibutz/shibutz-grid'
import type { AssignmentMap, CapacityMap } from '@/components/shibutz/types'

const DEFAULT_CAPACITY: CapacityMap = { MORNING: 15, EVENING: 6, NIGHT: 3 }

export default async function ManagerShibutzPage() {
  const session = await requireSession(Role.MANAGER)
  const courtId = session.user.primaryCourtId ?? ''

  // 1. Current period
  const periodRow = await getCurrentSchedulingPeriod()
  if (!periodRow) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">שיבוץ</h1>
        <p className="text-sm text-muted-foreground">אין תקופת תזמון פעילה.</p>
      </div>
    )
  }

  // 2. Latest schedule for this period
  const scheduleRow = await prisma.schedule.findFirst({
    where: { periodId: periodRow.id },
    orderBy: { generatedAt: 'desc' },
  })

  // 3. Assignments for that schedule
  const rawAssignments = scheduleRow
    ? await prisma.shiftAssignment.findMany({
        where: { scheduleId: scheduleRow.id },
        include: { user: { select: { name: true } } },
        orderBy: { createdAt: 'asc' },
      })
    : []

  // 4. Build AssignmentMap
  const assignments: AssignmentMap = {}
  for (const a of rawAssignments) {
    const iso = a.date.toISOString().slice(0, 10)
    const key = `${iso}-${a.shiftType}`
    if (!assignments[key]) assignments[key] = []
    assignments[key].push({
      id: a.id,
      userId: a.userId,
      userName: a.user.name,
      isOpeningDuty: a.isOpeningDuty,
    })
  }

  // 5. Active guards
  const guards = await prisma.user.findMany({
    where: { role: 'GUARD', isActive: true },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  })

  // 6. Capacity rules (per shift type for manager's court, fallback to defaults)
  const capacityRules = courtId
    ? await prisma.shiftCapacityRule.findMany({ where: { courtId } })
    : []

  const capacity: CapacityMap = { ...DEFAULT_CAPACITY }
  for (const rule of capacityRules) {
    if (rule.dayOfWeek === null) {
      capacity[rule.shiftType] = rule.maxStaff
    }
  }

  // Serialise Date → ISO string for client component
  const startDate = periodRow.startDate.toISOString().slice(0, 10)

  return (
    <ShibutzGrid
      periodId={periodRow.id}
      periodName={periodRow.name}
      startDate={startDate}
      endDate={periodRow.endDate.toISOString().slice(0, 10)}
      scheduleId={scheduleRow?.id ?? null}
      assignments={assignments}
      guards={guards}
      capacity={capacity}
      courtId={courtId}
    />
  )
}
```

- [ ] **Step 2: Run TypeScript check**

```bash
npx tsc --noEmit
```

Fix any type errors before continuing.

- [ ] **Step 3: Run existing tests to check for regressions**

```bash
npx vitest run
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/app/(manager)/manager/shibutz/page.tsx
git commit -m "feat(shibutz): wire up data-fetching server component"
```

---

## Task 10: Manual Smoke Test

- [ ] Start the dev server: `npm run dev`
- [ ] Log in as a MANAGER user and navigate to `/manager/shibutz`
- [ ] Verify the 14-day period grid renders with correct RTL column order (א on right, ש on left)
- [ ] Verify black cells appear on Saturday columns and Friday NIGHT column
- [ ] Click an empty cell → GuardPicker opens, shows guard list, search filters correctly
- [ ] Assign a guard → cell shows guard name, picker closes
- [ ] Click a filled cell → reassign to different guard → cell updates
- [ ] Click a filled cell → click "הסר שיבוץ" → cell clears
- [ ] Click `‹` → switches to week 2 (days 8–14), correct dates shown
- [ ] Click `›` → returns to week 1

- [ ] **Final commit**

```bash
git add -A
git commit -m "feat(shibutz): complete interactive schedule grid"
```
