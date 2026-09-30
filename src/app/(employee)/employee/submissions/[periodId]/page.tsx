import { PortalRole } from '@/lib/auth/portal';
import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { notFound } from 'next/navigation';
import { EmployeeSubmissionPeriodClient } from '@/features/availability/components/employee-submission-period-client';
import { fetchMyEmployeeAvailability } from '@/features/availability/actions';
import { requireSession } from '@/lib/db/auth-helpers';
import { dehydrateOptions, getQueryClient } from '@/lib/react-query/get-query-client';
import { queryKeys } from '@/lib/react-query/query-keys';

type UserSubmissionPeriodPageProps = {
  params: Promise<{ periodId: string }>;
};

export default async function UserSubmissionPeriodPage({ params }: UserSubmissionPeriodPageProps) {
  await requireSession(PortalRole.EMPLOYEE);
  const { periodId } = await params;
  const queryClient = getQueryClient();

  await queryClient.prefetchQuery({
    queryKey: queryKeys.availability.history(),
    queryFn: fetchMyEmployeeAvailability,
  });

  const prefetched = queryClient.getQueryData(queryKeys.availability.history());
  if (Array.isArray(prefetched) && !prefetched.some((item) => item.id === periodId)) {
    notFound();
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient, dehydrateOptions())}>
      <EmployeeSubmissionPeriodClient periodId={periodId} />
    </HydrationBoundary>
  );
}
