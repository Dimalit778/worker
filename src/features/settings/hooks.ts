'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/react-query/query-keys';
import {
  fetchManagerPositions,
  fetchManagerShiftCapacities,
  fetchManagerShiftStaffingPositions,
} from '@/features/settings/actions';

export function invalidateSettingsQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  courtId: string,
) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.settings.positions(courtId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.settings.capacities(courtId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.settings.shiftStaffingPositions(courtId) }),
  ]);
}

export function useManagerPositions(courtId: string) {
  return useQuery({
    queryKey: queryKeys.settings.positions(courtId),
    queryFn: fetchManagerPositions,
  });
}

export function useManagerShiftCapacities(courtId: string) {
  return useQuery({
    queryKey: queryKeys.settings.capacities(courtId),
    queryFn: fetchManagerShiftCapacities,
  });
}

export function useManagerShiftStaffingPositions(courtId: string) {
  return useQuery({
    queryKey: queryKeys.settings.shiftStaffingPositions(courtId),
    queryFn: fetchManagerShiftStaffingPositions,
  });
}
