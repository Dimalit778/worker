import { PortalRole } from '@/lib/auth/portal';
import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { requireSession } from '@/lib/db/auth-helpers';
import { EmployeesListScreen } from '@/features/employess/EmployeesListScreen';
import { getEmployeesPageData } from '@/features/employess/actions';
import { dehydrateOptions, getQueryClient } from '@/lib/react-query/get-query-client';
import { queryKeys } from '@/lib/react-query/query-keys';

export default async function EmployeesList() {
  await requireSession(PortalRole.MANAGER);
  const queryClient = getQueryClient();

  await queryClient.prefetchQuery({
    queryKey: queryKeys.employees.list(),
    queryFn: () => getEmployeesPageData(),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient, dehydrateOptions())}>
      <EmployeesListScreen />
    </HydrationBoundary>
  );
}
