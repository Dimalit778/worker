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
