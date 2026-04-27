import { ShiftType } from '@/generated/prisma/client';
import { Position } from '../guards/types';

function buildRoleCode(shiftType: ShiftType, position: Position) {
  return `${shiftType}_${position}`;
}

function buildRoleName(shiftType: ShiftType, position: Position) {
  const shiftNames: Record<ShiftType, string> = {
    MORNING: 'בוקר',
    EVENING: 'ערב',
    NIGHT: 'לילה',
  };

  const positionNames: Record<Position, string> = {
    GUARD: 'מאבטח',
    BAKAR: 'בקר',
    SHIFT_MANAGER: 'אחמ״ש',
    FACILITY_OFFICER: 'קצין מתקן',
  };

  return `${positionNames[position]} ${shiftNames[shiftType]}`;
}

export { buildRoleCode, buildRoleName };
