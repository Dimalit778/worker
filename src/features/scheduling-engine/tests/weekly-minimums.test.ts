import { describe, it, expect } from "vitest";
import { assignWeeklyMinimums } from "../weekly-minimums";
import { buildSlots } from "../slots";
import { EngineAssignment, EngineCapacity, EngineEmployee, EngineInput } from "../types";

// ─── Shared constants ─────────────────────────────────────────────────────────

// Jan 1–7 2024: Mon–Sun (Mon=WEEKDAY, Fri=FRIDAY, Sat=SATURDAY, Sun=WEEKDAY)
const WEEK1 = [
  new Date("2024-01-01T00:00:00.000Z"), // Mon WEEKDAY
  new Date("2024-01-02T00:00:00.000Z"), // Tue WEEKDAY
  new Date("2024-01-03T00:00:00.000Z"), // Wed WEEKDAY
  new Date("2024-01-04T00:00:00.000Z"), // Thu WEEKDAY
  new Date("2024-01-05T00:00:00.000Z"), // Fri FRIDAY
  new Date("2024-01-06T00:00:00.000Z"), // Sat SATURDAY
  new Date("2024-01-07T00:00:00.000Z"), // Sun WEEKDAY
];

const WEEK2 = [
  new Date("2024-01-08T00:00:00.000Z"),
  new Date("2024-01-09T00:00:00.000Z"),
  new Date("2024-01-10T00:00:00.000Z"),
  new Date("2024-01-11T00:00:00.000Z"),
  new Date("2024-01-12T00:00:00.000Z"),
  new Date("2024-01-13T00:00:00.000Z"),
  new Date("2024-01-14T00:00:00.000Z"),
];

const COURT = "court1";
const POSITION = "pos1";

// Provides 1 MORNING and 1 EVENING slot per day (across day categories).
const BASE_CAPACITIES: EngineCapacity[] = [
  { positionId: POSITION, shiftType: "MORNING", dayCategory: "WEEKDAY", amount: 1 },
  { positionId: POSITION, shiftType: "EVENING", dayCategory: "WEEKDAY", amount: 1 },
  { positionId: POSITION, shiftType: "MORNING", dayCategory: "FRIDAY", amount: 1 },
  { positionId: POSITION, shiftType: "EVENING", dayCategory: "FRIDAY", amount: 1 },
  { positionId: POSITION, shiftType: "MORNING", dayCategory: "SATURDAY", amount: 1 },
];

// ─── Fixture builders ─────────────────────────────────────────────────────────

function emp(id: string): EngineEmployee {
  return { id, courtId: COURT, positionId: POSITION, isActive: true };
}

function availAll(employeeId: string, dates: Date[]): Map<string, Set<string>> {
  const set = new Set<string>();
  for (const date of dates) {
    const iso = date.toISOString().slice(0, 10);
    set.add(`${iso}|MORNING`);
    set.add(`${iso}|EVENING`);
    set.add(`${iso}|NIGHT`);
  }
  return new Map([[employeeId, set]]);
}

function availShifts(
  employeeId: string,
  entries: Array<{ date: Date; shifts: Array<"MORNING" | "EVENING" | "NIGHT"> }>
): Map<string, Set<string>> {
  const set = new Set<string>();
  for (const { date, shifts } of entries) {
    const iso = date.toISOString().slice(0, 10);
    for (const shift of shifts) set.add(`${iso}|${shift}`);
  }
  return new Map([[employeeId, set]]);
}

function makeInput(
  employees: EngineEmployee[],
  availability: Map<string, Set<string>>,
  manualAssignments: EngineAssignment[] = [],
  capacities: EngineCapacity[] = BASE_CAPACITIES
): EngineInput {
  return {
    period: { id: "p1", courtId: COURT, startDate: WEEK1[0], endDate: WEEK2[6] },
    week1Dates: WEEK1,
    week2Dates: WEEK2,
    employees,
    availability,
    capacities,
    manualAssignments,
    scheduleId: "s1",
  };
}

function manual(
  employeeId: string,
  date: Date,
  shiftType: "MORNING" | "EVENING" | "NIGHT"
): EngineAssignment {
  return {
    employeeId,
    courtId: COURT,
    positionId: POSITION,
    date,
    shiftType,
    slotIndex: 0,
    isManualOverride: true,
  };
}

function countWeek(
  assignments: EngineAssignment[],
  employeeId: string,
  shiftType: "MORNING" | "EVENING" | "NIGHT",
  weekDates: Date[]
): number {
  const times = new Set(weekDates.map((d) => d.getTime()));
  return assignments.filter(
    (a) => a.employeeId === employeeId && a.shiftType === shiftType && times.has(a.date.getTime())
  ).length;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("assignWeeklyMinimums", () => {
  it("assigns 2 MORNING + 1 EVENING in week 1 when availability is generous", () => {
    const employee = emp("emp1");
    const input = makeInput([employee], availAll("emp1", [...WEEK1, ...WEEK2]));
    const slots = buildSlots(input);

    const { newAssignments, unmetMinimums } = assignWeeklyMinimums(
      input,
      slots,
      new Map(),
      []
    );

    expect(countWeek(newAssignments, "emp1", "MORNING", WEEK1)).toBeGreaterThanOrEqual(2);
    expect(countWeek(newAssignments, "emp1", "EVENING", WEEK1)).toBeGreaterThanOrEqual(1);
    expect(unmetMinimums.filter((u) => u.weekNumber === 1)).toHaveLength(0);
  });

  it("manual MORNING counts toward minimum so only 1 more is assigned", () => {
    const employee = emp("emp1");
    // 1 manual MORNING on Jan 1; available for exactly 1 more MORNING on Jan 2
    const manualAssignment = manual("emp1", WEEK1[0], "MORNING");
    const availability = availShifts("emp1", [
      { date: WEEK1[1], shifts: ["MORNING", "EVENING"] },
      ...WEEK2.map((date) => ({ date, shifts: ["MORNING" as const, "EVENING" as const] })),
    ]);
    const input = makeInput([employee], availability, [manualAssignment]);
    const slots = buildSlots(input);

    const { newAssignments, unmetMinimums } = assignWeeklyMinimums(
      input,
      slots,
      new Map(),
      [manualAssignment]
    );

    // Manual (not in newAssignments) + 1 auto = 2 total MORNING for week 1
    const autoWeek1Mornings = countWeek(newAssignments, "emp1", "MORNING", WEEK1);
    expect(autoWeek1Mornings).toBe(1);
    expect(unmetMinimums.filter((u) => u.weekNumber === 1 && u.shiftType === "MORNING")).toHaveLength(0);
  });

  it("returns UnmetMinimum when employee has only 1 available MORNING in week 1", () => {
    const employee = emp("emp1");
    // Only 1 morning slot available in week 1 (minimum is 2)
    const availability = availShifts("emp1", [
      { date: WEEK1[0], shifts: ["MORNING", "EVENING"] },
      ...WEEK2.map((date) => ({ date, shifts: ["MORNING" as const, "EVENING" as const] })),
    ]);
    const input = makeInput([employee], availability);
    const slots = buildSlots(input);

    const { unmetMinimums } = assignWeeklyMinimums(input, slots, new Map(), []);

    const unmet = unmetMinimums.filter(
      (u) => u.employeeId === "emp1" && u.weekNumber === 1 && u.shiftType === "MORNING"
    );
    expect(unmet).toHaveLength(1);
    expect(unmet[0].required).toBe(2);
    expect(unmet[0].actual).toBe(1);
  });

  it("evaluates week 1 and week 2 independently", () => {
    const employee = emp("emp1");
    // Available for all of week 1 but no MORNING in week 2
    const availability = availShifts("emp1", [
      ...WEEK1.map((date) => ({ date, shifts: ["MORNING" as const, "EVENING" as const] })),
      ...WEEK2.map((date) => ({ date, shifts: ["EVENING" as const] })), // only EVENING in week 2
    ]);
    const input = makeInput([employee], availability);
    const slots = buildSlots(input);

    const { unmetMinimums } = assignWeeklyMinimums(input, slots, new Map(), []);

    // Week 1 should be satisfied
    expect(unmetMinimums.filter((u) => u.weekNumber === 1)).toHaveLength(0);
    // Week 2 MORNING should be unmet
    const week2Morning = unmetMinimums.filter((u) => u.weekNumber === 2 && u.shiftType === "MORNING");
    expect(week2Morning).toHaveLength(1);
    expect(week2Morning[0].required).toBe(2);
    expect(week2Morning[0].actual).toBe(0);
  });

  it("does not mutate the input assignments array", () => {
    const employee = emp("emp1");
    const input = makeInput([employee], availAll("emp1", [...WEEK1, ...WEEK2]));
    const slots = buildSlots(input);
    const initial: EngineAssignment[] = [];

    assignWeeklyMinimums(input, slots, new Map(), initial);

    expect(initial).toHaveLength(0);
  });
});
