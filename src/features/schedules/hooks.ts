'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/react-query/query-keys';
import { fetchActiveSchedule, fetchDraftSchedule } from '@/features/schedules/assignments/actions';

export function invalidateScheduleQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  scheduleId?: string,
) {
  const tasks = [
    queryClient.invalidateQueries({ queryKey: queryKeys.schedules.active() }),
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

export function useActiveSchedule() {
  return useQuery({
    queryKey: queryKeys.schedules.active(),
    queryFn: fetchActiveSchedule,
  });
}

export function useDraftSchedule() {
  return useQuery({
    queryKey: queryKeys.schedules.draft(),
    queryFn: fetchDraftSchedule,
  });
}
