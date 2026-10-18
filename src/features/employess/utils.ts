import type { FutureAssignment } from './types';

type FutureSlotRow = {
  id: string;
  date: Date;
  startsAt: Date;
  shiftType: string;
  position: { name: string };
  schedule: { name: string };
  version: { status: 'DRAFT' | 'PUBLISHED' | string };
};

/** Maps raw future slot rows to display items, ordered by start time. */
function toFutureAssignments(slots: FutureSlotRow[]): FutureAssignment[] {
  return [...slots]
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
    .map((slot) => ({
      slotId: slot.id,
      startsAt: slot.startsAt.toISOString(),
      date: slot.date.toISOString().slice(0, 10),
      shiftType: slot.shiftType,
      positionName: slot.position.name,
      periodName: slot.schedule.name,
      versionStatus: slot.version.status === 'DRAFT' ? 'DRAFT' : 'PUBLISHED',
    }));
}

const POSITION_STYLE: Record<number, string> = {
  1: 'bg-slate-800 text-white',
  2: 'bg-blue-950 text-blue-200',
  3: 'bg-secondary text-muted-foreground',
  4: 'bg-orange-950 text-orange-200',
  5: 'bg-green-950 text-green-200',
  6: 'bg-purple-950 text-purple-200',
  7: 'bg-pink-950 text-pink-200',
  8: 'bg-yellow-950 text-yellow-200',
  9: 'bg-secondary text-foreground',
  10: 'bg-red-950 text-red-200',
  11: 'bg-secondary text-foreground',
  12: 'bg-cyan-950 text-cyan-200',
};

export { toFutureAssignments, POSITION_STYLE };
