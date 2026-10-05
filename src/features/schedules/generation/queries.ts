import type { Prisma, Schedule } from '@/generated/prisma/client';
import { prisma } from '@/lib/db/client';
import { requireManager } from '@/lib/db/auth-helpers';
import { addDays } from '@/features/scheduling-engine/constraints';
import type { EngineAssignment, EngineInput } from '@/features/scheduling-engine/types';

const staffedUser = { role: { rank: { not: 1 } } };
const staffedPosition = {
  isActive: true,
  NOT: { OR: [{ requiredRank: 1 }, { baseRole: { rank: 1 } }] },
};

export async function loadSchedulingInput(tx: Prisma.TransactionClient, scheduleId: string, facilityId: string, versionId: string | null, loadedSchedule?: Schedule) {
  const schedule = loadedSchedule ?? await tx.schedule.findFirst({ where: { id: scheduleId, facilityId } });
  if (!schedule) throw new Error('השיבוץ לא נמצא');
  const [employees, capacities, forms, assignments, surrounding] = await Promise.all([
    tx.user.findMany({ where: { facilityId, ...staffedUser }, select: { id: true, displayName: true, roleId: true, role: { select: { id: true, name: true, rank: true } } } }),
    tx.staffingRequirement.findMany({ where: { facilityId, position: staffedPosition }, include: { position: { include: { baseRole: true } } } }),
    tx.availabilitySubmission.findMany({
      where: { scheduleId, submittedAt: { not: null }, user: { facilityId } },
      include: { availabilities: true },
    }),
    versionId ? tx.scheduleSlot.findMany({ where: { scheduleId, facilityId, userId: { not: null } }, include: { user: { select: { displayName: true } }, position: { select: { name: true } } } }) : Promise.resolve([]),
    tx.scheduleSlot.findMany({
      where: {
        facilityId,
        scheduleId: { not: scheduleId },
        userId: { not: null },
        schedule: { status: 'PUBLISHED' },
        date: { gte: addDays(schedule.startDate, -56), lte: addDays(schedule.endDate, 1) },
      },
    }),
  ]);
  const toEngine = (a: { userId: string | null; facilityId: string; positionId: string; date: Date; shiftType: EngineAssignment['shiftType']; slotNumber: number; isLocked: boolean; source: EngineAssignment['source'] }): EngineAssignment => ({
    employeeId: a.userId ?? '',
    facilityId: a.facilityId,
    positionId: a.positionId,
    date: a.date,
    shiftType: a.shiftType,
    slotIndex: Math.max(0, a.slotNumber - 1),
    isManualOverride: a.isLocked,
    source: a.source,
  });
  const availability = new Map<string, Set<string>>();
  const preferences = new Map<string, Set<string>>();
  for (const form of forms) {
    availability.set(form.userId, new Set(form.availabilities.filter((s) => s.preference !== 'UNAVAILABLE').map((s) => `${s.date.toISOString().slice(0, 10)}|${s.shiftType}`)));
    preferences.set(form.userId, new Set(form.availabilities.filter((s) => s.preference === 'PREFERRED').map((s) => `${s.date.toISOString().slice(0, 10)}|${s.shiftType}`)));
  }
  const dates: Date[] = [];
  for (let d = schedule.startDate; d <= schedule.endDate; d = addDays(d, 1)) dates.push(d);
  const input: EngineInput = {
    scheduleId,
    period: { id: schedule.id, facilityId, startDate: schedule.startDate, endDate: schedule.endDate },
    week1Dates: dates.slice(0, 7),
    week2Dates: dates.slice(7),
    employees: employees.map((e) => ({ id: e.id, facilityId, positionId: e.roleId, rank: e.role.rank, isActive: true })),
    capacities: capacities.map((c) => ({
      positionId: c.positionId,
      positionName: c.position.name,
      requiredRank: c.position.requiredRank ?? c.position.baseRole?.rank ?? c.position.displayOrder,
      shiftType: c.shiftType,
      dayCategory: c.dayCategory,
      amount: c.requiredCount,
    })),
    availability,
    preferences,
    manualAssignments: assignments.filter((a) => a.isLocked && a.userId).map(toEngine),
    historicalAssignments: surrounding.filter((a) => a.date < schedule.startDate && a.userId).map(toEngine),
    boundaryAssignments: surrounding.filter((a) => a.date >= addDays(schedule.startDate, -1) && a.userId).map(toEngine),
    holidayCategories: new Map(),
  };
  return { input, employees, capacities, forms, assignments, allAssignments: assignments.filter((a) => a.userId).map(toEngine), schedule };
}

export async function getAutoScheduleInputData(scheduleId: string) {
  const { facilityId } = await requireManager();
  const schedule = await prisma.schedule.findFirst({
    where: { id: scheduleId, facilityId, status: { in: ['DRAFT', 'PUBLISHED'] } },
    select: { id: true },
  });
  try {
    const data = await loadSchedulingInput(prisma, scheduleId, facilityId, schedule?.id ?? null);
    return { found: true as const, input: data.input, schedule: data.schedule };
  } catch {
    return { found: false as const, message: 'השיבוץ לא נמצא' };
  }
}
