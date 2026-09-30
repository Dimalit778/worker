import type { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/db/client';
import { requireManager } from '@/lib/db/auth-helpers';
import { addDays } from '@/features/scheduling-engine/constraints';
import type { EngineAssignment, EngineInput } from '@/features/scheduling-engine/types';

export async function loadSchedulingInput(tx: Prisma.TransactionClient, scheduleId: string, facilityId: string, versionId: string | null) {
  const schedule = await tx.roster.findFirst({ where: { id: scheduleId, facilityId }, include: { period: true } });
  if (!schedule) throw new Error('השיבוץ לא נמצא');
  const [employees, capacities, forms, assignments, surrounding, holidays] = await Promise.all([
    tx.employee.findMany({ where: { facilityId, isActive: true, primaryShiftRole: { code: { not: 1 } } } }),
    tx.staffingRequirement.findMany({ where: { facilityId, isActive: true, shiftRole: { isActive: true, code: { not: 1 } } }, include: { shiftRole: true } }),
    tx.availabilitySubmission.findMany({ where: { periodId: schedule.periodId, isSubmitted: true, employee: { facilityId } }, include: { shiftAvailabilities: true } }),
    versionId ? tx.shiftAssignment.findMany({ where: { versionId, scheduleId, facilityId } }) : Promise.resolve([]),
    tx.shiftAssignment.findMany({ where: { facilityId, scheduleId: { not: scheduleId }, version: { status: 'PUBLISHED', isActive: true }, date: { gte: addDays(schedule.period.startDate, -56), lte: addDays(schedule.period.endDate, 1) } } }),
    tx.holiday.findMany({ where: { date: { gte: schedule.period.startDate, lte: schedule.period.endDate } } }),
  ]);
  const toEngine = (a: typeof assignments[number]): EngineAssignment => ({
    employeeId: a.employeeId, facilityId: a.facilityId, positionId: a.shiftRoleId,
    date: a.date, shiftType: a.shiftType, slotIndex: 0, isManualOverride: a.isLocked,
  });
  const availability = new Map<string, Set<string>>();
  const preferences = new Map<string, Set<string>>();
  for (const form of forms) {
    availability.set(form.employeeId, new Set(form.shiftAvailabilities.filter(s => s.preference !== 'UNAVAILABLE').map(s => `${s.date.toISOString().slice(0,10)}|${s.shiftType}`)));
    preferences.set(form.employeeId, new Set(form.shiftAvailabilities.filter(s => s.preference === 'PREFERRED').map(s => `${s.date.toISOString().slice(0,10)}|${s.shiftType}`)));
  }
  const dates: Date[] = [];
  for (let d = schedule.period.startDate; d <= schedule.period.endDate; d = addDays(d, 1)) dates.push(d);
  const input: EngineInput = {
    scheduleId, period: { id: schedule.periodId, facilityId, startDate: schedule.period.startDate, endDate: schedule.period.endDate },
    week1Dates: dates.slice(0,7), week2Dates: dates.slice(7),
    employees: employees.map(e => ({ id: e.id, facilityId, positionId: e.primaryShiftRoleId, capability: e.capability, isActive: e.isActive })),
    capacities: capacities.map(c => ({ positionId: c.shiftRoleId, positionName: c.shiftRole.name, requiredCapability: c.shiftRole.requiredCapability, shiftType: c.shiftType, dayCategory: c.dayCategory, amount: c.requiredCount })),
    availability, preferences,
    manualAssignments: assignments.filter(a => a.isLocked).map(toEngine),
    historicalAssignments: surrounding.filter(a => a.date < schedule.period.startDate).map(toEngine),
    boundaryAssignments: surrounding.filter(a => a.date >= addDays(schedule.period.startDate, -1)).map(toEngine),
    holidayCategories: new Map(holidays.map(h => [h.date.toISOString().slice(0,10), h.behavesAs])),
  };
  return { input, assignments, allAssignments: assignments.map(toEngine), schedule };
}

export async function getAutoScheduleInputData(scheduleId: string) {
  const { facilityId } = await requireManager();
  const version = await prisma.rosterVersion.findFirst({ where: { scheduleId, facilityId, OR: [{ status: 'DRAFT' }, { status: 'PUBLISHED', isActive: true }] }, orderBy: { version: 'desc' } });
  try {
    const data = await loadSchedulingInput(prisma, scheduleId, facilityId, version?.id ?? null);
    return { found: true as const, input: data.input, schedule: data.schedule };
  } catch {
    return { found: false as const, message: 'השיבוץ לא נמצא' };
  }
}
