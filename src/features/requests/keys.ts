import { queryKeys } from '@/lib/react-query/query-keys';
import type { QueueFilter } from './queries';

export const requestKeys = {
  all: () => [...queryKeys.all, 'requests'] as const,
  mine: () => [...requestKeys.all(), 'mine'] as const,
  transferOptions: () => [...requestKeys.all(), 'transferOptions'] as const,
  queue: (filter: QueueFilter) => [...requestKeys.all(), 'queue', filter] as const,
};
