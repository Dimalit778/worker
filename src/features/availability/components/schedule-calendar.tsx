'use client'

import { useState, useTransition } from 'react'
import { cn } from '@/lib/utils'
import { submitAvailability } from '../actions'
import type { ShiftType } from '@/generated/prisma/client'

const SHIFTS: { key: ShiftType; label: string; bg: string; text: string; border: string }[] = [
  { key: 'MORNING', label: 'בוקר',  bg: 'bg-amber-400',   text: 'text-amber-950', border: 'border-amber-300' },
  { key: 'EVENING', label: 'ערב',   bg: 'bg-sky-500',     text: 'text-white',     border: 'border-sky-300'  },
  { key: 'NIGHT',   label: 'לילה',  bg: 'bg-indigo-700',  text: 'text-white',     border: 'border-indigo-400' },
]

const DAY_HE = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳']

function datesInRange(start: string, end: string): string[] {
  const dates: string[] = []
  const cur = new Date(`${start}T12:00:00Z`)
  const last = new Date(`${end}T12:00:00Z`)
  while (cur <= last) {
    dates.push(cur.toISOString().slice(0, 10))
    cur.setUTCDate(cur.getUTCDate() + 1)
  }
  return dates
}

export type PeriodInfo = {
  id: string
  name: string
  startDate: string
  endDate: string
  status: string
}

type Props = {
  period: PeriodInfo
  initialEntries: Record<string, boolean>
  initialSubmitted: boolean
}

export function ScheduleCalendar({ period, initialEntries, initialSubmitted }: Props) {
  const [entries, setEntries] = useState<Record<string, boolean>>(initialEntries)
  const [submitted, setSubmitted] = useState(initialSubmitted)
  const [pending, startTransition] = useTransition()

  const dates = datesInRange(period.startDate, period.endDate)
  const readonly = submitted || period.status === 'LOCKED' || period.status === 'ARCHIVED'

  // Split into two weeks for layout
  const week1 = dates.slice(0, 7)
  const week2 = dates.slice(7, 14)

  function handleToggle(date: string, shiftType: ShiftType) {
    if (readonly) return
    const key = `${date}-${shiftType}`
    setEntries(prev => ({ ...prev, [key]: !prev[key] }))
  }

  function handleSubmit() {
    startTransition(async () => {
      const res = await submitAvailability(entries)
      if (res.ok) setSubmitted(true)
    })
  }

  const selected = Object.values(entries).filter(Boolean).length

  return (
    <div className="space-y-5" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">לוח משמרות</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{period.name}</p>
        </div>
        {submitted ? (
          <span className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 bg-green-100 text-green-700 rounded-full font-medium">
            <span>✓</span> זמינות הוגשה
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">
            {selected} משמרות נבחרו
          </span>
        )}
      </div>

      {/* Legend */}
      <div className="flex gap-3 text-xs">
        {SHIFTS.map(s => (
          <div key={s.key} className="flex items-center gap-1.5">
            <span className={cn('w-3 h-3 rounded-sm', s.bg)} />
            <span>{s.label}</span>
          </div>
        ))}
      </div>

      {/* Two-week grid */}
      {[week1, week2].map((week, wi) => (
        <div key={wi} className="rounded-xl border border-border overflow-hidden bg-white shadow-sm">
          <div className="bg-muted/60 px-4 py-2 text-xs font-medium text-muted-foreground border-b border-border">
            שבוע {wi + 1}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr>
                  <th className="w-14 px-3 py-2.5 text-right font-medium border-b border-e border-border bg-muted/30 sticky right-0 z-10">
                    משמרת
                  </th>
                  {week.map(date => {
                    const d = new Date(`${date}T12:00:00Z`)
                    const [, m, day] = date.split('-')
                    const isWeekend = d.getUTCDay() === 5 || d.getUTCDay() === 6
                    return (
                      <th
                        key={date}
                        className={cn(
                          'px-1 py-2 text-center font-medium border-b border-e last:border-e-0 border-border min-w-[56px]',
                          isWeekend && 'bg-slate-50',
                        )}
                      >
                        <div className="text-muted-foreground font-normal">{DAY_HE[d.getUTCDay()]}</div>
                        <div className="font-semibold">{day}/{m}</div>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {SHIFTS.map(shift => (
                  <tr key={shift.key} className="border-b last:border-b-0 border-border">
                    <td className="px-3 py-2 font-medium text-right border-e border-border bg-muted/20 sticky right-0 z-10">
                      {shift.label}
                    </td>
                    {week.map(date => {
                      const key = `${date}-${shift.key}`
                      const on = !!entries[key]
                      const d = new Date(`${date}T12:00:00Z`)
                      const isWeekend = d.getUTCDay() === 5 || d.getUTCDay() === 6
                      return (
                        <td
                          key={date}
                          className={cn(
                            'border-e last:border-e-0 border-border p-1',
                            isWeekend && 'bg-slate-50/60',
                          )}
                        >
                          <button
                            onClick={() => handleToggle(date, shift.key)}
                            disabled={readonly}
                            title={on ? 'לחץ לביטול' : 'לחץ לבחירה'}
                            className={cn(
                              'w-full h-9 rounded-md transition-all duration-150 flex items-center justify-center',
                              on
                                ? `${shift.bg} ${shift.text} shadow-sm`
                                : 'border border-dashed border-border hover:border-solid hover:bg-muted/50',
                              readonly && 'cursor-default',
                              !readonly && !on && 'hover:scale-95',
                            )}
                          >
                            {on && (
                              <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
                                <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z" />
                              </svg>
                            )}
                          </button>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {/* Submit */}
      {!submitted && period.status === 'OPEN_FOR_SUBMISSION' && (
        <div className="flex items-center gap-3 pt-1">
          <button
            onClick={handleSubmit}
            disabled={pending || selected === 0}
            className="bg-foreground text-background text-sm px-6 py-2.5 rounded-lg font-medium hover:opacity-90 disabled:opacity-40 transition-opacity"
          >
            {pending ? 'שומר...' : 'הגש זמינות'}
          </button>
          {selected === 0 && (
            <p className="text-xs text-muted-foreground">יש לבחור לפחות משמרת אחת</p>
          )}
        </div>
      )}

      {period.status === 'LOCKED' && !submitted && (
        <p className="text-sm text-muted-foreground">התקופה נעולה — לא ניתן לשנות זמינות.</p>
      )}
    </div>
  )
}
