import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { notFound } from 'next/navigation';
import { SystemRole } from '@/generated/prisma/client';
import { ManagerEmployeeDetailClient } from '@/features/employess/components/manager-employee-detail-client';
import { getManagerEmployeeDetail } from '@/features/employess/actions';
import { requireSession } from '@/lib/db/auth-helpers';
import { dehydrateOptions, getQueryClient } from '@/lib/react-query/get-query-client';
import { queryKeys } from '@/lib/react-query/query-keys';

type ManagerEmployeePageProps = {
  params: Promise<{ employeeId: string }>;
};

export default async function ManagerEmployeePage({ params }: ManagerEmployeePageProps) {
  await requireSession(SystemRole.MANAGER);
  const { employeeId } = await params;
  const queryClient = getQueryClient();

  await queryClient.prefetchQuery({
    queryKey: queryKeys.employees.detail(employeeId),
    queryFn: () => getManagerEmployeeDetail(employeeId),
  });

  const prefetched = queryClient.getQueryData(queryKeys.employees.detail(employeeId));
  if (prefetched && typeof prefetched === 'object' && 'error' in prefetched) notFound();

  return (
    <HydrationBoundary state={dehydrate(queryClient, dehydrateOptions())}>
      <ManagerEmployeeDetailClient employeeId={employeeId} />
    </HydrationBoundary>
  );
}
