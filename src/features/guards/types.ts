export const Position = {
  GUARD: 'GUARD',
  BAKAR: 'BAKAR',
  SHIFT_MANAGER: 'SHIFT_MANAGER',
  FACILITY_OFFICER: 'FACILITY_OFFICER',
} as const;

export type Position = (typeof Position)[keyof typeof Position];

export type GuardRow = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  position: Position;
  isActive: boolean;
};
export type CreateGuardParams = {
  firstName: string;
  lastName: string;
  phone: string | null;
  email: string;
  position: Position;
};

export type UpdateGuardParams = {
  employeeId: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  position: Position;
  isActive: boolean;
};

export type DeleteGuardParams = {
  employeeId: string;
  force?: boolean;
};

export type GetGuardsResult = GuardRow[];
