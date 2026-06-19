'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/react-query/query-keys';
import { fetchMyEmployeeAvailability, getScheduleData } from '@/features/availability/actions';

export function invalidateAvailabilityCurrent(queryClient: ReturnType<typeof useQueryClient>) {
  return queryClient.invalidateQueries({ queryKey: queryKeys.availability.current() });
}

export function invalidateMySubmissions(queryClient: ReturnType<typeof useQueryClient>) {
  return queryClient.invalidateQueries({ queryKey: queryKeys.availability.history() });
}

export function useAvailabilityCurrent() {
  return useQuery({
    queryKey: queryKeys.availability.current(),
    queryFn: getScheduleData,
  });
}

export function useMyEmployeeSubmissions() {
  return useQuery({
    queryKey: queryKeys.availability.history(),
    queryFn: fetchMyEmployeeAvailability,
  });
}
