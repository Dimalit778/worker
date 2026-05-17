import { ShiftType } from '@/generated/prisma/client';

/** Legacy role codes used only for display strings in settings helpers. */
type GuardPositionCode = 'GUARD' | 'BAKAR' | 'SHIFT_MANAGER' | 'FACILITY_OFFICER';

function buildRoleCode(shiftType: ShiftType, position: GuardPositionCode) {
  return `${shiftType}_${position}`;
}

function buildRoleName(shiftType: ShiftType, position: GuardPositionCode) {
  const shiftNames: Record<ShiftType, string> = {
    MORNING: 'בוקר',
    EVENING: 'ערב',
    NIGHT: 'לילה',
  };

  const positionNames: Record<GuardPositionCode, string> = {
    GUARD: 'מאבטח',
    BAKAR: 'בקר',
    SHIFT_MANAGER: 'אחמ״ש',
    FACILITY_OFFICER: 'קצין מתקן',
  };

  return `${positionNames[position]} ${shiftNames[shiftType]}`;
}

export { buildRoleCode, buildRoleName };
