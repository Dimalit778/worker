export const Position = {
  GUARD: 'GUARD',
  BAKAR: 'BAKAR',
  SHIFT_MANAGER: 'SHIFT_MANAGER',
  FACILITY_OFFICER: 'FACILITY_OFFICER',
} as const;

export type Position = (typeof Position)[keyof typeof Position];

export type GuardRow = {
  id: string;
  name: string;
  position: Position;
  isActive: boolean;
};
export type CreateGuardParams = {
  name: string;
  position: Position;
};

export type UpdateGuardParams = {
  employeeId: string;
  name: string;
  position: Position;
  isActive: boolean;
};

export type DeleteGuardParams = {
  employeeId: string;
  force?: boolean;
};

export type GetGuardsResult = GuardRow[];
