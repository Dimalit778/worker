import type { EmployeeRequestStatus, Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/db/client';
import { canEmployeeFillPosition } from '@/features/scheduling-engine/role-eligibility';
import { expandTimeOff, filterAffectedSlots, OPEN_STATUSES, toIsoDate, type AffectedSlot } from './rules';
import type { AffectedSlotDto, RequestDto, TransferOption } from './types';

type Db = Prisma.TransactionClient | typeof prisma;

/** Engine hook: approved time off per user as YYYY-MM-DD keys, clipped to [startDate, endDate]. */
export async function loadApprovedTimeOff(tx: Prisma.TransactionClient, facilityId: string, startDate: Date, endDate: Date): Promise<Map<string, Set<string>>> {
  const rows = await tx.employeeRequest.findMany({
    where: { facilityId, type: 'TIME_OFF', status: 'APPROVED', startDate: { lte: endDate }, endDate: { gte: startDate } },
    select: { requesterId: true, startDate: true, endDate: true },
  });
  return expandTimeOff(rows.map(r => ({ userId: r.requesterId, startDate: r.startDate, endDate: r.endDate })), startDate, endDate);
}

const affectedSlotInclude = { position: { select: { name: true } }, schedule: { select: { name: true, draftVersionId: true } } } satisfies Prisma.ScheduleSlotInclude;
const inPublishedOrDraft = (facilityId: string): Prisma.ScheduleSlotWhereInput => ({
  OR: [{ version: { publishedFor: { is: { facilityId } } } }, { version: { draftFor: { is: { facilityId } } } }],
});

const toAffectedSlot = (r: Prisma.ScheduleSlotGetPayload<{ include: typeof affectedSlotInclude }>): AffectedSlot => ({
  id: r.id, userId: r.userId, date: r.date, shiftType: r.shiftType, positionName: r.position.name,
  scheduleName: r.schedule.name, versionKind: r.schedule.draftVersionId === r.versionId ? 'DRAFT' : 'PUBLISHED',
});

const toAffectedSlotDtos = (slots: AffectedSlot[], userId: string, start: Date, end: Date): AffectedSlotDto[] =>
  filterAffectedSlots(slots, userId, start, end).map(s => ({
    id: s.id, date: toIsoDate(s.date), shiftType: s.shiftType, positionName: s.positionName,
    scheduleName: s.scheduleName, versionKind: s.versionKind,
  }));

/** Requester's slots in any schedule's published or open draft version within the range. Never modified. */
export async function findAffectedSlots(db: Db, facilityId: string, userId: string, start: Date, end: Date): Promise<AffectedSlotDto[]> {
  const rows = await db.scheduleSlot.findMany({
    where: { facilityId, userId, date: { gte: start, lte: end }, ...inPublishedOrDraft(facilityId) },
    include: affectedSlotInclude,
  });
  return toAffectedSlotDtos(rows.map(toAffectedSlot), userId, start, end);
}

const requestInclude = {
  requester: { select: { displayName: true } },
  target: { select: { displayName: true } },
  decidedBy: { select: { displayName: true } },
  slot: { select: { date: true, shiftType: true, startsAt: true, endsAt: true, position: { select: { name: true } } } },
} satisfies Prisma.EmployeeRequestInclude;

type RequestRow = Prisma.EmployeeRequestGetPayload<{ include: typeof requestInclude }>;

function toDto(r: RequestRow, affectedSlots: AffectedSlotDto[] = []): RequestDto {
  return {
    id: r.id, type: r.type, status: r.status,
    requesterId: r.requesterId, requesterName: r.requester.displayName,
    targetUserId: r.targetUserId, targetName: r.target?.displayName ?? null,
    startDate: r.startDate ? toIsoDate(r.startDate) : null,
    endDate: r.endDate ? toIsoDate(r.endDate) : null,
    slot: r.slot ? {
      date: toIsoDate(r.slot.date), shiftType: r.slot.shiftType, positionName: r.slot.position.name,
      startsAt: r.slot.startsAt.toISOString(), endsAt: r.slot.endsAt.toISOString(),
    } : null,
    reason: r.reason, decisionNote: r.decisionNote, overrideReason: r.overrideReason,
    decidedByName: r.decidedBy?.displayName ?? null,
    decidedAt: r.decidedAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
    affectedSlots,
  };
}

export async function getEmployeeRequests(facilityId: string, userId: string) {
  const [mine, incoming] = await Promise.all([
    prisma.employeeRequest.findMany({ where: { facilityId, requesterId: userId }, include: requestInclude, orderBy: { createdAt: 'desc' }, take: 100 }),
    prisma.employeeRequest.findMany({ where: { facilityId, targetUserId: userId, type: 'SHIFT_SWAP' }, include: requestInclude, orderBy: { createdAt: 'desc' }, take: 50 }),
  ]);
  return { mine: mine.map(r => toDto(r)), incoming: incoming.map(r => toDto(r)) };
}

export type QueueFilter = 'open' | 'closed' | 'all';

export async function getManagerQueue(facilityId: string, filter: QueueFilter) {
  const status: Prisma.EmployeeRequestWhereInput['status'] =
    filter === 'open' ? { in: [...OPEN_STATUSES] } : filter === 'closed' ? { notIn: [...OPEN_STATUSES] } : undefined;
  const rows = await prisma.employeeRequest.findMany({
    where: { facilityId, status }, include: requestInclude, orderBy: { createdAt: 'desc' }, take: 200,
  });
  const ranged = rows.flatMap(r =>
    (OPEN_STATUSES as readonly EmployeeRequestStatus[]).includes(r.status) && r.type !== 'SHIFT_SWAP' && r.startDate && r.endDate
      ? [{ id: r.id, userId: r.requesterId, start: r.startDate, end: r.endDate }]
      : []);
  const slots = ranged.length ? (await prisma.scheduleSlot.findMany({
    where: {
      facilityId, userId: { in: [...new Set(ranged.map(q => q.userId))] },
      date: { gte: new Date(Math.min(...ranged.map(q => q.start.getTime()))), lte: new Date(Math.max(...ranged.map(q => q.end.getTime()))) },
      ...inPublishedOrDraft(facilityId),
    },
    include: affectedSlotInclude,
  })).map(toAffectedSlot) : [];
  const affected = new Map(ranged.map(q => [q.id, toAffectedSlotDtos(slots, q.userId, q.start, q.end)]));
  return rows.map(r => toDto(r, affected.get(r.id)));
}

export function countOpenUrgent(facilityId: string) {
  return prisma.employeeRequest.count({ where: { facilityId, type: 'URGENT_ABSENCE', status: 'PENDING_MANAGER' } });
}

export function countIncomingTransfers(facilityId: string, userId: string) {
  return prisma.employeeRequest.count({ where: { facilityId, targetUserId: userId, type: 'SHIFT_SWAP', status: 'PENDING_PEER' } });
}

export function positionRank(position: { requiredRank: number | null; displayOrder: number; baseRole: { rank: number } | null }) {
  return position.requiredRank ?? position.baseRole?.rank ?? position.displayOrder;
}

/** The employee's upcoming slots in published versions, each with the colleagues who may take it. */
export async function getTransferOptions(facilityId: string, userId: string, now = new Date()): Promise<TransferOption[]> {
  const [slots, colleagues] = await Promise.all([
    prisma.scheduleSlot.findMany({
      where: { facilityId, userId, startsAt: { gt: now }, version: { publishedFor: { is: { facilityId } } } },
      include: { position: { include: { baseRole: { select: { rank: true } } } }, schedule: { select: { name: true } } },
      orderBy: { startsAt: 'asc' },
      take: 60,
    }),
    prisma.user.findMany({
      where: { facilityId, isActive: true, id: { not: userId }, role: { rank: { not: 1 } } },
      select: { id: true, displayName: true, role: { select: { rank: true } } },
      orderBy: { displayName: 'asc' },
    }),
  ]);
  return slots.map(slot => {
    const required = positionRank(slot.position);
    return {
      slotId: slot.id, date: toIsoDate(slot.date), shiftType: slot.shiftType, positionName: slot.position.name,
      scheduleName: slot.schedule.name, startsAt: slot.startsAt.toISOString(),
      colleagues: colleagues.filter(c => canEmployeeFillPosition(c.role.rank, required)).map(c => ({ id: c.id, name: c.displayName })),
    };
  });
}
