import type { Prisma, Schedule } from '@/generated/prisma/client';
import { prisma } from '@/lib/db/client';
import { requireManager } from '@/lib/db/auth-helpers';
import { addDays } from '@/features/scheduling-engine/constraints';
import type { EngineAssignment, EngineDateOverride, EngineInput } from '@/features/scheduling-engine/types';
import { loadApprovedTimeOff } from '@/features/requests/queries';
import { applyTimeOffToAvailability } from '@/features/requests/rules';
import { customHoursOf } from '../shift-times';

// Inactive employees are loaded too: the engine skips them for new slots, while their existing slots stay editable.
const staffedUser = { role: { rank: { not: 1 } } };
const staffedPosition = {
  isActive: true,
  NOT: { OR: [{ requiredRank: 1 }, { baseRole: { rank: 1 } }] },
};

type OverrideRow = {
  date: Date; positionId: string; shiftType: EngineDateOverride['shiftType']; requiredCount: number;
  position: { name: string; requiredRank: number | null; displayOrder: number; baseRole: { rank: number } | null };
};

export function toEngineDateOverride(row: OverrideRow): EngineDateOverride {
  return {
    date: row.date.toISOString().slice(0, 10),
    positionId: row.positionId,
    positionName: row.position.name,
    requiredRank: row.position.requiredRank ?? row.position.baseRole?.rank ?? row.position.displayOrder,
    shiftType: row.shiftType,
    amount: row.requiredCount,
  };
}

export async function loadSchedulingInput(tx: Prisma.TransactionClient, scheduleId: string, facilityId: string, versionId: string | null, loadedSchedule?: Schedule) {
  const schedule = loadedSchedule ?? await tx.schedule.findFirst({ where: { id: scheduleId, facilityId } });
  if (!schedule) throw new Error('השיבוץ לא נמצא');
  const [employees, capacities, dateOverrides, forms, assignments, surrounding, timeOff] = await Promise.all([
    tx.user.findMany({ where: { facilityId, ...staffedUser }, select: { id: true, displayName: true, roleId: true, isActive: true, role: { select: { id: true, name: true, rank: true } } } }),
    tx.staffingRequirement.findMany({ where: { facilityId, position: staffedPosition }, include: { position: { include: { baseRole: true } } } }),
    tx.staffingDateOverride.findMany({
      where: { facilityId, date: { gte: schedule.startDate, lte: schedule.endDate }, position: { ...staffedPosition, OR: [{ facilityId }, { facilityId: null }] } },
      include: { position: { include: { baseRole: true } } },
      orderBy: [{ date: 'asc' }, { shiftType: 'asc' }, { position: { displayOrder: 'asc' } }],
    }),
    tx.availabilitySubmission.findMany({
      where: { scheduleId, submittedAt: { not: null }, user: { facilityId } },
      include: { availabilities: true },
    }),
    versionId ? tx.scheduleSlot.findMany({ where: { scheduleId, versionId, facilityId, userId: { not: null } }, include: { user: { select: { displayName: true } }, position: { select: { name: true } } } }) : Promise.resolve([]),
    (async () => {
      // Read slots by the live published version ids, so old versions and drafts are never scanned.
      const published = await tx.schedule.findMany({
        where: { facilityId, id: { not: scheduleId }, status: 'PUBLISHED', publishedVersionId: { not: null } },
        select: { publishedVersionId: true },
      });
      const versionIds = published.flatMap((s) => s.publishedVersionId ?? []);
      if (!versionIds.length) return [];
      return tx.scheduleSlot.findMany({
        where: {
          facilityId,
          versionId: { in: versionIds },
          userId: { not: null },
          date: { gte: addDays(schedule.startDate, -56), lte: addDays(schedule.endDate, 1) },
        },
      });
    })(),
    loadApprovedTimeOff(tx, facilityId, schedule.startDate, schedule.endDate),
  ]);
  // Slots of one employee sharing the same custom hours form one shift: the earliest is the main one.
  const shiftOrder = { MORNING: 0, EVENING: 1, NIGHT: 2 } as const;
  const customHours = new Map<string, string>();
  const extensions = new Set<string>();
  const firstOfShift = new Map<string, { id: string; rank: number }>();
  for (const slot of [...assignments, ...surrounding]) {
    if (!slot.userId || !slot.endsAt || !customHoursOf(slot.date, slot.shiftType, slot.startsAt, slot.endsAt)) continue;
    const hours = `${slot.startsAt.toISOString()}|${slot.endsAt.toISOString()}`;
    customHours.set(slot.id, hours);
    const key = `${slot.versionId}|${slot.userId}|${hours}`;
    const rank = slot.date.getTime() * 3 + shiftOrder[slot.shiftType];
    const first = firstOfShift.get(key);
    if (!first) firstOfShift.set(key, { id: slot.id, rank });
    else if (rank < first.rank) { extensions.add(first.id); firstOfShift.set(key, { id: slot.id, rank }); }
    else if (rank > first.rank) extensions.add(slot.id);
  }
  const toEngine = (a: { id: string; userId: string | null; facilityId: string; positionId: string; date: Date; shiftType: EngineAssignment['shiftType']; slotNumber: number; isLocked: boolean; source: EngineAssignment['source'] }): EngineAssignment => ({
    employeeId: a.userId ?? '',
    facilityId: a.facilityId,
    positionId: a.positionId,
    date: a.date,
    shiftType: a.shiftType,
    slotIndex: Math.max(0, a.slotNumber - 1),
    isManualOverride: a.isLocked,
    source: a.source,
    customHours: customHours.get(a.id),
    isExtension: extensions.has(a.id) || undefined,
  });
  const availability = new Map<string, Set<string>>();
  const preferences = new Map<string, Set<string>>();
  for (const form of forms) {
    availability.set(form.userId, new Set(form.availabilities.filter((s) => s.preference !== 'UNAVAILABLE').map((s) => `${s.date.toISOString().slice(0, 10)}|${s.shiftType}`)));
    preferences.set(form.userId, new Set(form.availabilities.filter((s) => s.preference === 'PREFERRED').map((s) => `${s.date.toISOString().slice(0, 10)}|${s.shiftType}`)));
  }
  // Approved vacation days count as unavailable for auto-generation.
  applyTimeOffToAvailability(availability, preferences, timeOff);
  const dates: Date[] = [];
  for (let d = schedule.startDate; d <= schedule.endDate; d = addDays(d, 1)) dates.push(d);
  const input: EngineInput = {
    scheduleId,
    period: { id: schedule.id, facilityId, startDate: schedule.startDate, endDate: schedule.endDate },
    week1Dates: dates.slice(0, 7),
    week2Dates: dates.slice(7),
    employees: employees.map((e) => ({ id: e.id, facilityId, positionId: e.roleId, rank: e.role.rank, isActive: e.isActive })),
    capacities: capacities.map((c) => ({
      positionId: c.positionId,
      positionName: c.position.name,
      requiredRank: c.position.requiredRank ?? c.position.baseRole?.rank ?? c.position.displayOrder,
      shiftType: c.shiftType,
      dayCategory: c.dayCategory,
      amount: c.requiredCount,
    })),
    dateOverrides: dateOverrides.map(toEngineDateOverride),
    availability,
    preferences,
    manualAssignments: assignments.filter((a) => a.isLocked && a.userId).map(toEngine),
    historicalAssignments: surrounding.filter((a) => a.date < schedule.startDate && a.userId).map(toEngine),
    boundaryAssignments: surrounding.filter((a) => a.date >= addDays(schedule.startDate, -1) && a.userId).map(toEngine),
    holidayCategories: new Map(),
    timeOff,
  };
  return { input, employees, capacities, dateOverrides, forms, assignments, allAssignments: assignments.filter((a) => a.userId).map(toEngine), toEngine, schedule };
}

export async function getAutoScheduleInputData(scheduleId: string) {
  const { facilityId } = await requireManager();
  const schedule = await prisma.schedule.findFirst({
    where: { id: scheduleId, facilityId, status: { in: ['DRAFT', 'PUBLISHED'] } },
    select: { draftVersionId: true, publishedVersionId: true },
  });
  try {
    const data = await loadSchedulingInput(prisma, scheduleId, facilityId, schedule?.draftVersionId ?? schedule?.publishedVersionId ?? null);
    return { found: true as const, input: data.input, schedule: data.schedule };
  } catch {
    return { found: false as const, message: 'השיבוץ לא נמצא' };
  }
}
