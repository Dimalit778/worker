import { DayCategory, EngineCapacity, EngineDateOverride, EngineInput, EngineSlot, ShiftType } from "./types";

// ─── Priority tables ──────────────────────────────────────────────────────────

const DAY_CATEGORY_PRIORITY: Record<DayCategory, number> = {
  SATURDAY: 0,
  FRIDAY: 1,
  HOLIDAY: 2,
  WEEKDAY: 3,
};

const SHIFT_TYPE_PRIORITY: Record<ShiftType, number> = {
  NIGHT: 0,
  MORNING: 1,
  EVENING: 2,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Returns "YYYY-MM-DD" from a UTC date. Consistent with the availability map
// key format used in EngineInput.
export function createDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// Returns a unique string key for a slot. Used to track fill counts in maps.
export function createSlotKey(slot: Pick<EngineSlot, 'facilityId' | 'positionId' | 'date' | 'shiftType'>): string {
  return `${slot.facilityId}|${slot.positionId}|${createDateKey(slot.date)}|${slot.shiftType}`;
}

// Determines day category from a UTC date.
// HOLIDAY is supported as a type but not inferred here; callers must supply
// holiday dates explicitly via capacity rules (MVP does not auto-detect holidays).
export function getDayCategory(date: Date): DayCategory {
  const day = date.getUTCDay(); // 0=Sun, 1=Mon, … 5=Fri, 6=Sat
  if (day === 6) return "SATURDAY";
  if (day === 5) return "FRIDAY";
  return "WEEKDAY";
}

// ─── Requirement resolution ───────────────────────────────────────────────────

export interface ResolvedRequirement {
  positionId: string;
  positionName?: string;
  requiredRank: number;
  shiftType: ShiftType;
  amount: number;
  isDateOverride: boolean;
}

// Required headcount per shift × position on one date: day-category rules,
// with any date override replacing (or adding) the matching shift × position.
export function resolveRequirementsForDate(
  capacities: EngineCapacity[],
  dateOverrides: EngineDateOverride[] | undefined,
  date: Date,
  dayCategory: DayCategory = getDayCategory(date)
): ResolvedRequirement[] {
  const dateKey = createDateKey(date);
  const resolved = new Map<string, ResolvedRequirement>();
  for (const capacity of capacities) {
    if (capacity.dayCategory !== dayCategory) continue;
    resolved.set(`${capacity.shiftType}|${capacity.positionId}`, {
      positionId: capacity.positionId,
      positionName: capacity.positionName,
      requiredRank: capacity.requiredRank,
      shiftType: capacity.shiftType,
      amount: capacity.amount,
      isDateOverride: false,
    });
  }
  for (const override of dateOverrides ?? []) {
    if (override.date !== dateKey) continue;
    resolved.set(`${override.shiftType}|${override.positionId}`, {
      positionId: override.positionId,
      positionName: override.positionName,
      requiredRank: override.requiredRank,
      shiftType: override.shiftType,
      amount: override.amount,
      isDateOverride: true,
    });
  }
  return [...resolved.values()];
}

// Required rank of a position, from regular rules or date overrides.
export function findRequiredRank(input: Pick<EngineInput, "capacities" | "dateOverrides">, positionId: string): number | undefined {
  return (
    input.capacities.find((c) => c.positionId === positionId)?.requiredRank ??
    input.dateOverrides?.find((o) => o.positionId === positionId)?.requiredRank
  );
}

// ─── Slot generation ──────────────────────────────────────────────────────────

// Builds the full list of EngineSlot[] from the period dates and capacity rules.
// One slot is created per (date × resolved requirement) with amount > 0; date
// overrides replace the day-category amount for their date, shift and position.
export function buildSlots(input: EngineInput): EngineSlot[] {
  const allDates = [...input.week1Dates, ...input.week2Dates];
  const slots: EngineSlot[] = [];

  for (const date of allDates) {
    const dayCategory = input.holidayCategories?.get(createDateKey(date)) ?? getDayCategory(date);
    for (const requirement of resolveRequirementsForDate(input.capacities, input.dateOverrides, date, dayCategory)) {
      if (requirement.amount > 0) {
        slots.push({
          facilityId: input.period.facilityId,
          positionId: requirement.positionId,
          positionName: requirement.positionName,
          requiredRank: requirement.requiredRank,
          date,
          shiftType: requirement.shiftType,
          dayCategory,
          requiredAmount: requirement.amount,
          ...(requirement.isDateOverride ? { isDateOverride: true } : {}),
        });
      }
    }
  }

  return slots;
}

// Sorts slots by fill priority so the engine tackles the hardest-to-fill
// slots first. Primary key: day category (SATURDAY → FRIDAY → HOLIDAY → WEEKDAY).
// Secondary key: shift type (NIGHT → MORNING → EVENING).
// Tertiary key: date ascending (earlier dates first within same priority group).
export function sortSlotsByPriority(slots: EngineSlot[]): EngineSlot[] {
  return [...slots].sort((a, b) => {
    const dayDiff =
      DAY_CATEGORY_PRIORITY[a.dayCategory] -
      DAY_CATEGORY_PRIORITY[b.dayCategory];
    if (dayDiff !== 0) return dayDiff;

    const shiftDiff =
      SHIFT_TYPE_PRIORITY[a.shiftType] - SHIFT_TYPE_PRIORITY[b.shiftType];
    if (shiftDiff !== 0) return shiftDiff;

    const dateDiff = a.date.getTime() - b.date.getTime();
    if (dateDiff !== 0) return dateDiff;

    return a.requiredRank - b.requiredRank;
  });
}
