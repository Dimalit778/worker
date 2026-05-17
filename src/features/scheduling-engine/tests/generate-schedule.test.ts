import { describe, it, expect } from "vitest";
import { generateSchedule } from "../generate-schedule";
import { EngineAssignment, EngineCapacity, EngineEmployee, EngineInput } from "../types";

// ─── Shared constants ─────────────────────────────────────────────────────────

// Jan 1–14 2024. Jan 1=Mon, Jan 5=Fri, Jan 6=Sat.
const WEEK1 = [
  new Date("2024-01-01T00:00:00.000Z"),
  new Date("2024-01-02T00:00:00.000Z"),
  new Date("2024-01-03T00:00:00.000Z"),
  new Date("2024-01-04T00:00:00.000Z"),
  new Date("2024-01-05T00:00:00.000Z"),
  new Date("2024-01-06T00:00:00.000Z"),
  new Date("2024-01-07T00:00:00.000Z"),
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

const ALL_DATES = [...WEEK1, ...WEEK2];
const COURT = "court1";
const POSITION = "pos1";
const POSITION_NAME = "מאבטח";
const AHMASH_POSITION = "pos-ahmash";
const BAKAR_POSITION = "pos-bakar";
const AHMASH_POSITION_NAME = "אחמ״ש";
const BAKAR_POSITION_NAME = "בקר";

// Capacities: 2 slots per MORNING/EVENING per day so two employees can both be
// assigned on the same date, satisfying minimums without conflict.
const CAPACITIES_2: EngineCapacity[] = [
  { positionId: POSITION, positionName: POSITION_NAME, shiftType: "MORNING", dayCategory: "WEEKDAY", amount: 2 },
  { positionId: POSITION, positionName: POSITION_NAME, shiftType: "EVENING", dayCategory: "WEEKDAY", amount: 2 },
  { positionId: POSITION, positionName: POSITION_NAME, shiftType: "MORNING", dayCategory: "FRIDAY", amount: 2 },
  { positionId: POSITION, positionName: POSITION_NAME, shiftType: "EVENING", dayCategory: "FRIDAY", amount: 2 },
  { positionId: POSITION, positionName: POSITION_NAME, shiftType: "MORNING", dayCategory: "SATURDAY", amount: 2 },
];

// Capacities: 1 slot per shift type per day (for single-employee or overflow tests).
const CAPACITIES_1: EngineCapacity[] = [
  { positionId: POSITION, positionName: POSITION_NAME, shiftType: "MORNING", dayCategory: "WEEKDAY", amount: 1 },
  { positionId: POSITION, positionName: POSITION_NAME, shiftType: "EVENING", dayCategory: "WEEKDAY", amount: 1 },
  { positionId: POSITION, positionName: POSITION_NAME, shiftType: "MORNING", dayCategory: "FRIDAY", amount: 1 },
  { positionId: POSITION, positionName: POSITION_NAME, shiftType: "EVENING", dayCategory: "FRIDAY", amount: 1 },
  { positionId: POSITION, positionName: POSITION_NAME, shiftType: "MORNING", dayCategory: "SATURDAY", amount: 1 },
];

// ─── Fixture builders ─────────────────────────────────────────────────────────

function emp(id: string): EngineEmployee {
  return { id, courtId: COURT, positionId: POSITION, positionName: POSITION_NAME, isActive: true };
}

function roleEmp(id: string, positionId: string, positionName: string): EngineEmployee {
  return { id, courtId: COURT, positionId, positionName, isActive: true };
}

function availAll(employeeId: string, dates: Date[]): Map<string, Set<string>> {
  const set = new Set<string>();
  for (const date of dates) {
    const iso = date.toISOString().slice(0, 10);
    set.add(`${iso}|MORNING`);
    set.add(`${iso}|EVENING`);
  }
  return new Map([[employeeId, set]]);
}

function mergeAvail(...maps: Map<string, Set<string>>[]): Map<string, Set<string>> {
  const result = new Map<string, Set<string>>();
  for (const m of maps) for (const [k, v] of m) result.set(k, v);
  return result;
}

function singleShiftAvail(
  employeeId: string,
  date: Date,
  shiftType: "MORNING" | "EVENING"
): Map<string, Set<string>> {
  const iso = date.toISOString().slice(0, 10);
  return new Map([[employeeId, new Set([`${iso}|${shiftType}`])]]);
}

function makeInput(
  employees: EngineEmployee[],
  availability: Map<string, Set<string>>,
  opts: {
    capacities?: EngineCapacity[];
    manualAssignments?: EngineAssignment[];
  } = {}
): EngineInput {
  return {
    period: { id: "p1", courtId: COURT, startDate: WEEK1[0], endDate: WEEK2[6] },
    week1Dates: WEEK1,
    week2Dates: WEEK2,
    employees,
    availability,
    capacities: opts.capacities ?? CAPACITIES_2,
    manualAssignments: opts.manualAssignments ?? [],
    scheduleId: "s1",
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("generateSchedule", () => {
  it("full run with staffed roles and generous availability returns no ERROR warnings", () => {
    const employees = [
      roleEmp("ahmash", AHMASH_POSITION, AHMASH_POSITION_NAME),
      roleEmp("bakar", BAKAR_POSITION, BAKAR_POSITION_NAME),
      emp("guard1"),
      emp("guard2"),
      emp("guard3"),
    ];
    const availability = mergeAvail(...employees.map((employee) => availAll(employee.id, ALL_DATES)));
    const capacities: EngineCapacity[] = [
      {
        positionId: AHMASH_POSITION,
        positionName: AHMASH_POSITION_NAME,
        shiftType: "MORNING",
        dayCategory: "WEEKDAY",
        amount: 1,
      },
      {
        positionId: BAKAR_POSITION,
        positionName: BAKAR_POSITION_NAME,
        shiftType: "MORNING",
        dayCategory: "WEEKDAY",
        amount: 1,
      },
      {
        positionId: POSITION,
        positionName: POSITION_NAME,
        shiftType: "MORNING",
        dayCategory: "WEEKDAY",
        amount: 3,
      },
      {
        positionId: AHMASH_POSITION,
        positionName: AHMASH_POSITION_NAME,
        shiftType: "EVENING",
        dayCategory: "WEEKDAY",
        amount: 1,
      },
      {
        positionId: POSITION,
        positionName: POSITION_NAME,
        shiftType: "EVENING",
        dayCategory: "WEEKDAY",
        amount: 2,
      },
      {
        positionId: AHMASH_POSITION,
        positionName: AHMASH_POSITION_NAME,
        shiftType: "MORNING",
        dayCategory: "FRIDAY",
        amount: 1,
      },
      {
        positionId: POSITION,
        positionName: POSITION_NAME,
        shiftType: "MORNING",
        dayCategory: "FRIDAY",
        amount: 1,
      },
      {
        positionId: POSITION,
        positionName: POSITION_NAME,
        shiftType: "EVENING",
        dayCategory: "FRIDAY",
        amount: 1,
      },
      {
        positionId: POSITION,
        positionName: POSITION_NAME,
        shiftType: "MORNING",
        dayCategory: "SATURDAY",
        amount: 1,
      },
    ];
    const output = generateSchedule(makeInput(employees, availability, { capacities }));

    const errors = output.warnings.filter((w) => w.severity === "ERROR");
    expect(errors).toHaveLength(0);
    expect(output.assignments.length).toBeGreaterThan(0);
  });

  it("returns MIN_NOT_MET ERROR when employee cannot reach weekly MORNING minimum", () => {
    const e1 = emp("emp1");
    // Employee available for only 1 MORNING in week 1 (minimum is 2)
    const availability = singleShiftAvail("emp1", WEEK1[0], "MORNING");
    const output = generateSchedule(makeInput([e1], availability));

    const minErrors = output.warnings.filter((w) => w.type === "MIN_NOT_MET");
    expect(minErrors.length).toBeGreaterThan(0);
    expect(minErrors.every((w) => w.severity === "ERROR")).toBe(true);
  });

  it("returns UNFILLED ERROR when a required slot has no available employee", () => {
    const e1 = emp("emp1");
    // Employee has no availability at all
    const output = generateSchedule(makeInput([e1], new Map()));

    const unfilledErrors = output.warnings.filter(
      (w) => w.type === "UNFILLED" && w.severity === "ERROR"
    );
    expect(unfilledErrors.length).toBeGreaterThan(0);
  });

  it("manual assignments are not included in output.assignments", () => {
    const e1 = emp("emp1");
    const manualDate = WEEK1[0];
    const manualA: EngineAssignment = {
      employeeId: "emp1",
      courtId: COURT,
      positionId: POSITION,
      positionName: POSITION_NAME,
      date: manualDate,
      shiftType: "MORNING",
      slotIndex: 0,
      isManualOverride: true,
    };
    const availability = availAll("emp1", ALL_DATES);
    const output = generateSchedule(
      makeInput([e1], availability, { manualAssignments: [manualA] })
    );

    // output.assignments must contain only auto-generated entries
    expect(output.assignments.every((a) => !a.isManualOverride)).toBe(true);
  });

  it("manual assignment counts toward weekly minimum and reduces auto-assignments needed", () => {
    const e1 = emp("emp1");
    // Manual covers 1 MORNING in week 1; employee available for exactly 1 more
    const manualDate = WEEK1[0];
    const manualA: EngineAssignment = {
      employeeId: "emp1",
      courtId: COURT,
      positionId: POSITION,
      positionName: POSITION_NAME,
      date: manualDate,
      shiftType: "MORNING",
      slotIndex: 0,
      isManualOverride: true,
    };
    // Available for week 1 days except Jan 1 (already covered by manual)
    const set = new Set<string>();
    for (const date of WEEK1.slice(1)) set.add(`${date.toISOString().slice(0, 10)}|MORNING`);
    for (const date of ALL_DATES) set.add(`${date.toISOString().slice(0, 10)}|EVENING`);
    const availability = new Map([["emp1", set]]);

    const output = generateSchedule(
      makeInput([e1], availability, {
        capacities: CAPACITIES_1,
        manualAssignments: [manualA],
      })
    );

    // week 1 MORNING unmet should not appear (manual + 1 auto = 2)
    const week1MorningErrors = output.warnings.filter(
      (w) =>
        w.type === "MIN_NOT_MET" &&
        w.employeeId === "emp1" &&
        w.shiftType === "MORNING" &&
        w.message.startsWith("Week 1:")
    );
    // Cannot have MIN_NOT_MET for MORNING in week 1 since manual + 1 auto satisfies it
    const autoWeek1Mornings = output.assignments.filter(
      (a) =>
        a.shiftType === "MORNING" &&
        WEEK1.some((d) => d.getTime() === a.date.getTime())
    );
    expect(autoWeek1Mornings.length).toBeGreaterThanOrEqual(1);
    expect(week1MorningErrors).toHaveLength(0);
  });

  it("no auto-generated assignment violates double-booking", () => {
    const e1 = emp("emp1");
    const e2 = emp("emp2");
    const availability = mergeAvail(availAll("emp1", ALL_DATES), availAll("emp2", ALL_DATES));
    const output = generateSchedule(makeInput([e1, e2], availability));

    for (const a of output.assignments) {
      const duplicates = output.assignments.filter(
        (b) =>
          b.employeeId === a.employeeId &&
          b.shiftType === a.shiftType &&
          b.date.getTime() === a.date.getTime()
      );
      expect(duplicates).toHaveLength(1);
    }
  });

  it("no auto-generated assignment exceeds slot capacity", () => {
    const e1 = emp("emp1");
    const e2 = emp("emp2");
    const availability = mergeAvail(availAll("emp1", ALL_DATES), availAll("emp2", ALL_DATES));
    const output = generateSchedule(makeInput([e1, e2], availability, { capacities: CAPACITIES_1 }));

    // With capacity 1, each (positionId + date + shiftType) should appear at most once
    const slotKeys = output.assignments.map(
      (a) => `${a.positionId}|${a.date.getTime()}|${a.shiftType}`
    );
    const unique = new Set(slotKeys);
    expect(slotKeys.length).toBe(unique.size);
  });

  it("overflow candidates include eligible employees not assigned because capacity was full", () => {
    // Two employees available for same single slot; capacity = 1 → only one assigned
    const e1 = emp("emp-1");
    const e2 = emp("emp-2");
    const targetDate = WEEK1[2]; // Wed Jan 3 (WEEKDAY) — no rest-rule complications

    const availability = mergeAvail(
      singleShiftAvail("emp-1", targetDate, "MORNING"),
      singleShiftAvail("emp-2", targetDate, "MORNING")
    );

    const capacities: EngineCapacity[] = [
      { positionId: POSITION, positionName: POSITION_NAME, shiftType: "MORNING", dayCategory: "WEEKDAY", amount: 1 },
    ];

    const output = generateSchedule(makeInput([e1, e2], availability, { capacities }));

    const slotAssigned = output.assignments.filter(
      (a) => a.date.getTime() === targetDate.getTime() && a.shiftType === "MORNING"
    );
    const slotOverflow = output.overflowCandidates.filter(
      (oc) => oc.date.getTime() === targetDate.getTime() && oc.shiftType === "MORNING"
    );

    expect(slotAssigned).toHaveLength(1);
    expect(slotOverflow).toHaveLength(1);
    expect(slotOverflow[0].reason).toBe("CAPACITY_FULL");
  });
});
