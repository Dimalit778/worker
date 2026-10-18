'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { requestKeys } from './keys';
import { fetchMyRequests, fetchRequestQueue, fetchTransferOptions } from './actions';
import type { QueueFilter } from './queries';

export function invalidateRequests(queryClient: ReturnType<typeof useQueryClient>) {
  return queryClient.invalidateQueries({ queryKey: requestKeys.all() });
}

export function useMyRequests() {
  return useQuery({ queryKey: requestKeys.mine(), queryFn: fetchMyRequests });
}

export function useTransferOptions(enabled: boolean) {
  return useQuery({ queryKey: requestKeys.transferOptions(), queryFn: fetchTransferOptions, enabled });
}

export function useRequestQueue(filter: QueueFilter) {
  return useQuery({ queryKey: requestKeys.queue(filter), queryFn: () => fetchRequestQueue(filter) });
}
