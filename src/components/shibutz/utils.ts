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
