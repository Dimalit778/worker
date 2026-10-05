export type AdminPositionOption = {
  id: string;
  name: string;
  rank: number;
  isActive: boolean;
};

export type AdminEmployeeItem = {
  id: string;
  firstName: string;
  lastName: string;
  displayName: string;
  phone: string | null;
  email: string;
  isActive: boolean;
  isReligious: boolean;
  systemRole: string | null;
  position: {
    id: string;
    name: string;
    rank: number;
  };
};

export type AdminCourtItem = {
  id: string;
  name: string;
  code: string;
  districtId: string;
  employeeCount: number;
  positions: AdminPositionOption[];
  employees: AdminEmployeeItem[];
};

export type AdminRegionItem = {
  id: string;
  name: string;
  code: string;
  courts: AdminCourtItem[];
};

export type AdminCourtsData = {
  regions: AdminRegionItem[];
};

export type AdminActionResult = { ok: true } | { error: string };

export type CreateAdminCourtParams = {
  name: string;
  code: string;
  districtId: string;
};

export type UpdateAdminCourtParams = CreateAdminCourtParams & {
  facilityId: string;
};

export type CreateAdminEmployeeParams = {
  facilityId: string;
  firstName: string;
  lastName: string;
  displayName: string;
  phone: string | null;
  email: string;
  positionId: string;
  isActive: boolean;
  isReligious: boolean;
};

export type UpdateAdminEmployeeParams = Omit<CreateAdminEmployeeParams, 'facilityId'> & {
  employeeId: string;
};
