'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/react-query/query-keys';
import {
  fetchCurrentSchedule,
  fetchDraftSchedule,
  fetchEmployeeCurrentSchedule,
} from '@/features/schedules/assignments/actions';

export function invalidateScheduleQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  scheduleId?: string,
) {
  const tasks = [
    queryClient.invalidateQueries({ queryKey: queryKeys.schedules.current() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.schedules.employeeCurrent() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.schedules.draft() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all() }),
  ];

  if (scheduleId) {
    tasks.push(
      queryClient.invalidateQueries({ queryKey: queryKeys.schedules.assignments(scheduleId) }),
    );
  }

  return Promise.all(tasks);
}

export function useCurrentSchedule() {
  return useQuery({
    queryKey: queryKeys.schedules.current(),
    queryFn: fetchCurrentSchedule,
  });
}

export function useDraftSchedule() {
  return useQuery({
    queryKey: queryKeys.schedules.draft(),
    queryFn: fetchDraftSchedule,
  });
}

export function useEmployeeCurrentSchedule() {
  return useQuery({
    queryKey: queryKeys.schedules.employeeCurrent(),
    queryFn: fetchEmployeeCurrentSchedule,
  });
}
