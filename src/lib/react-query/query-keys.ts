export const queryKeys = {
  all: ['app'] as const,

  dashboard: {
    all: () => [...queryKeys.all, 'dashboard'] as const,
    manager: (year: number) => [...queryKeys.dashboard.all(), 'manager', year] as const,
  },

  settings: {
    all: () => [...queryKeys.all, 'settings'] as const,
    positions: (facilityId: string) => [...queryKeys.settings.all(), 'positions', facilityId] as const,
    capacities: (facilityId: string) => [...queryKeys.settings.all(), 'capacities', facilityId] as const,
    shiftStaffingPositions: (facilityId: string) =>
      [...queryKeys.settings.all(), 'shiftStaffingPositions', facilityId] as const,
    submissionWindow: () => [...queryKeys.settings.all(), 'submissionWindow'] as const,
  },

  employees: {
    all: () => [...queryKeys.all, 'employees'] as const,
    list: (facilityId?: string) => [...queryKeys.employees.all(), 'list', facilityId ?? 'manager'] as const,
    detail: (employeeId: string) => [...queryKeys.employees.all(), 'detail', employeeId] as const,
    submissions: (employeeId: string) => [...queryKeys.employees.all(), 'submissions', employeeId] as const,
  },

  schedules: {
    all: () => [...queryKeys.all, 'schedules'] as const,
    current: () => [...queryKeys.schedules.all(), 'current'] as const,
    upcoming: () => [...queryKeys.schedules.all(), 'upcoming'] as const,
    employeeCurrent: () => [...queryKeys.schedules.all(), 'employeeCurrent'] as const,
    draft: () => [...queryKeys.schedules.all(), 'draft'] as const,
    assignments: (scheduleId: string) => [...queryKeys.schedules.all(), 'assignments', scheduleId] as const,
  },

  availability: {
    all: () => [...queryKeys.all, 'availability'] as const,
    current: () => [...queryKeys.availability.all(), 'current'] as const,
    history: (periodId?: string) => [...queryKeys.availability.all(), 'history', periodId ?? 'all'] as const,
  },
} as const;
