import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { requireSession } from '@/lib/db/auth-helpers';
import { SystemRole } from '@/generated/prisma/client';
import { EmployeeAvailabilityClient } from '@/features/availability/components/employee-availability-client';
import { getScheduleData } from '@/features/availability/actions';
import { dehydrateOptions, getQueryClient } from '@/lib/react-query/get-query-client';
import { queryKeys } from '@/lib/react-query/query-keys';

export default async function UserAvailabilityPage() {
  await requireSession(SystemRole.EMPLOYEE);
  const queryClient = getQueryClient();

  await queryClient.prefetchQuery({
    queryKey: queryKeys.availability.current(),
    queryFn: getScheduleData,
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient, dehydrateOptions())}>
      <EmployeeAvailabilityClient />
    </HydrationBoundary>
  );
}
