import { PeriodScheduleStatus } from '@/features/schedules/period-status';
import type { Capability } from '@/generated/prisma/client';

export type CreateEmployeeParams = {
  capability?: Capability;
  firstName: string;
  lastName: string;
  phone: string | null;
  displayName: string;
  isReligious?: boolean;
  email: string;
  positionId: string;
};

export type UpdateEmployeeParams = {
  capability?: Capability;
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
  capability?: Capability;
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

export type EmployeeDetailData =
  | {
      employee: {
        capability?: Capability;
        id: string;
        firstName: string;
        lastName: string;
        displayName: string;
        phone: string | null;
        email: string;
        isActive: boolean;
        isReligious: boolean;
        createdAt: string;
        updatedAt: string;
        position: {
          id: string;
          name: string;
          code: number;
          isActive: boolean;
        };
        court: {
          id: string;
          name: string;
          code: string;
          regionName: string;
        };
        user: {
          id: string;
          email: string;
          mustChangePassword: boolean;
          createdAt: string;
          updatedAt: string;
        } | null;
      };
      stats: {
        submissions: number;
        totalAvailabilityRecords: number;
        selectedSlots: number;
        assignments: number;
        manualAssignments: number;
        warnings: number;
        fairnessRecords: number;
      };
      recentAssignments: {
        id: string;
        date: string;
        shiftType: string;
        isManualOverride: boolean;
        positionName: string;
        periodName: string;
      }[];
      fairnessRecords: {
        id: string;
        periodName: string;
        totalShifts: number;
        morningShifts: number;
        eveningShifts: number;
        nightShifts: number;
        weekendShifts: number;
      }[];
    }
  | {
      error: string;
    };

export type EmployeeSubmissionPeriod = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  submissionDeadline: string;
  status: PeriodScheduleStatus;
  availabilityId: string | null;
  isSubmitted: boolean;
  submittedAt: string | null;
  entries: Record<string, boolean | 'AVAILABLE' | 'PREFERRED' | 'UNAVAILABLE'>;
  selectedSlotCount: number;
};

export type EmployeeSubmissionsData =
  | {
      employee: {
        capability?: Capability;
        id: string;
        displayName: string;
        firstName: string;
        lastName: string;
        positionName: string;
        isActive: boolean;
      };
      periods: EmployeeSubmissionPeriod[];
    }
  | {
      error: string;
    };
