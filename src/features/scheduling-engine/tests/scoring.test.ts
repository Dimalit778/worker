import { describe, it, expect } from "vitest";
import { scoreCandidate, sortCandidatesByScore } from "../scoring";
import { EngineEmployee, EngineSlot, FairnessSummary } from "../types";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function emp(id: string): EngineEmployee {
  return { id, courtId: "court1", positionId: "pos1", positionName: "מאבטח", isActive: true };
}

function fairness(
  employeeId: string,
  overrides: Partial<Omit<FairnessSummary, "employeeId">> = {}
): FairnessSummary {
  return {
    employeeId,
    totalShifts: 0,
    morningShifts: 0,
    eveningShifts: 0,
    nightShifts: 0,
    weekendShifts: 0,
    ...overrides,
  };
}

const SLOT: EngineSlot = {
  courtId: "court1",
  positionId: "pos1",
  positionName: "מאבטח",
  date: new Date("2024-01-01T00:00:00.000Z"),
  shiftType: "MORNING",
  dayCategory: "WEEKDAY",
  requiredAmount: 1,
};

// ─── scoreCandidate ───────────────────────────────────────────────────────────

describe("scoreCandidate", () => {
  it("employee with no shifts scores 0", () => {
    expect(scoreCandidate(emp("e1"), SLOT, fairness("e1"))).toBe(0);
  });

  it("undefined fairness scores 0 (treated as all-zero)", () => {
    expect(scoreCandidate(emp("e1"), SLOT, undefined)).toBe(0);
  });

  it("more EVENING shifts produces a lower score", () => {
    const low = fairness("e1", { eveningShifts: 2 });
    const high = fairness("e1", { eveningShifts: 0 });
    expect(scoreCandidate(emp("e1"), SLOT, low)).toBeLessThan(
      scoreCandidate(emp("e1"), SLOT, high)
    );
  });

  it("more NIGHT shifts produces a lower score", () => {
    const low = fairness("e1", { nightShifts: 3 });
    const high = fairness("e1", { nightShifts: 0 });
    expect(scoreCandidate(emp("e1"), SLOT, low)).toBeLessThan(
      scoreCandidate(emp("e1"), SLOT, high)
    );
  });

  it("more weekend shifts produces a lower score", () => {
    const low = fairness("e1", { weekendShifts: 4 });
    const high = fairness("e1", { weekendShifts: 1 });
    expect(scoreCandidate(emp("e1"), SLOT, low)).toBeLessThan(
      scoreCandidate(emp("e1"), SLOT, high)
    );
  });

  it("more total shifts produces a lower score as tie-breaker", () => {
    const low = fairness("e1", { totalShifts: 10 });
    const high = fairness("e1", { totalShifts: 2 });
    expect(scoreCandidate(emp("e1"), SLOT, low)).toBeLessThan(
      scoreCandidate(emp("e1"), SLOT, high)
    );
  });
});

// ─── sortCandidatesByScore ────────────────────────────────────────────────────

describe("sortCandidatesByScore", () => {
  it("places employee with fewer EVENING shifts first", () => {
    const empA = emp("emp-a");
    const empB = emp("emp-b");
    const fm = new Map([
      ["emp-a", fairness("emp-a", { eveningShifts: 5 })],
      ["emp-b", fairness("emp-b", { eveningShifts: 1 })],
    ]);
    const [first] = sortCandidatesByScore([empA, empB], SLOT, fm);
    expect(first.id).toBe("emp-b");
  });

  it("places employee with fewer NIGHT shifts first", () => {
    const empA = emp("emp-a");
    const empB = emp("emp-b");
    const fm = new Map([
      ["emp-a", fairness("emp-a", { nightShifts: 0 })],
      ["emp-b", fairness("emp-b", { nightShifts: 4 })],
    ]);
    const [first] = sortCandidatesByScore([empA, empB], SLOT, fm);
    expect(first.id).toBe("emp-a");
  });

  it("uses alphabetical employee.id as tie-breaker when scores are equal", () => {
    // Both employees have no fairness record → score 0 each
    const empZ = emp("emp-z");
    const empA = emp("emp-a");
    const fm = new Map<string, FairnessSummary>();
    const [first] = sortCandidatesByScore([empZ, empA], SLOT, fm);
    expect(first.id).toBe("emp-a");
  });

  it("does not mutate the input array", () => {
    const candidates = [emp("emp-b"), emp("emp-a")];
    sortCandidatesByScore(candidates, SLOT, new Map());
    expect(candidates[0].id).toBe("emp-b"); // original order preserved
  });
});
