'use client'
import type { Position } from '@/generated/prisma/client'

export type GuardRow = {
  id: string
  name: string
  position: Position
  isActive: boolean
  employeeNumber: string | null
}

export function GuardsTable(_: { guards: GuardRow[] }) {
  return null
}
