import { PortalRole } from '@/lib/auth/portal';
import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { notFound } from 'next/navigation';
import { ManagerEmployeeSubmissionsClient } from '@/features/employess/components/manager-employee-submissions-client';
import { getManagerEmployeeSubmissions } from '@/features/employess/actions';
import { requireSession } from '@/lib/db/auth-helpers';
import { dehydrateOptions, getQueryClient } from '@/lib/react-query/get-query-client';
import { queryKeys } from '@/lib/react-query/query-keys';

type ManagerEmployeeSubmissionsPageProps = {
  params: Promise<{ employeeId: string }>;
};

export default async function ManagerEmployeeSubmissionsPage({ params }: ManagerEmployeeSubmissionsPageProps) {
  await requireSession(PortalRole.MANAGER);
  const { employeeId } = await params;
  const queryClient = getQueryClient();

  await queryClient.prefetchQuery({
    queryKey: queryKeys.employees.submissions(employeeId),
    queryFn: () => getManagerEmployeeSubmissions(employeeId),
  });

  const prefetched = queryClient.getQueryData(queryKeys.employees.submissions(employeeId));
  if (prefetched && typeof prefetched === 'object' && 'error' in prefetched) notFound();

  return (
    <HydrationBoundary state={dehydrate(queryClient, dehydrateOptions())}>
      <ManagerEmployeeSubmissionsClient employeeId={employeeId} />
    </HydrationBoundary>
  );
}
