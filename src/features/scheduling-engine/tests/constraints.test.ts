import { describe, it, expect } from "vitest";
import {
  isAvailable,
  isDoubleBooked,
  isEligibleForSlot,
  violatesRestRule,
} from "../constraints";
import { EngineAssignment, EngineEmployee, EngineSlot } from "../types";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function d(iso: string): Date {
  return new Date(iso + "T00:00:00.000Z");
}

function avail(entries: [string, string][]): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const [emp, key] of entries) {
    if (!map.has(emp)) map.set(emp, new Set());
    map.get(emp)!.add(key);
  }
  return map;
}

function assignment(
  partial: Pick<EngineAssignment, "employeeId" | "date" | "shiftType"> &
    Partial<EngineAssignment>
): EngineAssignment {
  return {
    facilityId: "court1",
    positionId: "pos1",
    slotIndex: 0,
    isManualOverride: false,
    ...partial,
  };
}

const SLOT: EngineSlot = {
  facilityId: "court1",
  positionId: "pos1",
  date: d("2024-01-01"),
  shiftType: "MORNING",
  requiredRank: 1, dayCategory: "WEEKDAY",
  requiredAmount: 1,
};

// ─── isAvailable ──────────────────────────────────────────────────────────────

describe("isAvailable", () => {
  it("returns true when availability contains exact date + shiftType", () => {
    const map = avail([["emp1", "2024-01-01|MORNING"]]);
    expect(isAvailable("emp1", d("2024-01-01"), "MORNING", map)).toBe(true);
  });

  it("returns false when shiftType does not match", () => {
    const map = avail([["emp1", "2024-01-01|EVENING"]]);
    expect(isAvailable("emp1", d("2024-01-01"), "MORNING", map)).toBe(false);
  });

  it("returns false when date does not match", () => {
    const map = avail([["emp1", "2024-01-02|MORNING"]]);
    expect(isAvailable("emp1", d("2024-01-01"), "MORNING", map)).toBe(false);
  });

  it("returns false when employee has no entries at all", () => {
    expect(isAvailable("emp1", d("2024-01-01"), "MORNING", new Map())).toBe(false);
  });
});

// ─── isDoubleBooked ───────────────────────────────────────────────────────────

describe("isDoubleBooked", () => {
  it("returns true for same employee + same date + same shiftType", () => {
    const a = [assignment({ employeeId: "emp1", date: d("2024-01-01"), shiftType: "MORNING" })];
    expect(isDoubleBooked("emp1", d("2024-01-01"), "MORNING", a)).toBe(true);
  });

  it("returns true for same-day MORNING + EVENING", () => {
    const a = [assignment({ employeeId: "emp1", date: d("2024-01-01"), shiftType: "EVENING" })];
    expect(isDoubleBooked("emp1", d("2024-01-01"), "MORNING", a)).toBe(true);
  });

  it("returns true for same-day EVENING + NIGHT", () => {
    const a = [assignment({ employeeId: "emp1", date: d("2024-01-01"), shiftType: "NIGHT" })];
    expect(isDoubleBooked("emp1", d("2024-01-01"), "EVENING", a)).toBe(true);
  });

  it("returns true for NIGHT + next-day MORNING", () => {
    const a = [assignment({ employeeId: "emp1", date: d("2024-01-01"), shiftType: "NIGHT" })];
    expect(isDoubleBooked("emp1", d("2024-01-02"), "MORNING", a)).toBe(true);
  });

  it("returns false for same-day MORNING + NIGHT", () => {
    const a = [assignment({ employeeId: "emp1", date: d("2024-01-01"), shiftType: "NIGHT" })];
    expect(isDoubleBooked("emp1", d("2024-01-01"), "MORNING", a)).toBe(false);
  });

  it("returns false when date differs", () => {
    const a = [assignment({ employeeId: "emp1", date: d("2024-01-02"), shiftType: "MORNING" })];
    expect(isDoubleBooked("emp1", d("2024-01-01"), "MORNING", a)).toBe(false);
  });

  it("returns false for a different employee on the same slot", () => {
    const a = [assignment({ employeeId: "emp2", date: d("2024-01-01"), shiftType: "MORNING" })];
    expect(isDoubleBooked("emp1", d("2024-01-01"), "MORNING", a)).toBe(false);
  });
});

// ─── violatesRestRule ─────────────────────────────────────────────────────────

describe("violatesRestRule", () => {
  it("MORNING on day N+1 is blocked when employee has NIGHT on day N", () => {
    const a = [assignment({ employeeId: "emp1", date: d("2024-01-01"), shiftType: "NIGHT" })];
    expect(violatesRestRule("emp1", d("2024-01-02"), "MORNING", a)).toBe(true);
  });

  it("NIGHT on day N is blocked when employee already has MORNING on day N+1", () => {
    const a = [assignment({ employeeId: "emp1", date: d("2024-01-02"), shiftType: "MORNING" })];
    expect(violatesRestRule("emp1", d("2024-01-01"), "NIGHT", a)).toBe(true);
  });

  it("EVENING is never affected by the rest rule", () => {
    const a = [assignment({ employeeId: "emp1", date: d("2024-01-01"), shiftType: "NIGHT" })];
    expect(violatesRestRule("emp1", d("2024-01-02"), "EVENING", a)).toBe(false);
  });

  it("returns false when there is no conflicting assignment", () => {
    const a = [assignment({ employeeId: "emp1", date: d("2024-01-01"), shiftType: "MORNING" })];
    expect(violatesRestRule("emp1", d("2024-01-02"), "MORNING", a)).toBe(false);
  });

  it("does not affect a different employee", () => {
    const a = [assignment({ employeeId: "emp2", date: d("2024-01-01"), shiftType: "NIGHT" })];
    expect(violatesRestRule("emp1", d("2024-01-02"), "MORNING", a)).toBe(false);
  });
});

// ─── isEligibleForSlot ────────────────────────────────────────────────────────

describe("isEligibleForSlot", () => {
  const active: EngineEmployee = { id: "emp1", facilityId: "court1", positionId: "pos1", rank: 1, isActive: true };

  it("returns true for active employee with matching facilityId and positionId", () => {
    expect(isEligibleForSlot(active, SLOT)).toBe(true);
  });

  it("returns false for inactive employee", () => {
    expect(isEligibleForSlot({ ...active, isActive: false }, SLOT)).toBe(false);
  });

  it("returns false when facilityId does not match", () => {
    expect(isEligibleForSlot({ ...active, facilityId: "court2" }, SLOT)).toBe(false);
  });

  it("returns false when required rank is more senior than the employee", () => {
    expect(isEligibleForSlot({ ...active, rank: 4 }, { ...SLOT, requiredRank: 1 })).toBe(false);
  });
});
