import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { requireManager } from '@/lib/db/auth-helpers';
import { ManagerRequestsClient } from '@/features/requests/components/manager-requests-client';
import { getManagerQueue } from '@/features/requests/queries';
import { requestKeys } from '@/features/requests/keys';
import { dehydrateOptions, getQueryClient } from '@/lib/react-query/get-query-client';

export default async function ManagerRequestsPage() {
  const { facilityId } = await requireManager();
  const queryClient = getQueryClient();
  await queryClient.prefetchQuery({ queryKey: requestKeys.queue('open'), queryFn: () => getManagerQueue(facilityId, 'open') });

  return (
    <HydrationBoundary state={dehydrate(queryClient, dehydrateOptions())}>
      <ManagerRequestsClient />
    </HydrationBoundary>
  );
}
