'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/react-query/query-keys';
import {
  fetchManagerPositions,
  fetchManagerShiftCapacities,
  fetchManagerShiftStaffingPositions,
  fetchSubmissionWindowRule,
} from '@/features/settings/actions';

export function invalidateSettingsQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  facilityId: string,
) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.settings.positions(facilityId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.settings.capacities(facilityId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.settings.shiftStaffingPositions(facilityId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.settings.submissionWindow() }),
  ]);
}

export function useManagerPositions(facilityId: string) {
  return useQuery({
    queryKey: queryKeys.settings.positions(facilityId),
    queryFn: fetchManagerPositions,
  });
}

export function useManagerShiftCapacities(facilityId: string) {
  return useQuery({
    queryKey: queryKeys.settings.capacities(facilityId),
    queryFn: fetchManagerShiftCapacities,
  });
}

export function useManagerShiftStaffingPositions(facilityId: string) {
  return useQuery({
    queryKey: queryKeys.settings.shiftStaffingPositions(facilityId),
    queryFn: fetchManagerShiftStaffingPositions,
  });
}

export function useSubmissionWindowRule() {
  return useQuery({
    queryKey: queryKeys.settings.submissionWindow(),
    queryFn: fetchSubmissionWindowRule,
  });
}
