import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { requireSession } from '@/lib/db/auth-helpers';
import { SystemRole } from '@/generated/prisma/client';
import { ManagerEmployeesClient } from '@/features/employess/components/manager-employees-client';
import { getEmployeesPageData } from '@/features/employess/actions';
import { dehydrateOptions, getQueryClient } from '@/lib/react-query/get-query-client';
import { queryKeys } from '@/lib/react-query/query-keys';

export default async function ManagerEmployeesPage() {
  await requireSession(SystemRole.MANAGER);
  const queryClient = getQueryClient();

  await queryClient.prefetchQuery({
    queryKey: queryKeys.employees.list(),
    queryFn: getEmployeesPageData,
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient, dehydrateOptions())}>
      <ManagerEmployeesClient />
    </HydrationBoundary>
  );
}
