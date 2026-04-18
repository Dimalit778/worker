import type { PrismaClient } from '@/generated/prisma/client'
import { prisma } from '@/lib/db/client'

/** Calendar date YYYY-MM-DD for `instant` in `timeZone` (e.g. Asia/Jerusalem). */
export function calendarDateISO(instant: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant)

  const y = parts.find((p) => p.type === 'year')?.value
  const m = parts.find((p) => p.type === 'month')?.value
  const d = parts.find((p) => p.type === 'day')?.value
  if (!y || !m || !d) {
    throw new Error('calendarDateISO: missing date parts')
  }
  return `${y}-${m}-${d}`
}

/** UTC midnight for a civil YYYY-MM-DD (matches PostgreSQL `date` semantics for comparisons). */
export function parseISODateToUtcMidnight(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) {
    throw new Error(`parseISODateToUtcMidnight: invalid ISO date "${iso}"`)
  }
  return new Date(Date.UTC(y, m - 1, d))
}

/**
 * Noon UTC on the given civil date. Prefer this when binding a JS `Date` to Prisma filters on
 * `@db.Date` columns: some drivers/session time zones map midnight UTC to the previous local
 * calendar day, which breaks inclusive range checks.
 */
export function utcNoonFromCalendarISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) {
    throw new Error(`utcNoonFromCalendarISO: invalid ISO date "${iso}"`)
  }
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
}

export function todayUtcDateForTimeZone(timeZone: string, instant: Date = new Date()): Date {
  return parseISODateToUtcMidnight(calendarDateISO(instant, timeZone))
}

const DEFAULT_TZ = 'Asia/Jerusalem'

export async function getCurrentSchedulingPeriod(
  client: PrismaClient = prisma,
  options?: { timeZone?: string; now?: Date }
) {
  const timeZone = options?.timeZone ?? DEFAULT_TZ
  const now = options?.now ?? new Date()
  const today = utcNoonFromCalendarISO(calendarDateISO(now, timeZone))

  return client.schedulingPeriod.findFirst({
    where: {
      startDate: { lte: today },
      endDate: { gte: today },
    },
    orderBy: { startDate: 'desc' },
  })
}
