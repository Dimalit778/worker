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
