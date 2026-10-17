'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/react-query/query-keys';
import type { createAssignment } from '@/features/schedules/assignments/actions';
import type { CurrentScheduleData } from './types';
import { fetchCurrentSchedule, fetchDraftSchedule } from '@/features/schedules/assignments/actions';
import { fetchUpcomingSchedule } from '@/features/schedules/assignments/upcoming-actions';

export function invalidateScheduleQueries(queryClient: ReturnType<typeof useQueryClient>, scheduleId?: string) {
  const tasks = [
    queryClient.invalidateQueries({ queryKey: queryKeys.schedules.current() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.schedules.upcoming() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.schedules.employeeCurrent() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.schedules.draft() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all() }),
  ];

  if (scheduleId) {
    tasks.push(queryClient.invalidateQueries({ queryKey: queryKeys.schedules.assignments(scheduleId) }));
  }

  return Promise.all(tasks);
}

/** Apply the confirmed save, including its revision, without waiting for a full reload. */
export async function applyScheduleEdit(
  queryClient: ReturnType<typeof useQueryClient>,
  update: Awaited<ReturnType<typeof createAssignment>> | undefined,
) {
  if (!update || 'requiresOverride' in update) return;
  await queryClient.cancelQueries({
    queryKey: queryKeys.schedules.draft(),
    predicate: query => (query.state.data as CurrentScheduleData | null)?.scheduleId === update.scheduleId,
  });
  queryClient.setQueriesData<CurrentScheduleData | null>(
    { queryKey: queryKeys.schedules.draft() },
    current => {
      if (!current || current.scheduleId !== update.scheduleId || current.versionId !== update.versionId || (current.revision ?? 0) > update.revision) return current;
      return { ...current, ...update, editingVersionNumber: current.editingVersionNumber };
    },
  );
  // Inactive views refresh when opened; they need not delay this save.
  void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all(), refetchType: 'none' });
  void queryClient.invalidateQueries({ queryKey: queryKeys.schedules.assignments(update.scheduleId), refetchType: 'none' });
}

export function useCurrentSchedule() {
  return useQuery({
    queryKey: queryKeys.schedules.current(),
    queryFn: fetchCurrentSchedule,
  });
}

export function useDraftSchedule(scheduleId?: string) {
  return useQuery({
    queryKey: [...queryKeys.schedules.draft(), scheduleId ?? 'latest'],
    queryFn: () => fetchDraftSchedule(scheduleId),
  });
}

export function useEmployeeCurrentSchedule() {
  return useQuery({
    queryKey: queryKeys.schedules.employeeCurrent(),
    queryFn: fetchCurrentSchedule,
  });
}

export function useUpcomingSchedule() {
  return useQuery({
    queryKey: queryKeys.schedules.upcoming(),
    queryFn: fetchUpcomingSchedule,
  });
}
