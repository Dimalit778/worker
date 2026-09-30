import { PortalRole } from '@/lib/auth/portal';
import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { requireSession } from '@/lib/db/auth-helpers';
import { EmployeeSubmissionsClient } from '@/features/availability/components/employee-submissions-client';
import { fetchMyEmployeeAvailability } from '@/features/availability/actions';
import { dehydrateOptions, getQueryClient } from '@/lib/react-query/get-query-client';
import { queryKeys } from '@/lib/react-query/query-keys';

export default async function UserSubmissionsPage() {
  await requireSession(PortalRole.EMPLOYEE);
  const queryClient = getQueryClient();

  await queryClient.prefetchQuery({
    queryKey: queryKeys.availability.history(),
    queryFn: fetchMyEmployeeAvailability,
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient, dehydrateOptions())}>
      <EmployeeSubmissionsClient />
    </HydrationBoundary>
  );
}
