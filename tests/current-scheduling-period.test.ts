import { describe, it, expect } from 'vitest'
import {
  calendarDateISO,
  parseISODateToUtcMidnight,
  todayUtcDateForTimeZone,
  utcNoonFromCalendarISO,
} from '@/lib/periods/current-scheduling-period'

describe('parseISODateToUtcMidnight', () => {
  it('maps YYYY-MM-DD to UTC midnight of that civil date', () => {
    const d = parseISODateToUtcMidnight('2026-04-14')
    expect(d.getUTCFullYear()).toBe(2026)
    expect(d.getUTCMonth()).toBe(3)
    expect(d.getUTCDate()).toBe(14)
    expect(d.getUTCHours()).toBe(0)
  })

  it('throws on invalid input', () => {
    expect(() => parseISODateToUtcMidnight('')).toThrow()
    expect(() => parseISODateToUtcMidnight('not-a-date')).toThrow()
  })
})

describe('calendarDateISO', () => {
  it('returns the calendar date in UTC for an instant', () => {
    const instant = new Date(Date.UTC(2026, 3, 14, 15, 30, 0))
    expect(calendarDateISO(instant, 'UTC')).toBe('2026-04-14')
  })
})

describe('todayUtcDateForTimeZone', () => {
  it('returns UTC midnight for the calendar today in the given zone', () => {
    const fixed = new Date(Date.UTC(2026, 3, 14, 12, 0, 0))
    const t = todayUtcDateForTimeZone('UTC', fixed)
    expect(t.getTime()).toBe(parseISODateToUtcMidnight('2026-04-14').getTime())
  })
})

describe('utcNoonFromCalendarISO', () => {
  it('returns 12:00 UTC on the given civil date', () => {
    const d = utcNoonFromCalendarISO('2026-04-14')
    expect(d.getUTCHours()).toBe(12)
    expect(d.getUTCDate()).toBe(14)
  })
})
