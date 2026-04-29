import { DayCategory, EngineInput, EngineSlot, ShiftType } from "./types";

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
export function createSlotKey(slot: EngineSlot): string {
  return `${slot.courtId}|${slot.positionId}|${createDateKey(slot.date)}|${slot.shiftType}`;
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

// ─── Slot generation ──────────────────────────────────────────────────────────

// Builds the full list of EngineSlot[] from the period dates and capacity rules.
// One slot is created per (date × capacity row) where the capacity's dayCategory
// matches the date and amount > 0.
export function buildSlots(input: EngineInput): EngineSlot[] {
  const allDates = [...input.week1Dates, ...input.week2Dates];
  const slots: EngineSlot[] = [];

  for (const date of allDates) {
    const dayCategory = getDayCategory(date);
    for (const capacity of input.capacities) {
      if (capacity.dayCategory === dayCategory && capacity.amount > 0) {
        slots.push({
          courtId: input.period.courtId,
          positionId: capacity.positionId,
          date,
          shiftType: capacity.shiftType,
          dayCategory,
          requiredAmount: capacity.amount,
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

    return a.date.getTime() - b.date.getTime();
  });
}
