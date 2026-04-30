export type CreateEmployeeParams = {
  firstName: string;
  lastName: string;
  phone: string | null;
  displayName: string;
  isReligious?: boolean;
  email: string;
  positionId: string;
};

export type UpdateEmployeeParams = {
  employeeId: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  displayName: string;
  isReligious: boolean;
  positionId: string;
  isActive: boolean;
};
export type PositionOption = {
  id: string;
  name: string;
  code: number;
};

export type EmployeeListItem = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  email: string;
  displayName: string;
  isReligious: boolean;
  isActive: boolean;
  position: {
    id: string;
    name: string;
    code: number;
  };
};

export type EmployeesPageData =
  | {
      employees: EmployeeListItem[];
      positions: PositionOption[];
    }
  | {
      error: string;
    };
