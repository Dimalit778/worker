import type { Prisma, ScheduleSlot } from '@/generated/prisma/client';
import type { ScheduleActor } from '../services/transactions';

const timeFormat = new Intl.DateTimeFormat('he-IL', { timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const hoursLabel = (slot: ScheduleSlot) => `${timeFormat.format(slot.startsAt)}–${timeFormat.format(slot.endsAt)}`;
const shiftLabels = { MORNING: 'בוקר', EVENING: 'ערב', NIGHT: 'לילה' };
const key = (slot: ScheduleSlot) => `${slot.date.toISOString()}|${slot.shiftType}|${slot.positionId}|${slot.slotNumber}`;
const state = (slot?: ScheduleSlot) => slot?.userId ? {
  userId: slot.userId, startsAt: slot.startsAt.toISOString(), endsAt: slot.endsAt.toISOString(), isLocked: slot.isLocked,
} : null;

/** Store only changed cells, with readable names and previous/new values. */
export async function recordSlotChanges(
  tx: Prisma.TransactionClient, actor: ScheduleActor, scheduleId: string, versionId: string,
  before: ScheduleSlot[], after: ScheduleSlot[], violations: { employeeId: string; code: string; message: string }[] = [], reason?: string, requestId?: string,
) {
  const previous = new Map(before.map(slot => [key(slot), slot]));
  const next = new Map(after.map(slot => [key(slot), slot]));
  const changes = [...new Set([...previous.keys(), ...next.keys()])].flatMap(id => {
    const oldSlot = previous.get(id);
    const newSlot = next.get(id);
    return JSON.stringify(state(oldSlot)) === JSON.stringify(state(newSlot)) ? [] : [{ oldSlot, newSlot }];
  });
  if (!changes.length) return;
  const userIds = [...new Set(changes.flatMap(c => [c.oldSlot?.userId, c.newSlot?.userId].filter((id): id is string => !!id)))];
  const users = await tx.user.findMany({ where: { facilityId: actor.facilityId, id: { in: userIds } }, select: { id: true, displayName: true } });
  const positions = await tx.position.findMany({ where: { id: { in: [...new Set(changes.map(c => (c.newSlot ?? c.oldSlot)!.positionId))] } }, select: { id: true, name: true } });
  const names = new Map(users.map(user => [user.id, user.displayName]));
  const positionNames = new Map(positions.map(position => [position.id, position.name]));
  const payload = (slot: ScheduleSlot | undefined, cell: ScheduleSlot) => ({
    date: cell.date.toISOString().slice(0, 10), shiftType: cell.shiftType,
    positionId: cell.positionId, positionName: positionNames.get(cell.positionId) ?? '', slotNumber: cell.slotNumber,
    assignment: slot?.userId ? { ...state(slot)!, employeeName: names.get(slot.userId) ?? slot.userId } : null,
  });
  await tx.scheduleChange.createMany({ data: changes.map(({ oldSlot, newSlot }) => {
    const cell = (newSlot ?? oldSlot)!;
    const oldUser = oldSlot?.userId;
    const newUser = newSlot?.userId;
    const oldName = oldUser ? names.get(oldUser) ?? oldUser : '';
    const newName = newUser ? names.get(newUser) ?? newUser : '';
    const [year, month, day] = cell.date.toISOString().slice(0, 10).split('-');
    const context = `${day}/${month}/${year} · ${shiftLabels[cell.shiftType]} · ${positionNames.get(cell.positionId) ?? ''}`;
    const sameEmployeeChanges = oldSlot && newSlot ? [
      oldSlot.startsAt.getTime() !== newSlot.startsAt.getTime() || oldSlot.endsAt.getTime() !== newSlot.endsAt.getTime()
        ? `שונו שעות ${newName} מ־${hoursLabel(oldSlot)} ל־${hoursLabel(newSlot)}` : '',
      oldSlot.isLocked !== newSlot.isLocked ? `${newSlot.isLocked ? 'ננעל השיבוץ של' : 'בוטלה נעילת השיבוץ של'} ${newName}` : '',
    ].filter(Boolean).join('; ') : '';
    const description = !oldUser ? `נוסף ${newName}` : !newUser ? `הוסר ${oldName}` : oldUser !== newUser ? `הוחלף ${oldName} ב${newName}` : sameEmployeeChanges;
    const issues = violations.filter(v => v.employeeId === newUser);
    return {
      facilityId: actor.facilityId, scheduleId, versionId, changedById: actor.userId,
      changeType: issues.length ? 'MANUAL_OVERRIDE' as const : !oldUser ? 'CREATE' as const : !newUser ? 'DELETE' as const : 'UPDATE' as const,
      reason: `${description} · ${context}${reason ? ` · ${reason}` : ''}${issues.length ? ` · חריגות: ${issues.map(v => v.message).join('; ')}` : ''}`,
      beforeData: payload(oldSlot, cell), afterData: { ...payload(newSlot, cell), violations: issues, ...(requestId ? { requestId } : {}) },
    };
  }) });
}
