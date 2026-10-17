import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { requireEmployee } from '@/lib/db/auth-helpers';
import { EmployeeRequestsClient } from '@/features/requests/components/employee-requests-client';
import { getEmployeeRequests } from '@/features/requests/queries';
import { requestKeys } from '@/features/requests/keys';
import { dehydrateOptions, getQueryClient } from '@/lib/react-query/get-query-client';

export default async function EmployeeRequestsPage() {
  const { facilityId, userId } = await requireEmployee();
  const queryClient = getQueryClient();
  await queryClient.prefetchQuery({ queryKey: requestKeys.mine(), queryFn: () => getEmployeeRequests(facilityId, userId) });

  return (
    <HydrationBoundary state={dehydrate(queryClient, dehydrateOptions())}>
      <EmployeeRequestsClient />
    </HydrationBoundary>
  );
}
