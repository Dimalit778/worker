import type { Prisma } from '@/generated/prisma/client';
import type { ScheduleActor } from './transactions';
import { planCapacityMoves } from './capacity-plan';

/** Call inside the facility's schedule transaction so settings and drafts change together. */
export async function reconcileDraftCapacity(tx: Prisma.TransactionClient, actor: ScheduleActor) {
  const requirements = await tx.staffingRequirement.findMany({
    where: { facilityId: actor.facilityId, position: { isActive: true } },
    include: { position: { include: { baseRole: true } } },
  });
  const capacities = requirements.map(rule => ({
    positionId: rule.positionId, shiftType: rule.shiftType, dayCategory: rule.dayCategory, amount: rule.requiredCount,
    requiredRank: rule.position.requiredRank ?? rule.position.baseRole?.rank ?? rule.position.displayOrder,
  }));
  const drafts = await tx.scheduleVersion.findMany({ where: { facilityId: actor.facilityId, status: 'DRAFT', draftFor: { is: { status: { not: 'ARCHIVED' } } } } });
  let movedCount = 0;
  for (const draft of drafts) {
    const slots = await tx.scheduleSlot.findMany({
      where: { scheduleId: draft.scheduleId, versionId: draft.id },
      include: { user: { include: { role: true } }, position: { include: { baseRole: true } } },
    });
    const { moves, unplaced } = planCapacityMoves(slots.flatMap(slot => slot.user ? [{
      id: slot.id, date: slot.date, shiftType: slot.shiftType, positionId: slot.positionId,
      slotNumber: slot.slotNumber, isLocked: slot.isLocked, employeeRank: slot.user.role.rank,
      positionRank: slot.position.requiredRank ?? slot.position.baseRole?.rank ?? slot.position.displayOrder,
    }] : []), capacities);
    if (unplaced.length) throw new Error('אין מספיק תקנים פנויים לבקר או למאבטח להעברת האיושים העודפים. יש לפנות איושים או ליצור שיבוץ מחדש לפני הקטנת התקן');
    if (!moves.length) continue;
    const changes = [];
    for (const move of moves) {
      const slot = slots.find(row => row.id === move.id)!;
      const last = await tx.scheduleSlot.aggregate({
        where: { scheduleId: draft.scheduleId, versionId: draft.id, date: slot.date, shiftType: slot.shiftType, positionId: move.positionId },
        _max: { slotNumber: true },
      });
      const updated = await tx.scheduleSlot.update({
        where: { id: move.id }, data: { positionId: move.positionId, slotNumber: (last._max.slotNumber ?? 0) + 1 },
      });
      changes.push({ before: { id: slot.id, userId: slot.userId, date: slot.date, shiftType: slot.shiftType, positionId: slot.positionId, slotNumber: slot.slotNumber }, after: updated });
    }
    await tx.scheduleVersion.update({ where: { id: draft.id }, data: { revision: { increment: 1 } } });
    await tx.scheduleChange.create({ data: {
      facilityId: actor.facilityId, scheduleId: draft.scheduleId, versionId: draft.id, changedById: actor.userId, changeType: 'UPDATE',
      reason: 'התאמת איושים לתקנים: העברת עובדים עודפים לתפקיד מתאים פנוי',
      beforeData: JSON.parse(JSON.stringify(changes.map(change => change.before))),
      afterData: JSON.parse(JSON.stringify(changes.map(change => change.after))),
    } });
    movedCount += moves.length;
  }
  return { movedCount };
}
