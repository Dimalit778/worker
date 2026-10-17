'use client';

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/react-query/query-keys';
import type { VersionExpectation } from '../services/transactions';
import { getEmployeeLoad, getPublishReview, getSubmissionReadiness } from './queries';

const readinessKey = () => [...queryKeys.schedules.all(), 'readiness'] as const;

export function useSubmissionReadiness(scheduleId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: [...readinessKey(), 'submissions', scheduleId],
    queryFn: () => getSubmissionReadiness(scheduleId!),
    enabled: !!scheduleId && enabled,
  });
}

/** Keyed by revision so every saved edit refreshes the table. */
export function useEmployeeLoad(scheduleId: string | undefined, versionId: string | null | undefined, revision: number | undefined, enabled = true) {
  return useQuery({
    queryKey: [...readinessKey(), 'load', scheduleId, versionId, revision ?? 0],
    queryFn: () => getEmployeeLoad(scheduleId!, versionId!),
    enabled: !!scheduleId && !!versionId && enabled,
  });
}

export function usePublishReview(scheduleId: string, expected: VersionExpectation, enabled: boolean) {
  return useQuery({
    queryKey: [...readinessKey(), 'publish-review', scheduleId, expected.versionId, expected.revision],
    queryFn: () => getPublishReview(scheduleId, expected),
    enabled,
    staleTime: 0,
  });
}
