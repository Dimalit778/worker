export const queryKeys = {
  all: ['app'] as const,

  dashboard: {
    all: () => [...queryKeys.all, 'dashboard'] as const,
    manager: (year: number) => [...queryKeys.dashboard.all(), 'manager', year] as const,
  },

  settings: {
    all: () => [...queryKeys.all, 'settings'] as const,
    positions: (courtId: string) => [...queryKeys.settings.all(), 'positions', courtId] as const,
    capacities: (courtId: string) => [...queryKeys.settings.all(), 'capacities', courtId] as const,
    shiftStaffingPositions: (courtId: string) =>
      [...queryKeys.settings.all(), 'shiftStaffingPositions', courtId] as const,
  },

  employees: {
    all: () => [...queryKeys.all, 'employees'] as const,
    list: () => [...queryKeys.employees.all(), 'list'] as const,
    detail: (employeeId: string) => [...queryKeys.employees.all(), 'detail', employeeId] as const,
    submissions: (employeeId: string) => [...queryKeys.employees.all(), 'submissions', employeeId] as const,
  },

  schedules: {
    all: () => [...queryKeys.all, 'schedules'] as const,
    active: () => [...queryKeys.schedules.all(), 'active'] as const,
    employeeActive: () => [...queryKeys.schedules.all(), 'employeeActive'] as const,
    draft: () => [...queryKeys.schedules.all(), 'draft'] as const,
    assignments: (scheduleId: string) => [...queryKeys.schedules.all(), 'assignments', scheduleId] as const,
  },

  availability: {
    all: () => [...queryKeys.all, 'availability'] as const,
    current: () => [...queryKeys.availability.all(), 'current'] as const,
    history: (periodId?: string) => [...queryKeys.availability.all(), 'history', periodId ?? 'all'] as const,
  },
} as const;
