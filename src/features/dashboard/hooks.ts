'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/react-query/query-keys';
import { fetchManagerDashboardData } from '@/features/dashboard/actions';

export function invalidateManagerDashboard(
  queryClient: ReturnType<typeof useQueryClient>,
  year: number,
) {
  return queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.manager(year) });
}

export function useManagerDashboard(year: number) {
  return useQuery({
    queryKey: queryKeys.dashboard.manager(year),
    queryFn: () => fetchManagerDashboardData(year),
  });
}
