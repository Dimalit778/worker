export const Position = {
  GUARD: 'GUARD',
  BAKAR: 'BAKAR',
  SHIFT_MANAGER: 'SHIFT_MANAGER',
} as const;

export type Position = (typeof Position)[keyof typeof Position];

export type CreateEmployeeParams = {
  firstName: string;
  lastName: string;
  phone: string | null;
  email: string;
  positionId: string;
};

export type UpdateEmployeeParams = {
  employeeId: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  positionId: string;
  isActive: boolean;
};

export type EmployeeAndPosition = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  email: string;
  isActive: boolean;
  position: {
    id: string;
    name: string;
    displayOrder: number;
  };
};
export type PositionOption = {
  id: string;
  name: string;
  displayOrder: number;
};
