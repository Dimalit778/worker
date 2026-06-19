import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { ManagerDashboardClient } from '@/features/dashboard/components/manager-dashboard-client';
import { getManagerDashboardData } from '@/features/dashboard/queries';
import { parseMonthParam } from '@/features/dashboard/utils';
import { dehydrateOptions, getQueryClient } from '@/lib/react-query/get-query-client';
import { queryKeys } from '@/lib/react-query/query-keys';

type ManagerDashboardPageProps = {
  searchParams: Promise<{ month?: string }>;
};

export default async function ManagerDashboardPage({ searchParams }: ManagerDashboardPageProps) {
  const { month } = await searchParams;
  const selection = parseMonthParam(month);
  const queryClient = getQueryClient();

  await queryClient.prefetchQuery({
    queryKey: queryKeys.dashboard.manager(selection.year),
    queryFn: () => getManagerDashboardData(selection.year),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient, dehydrateOptions())}>
      <ManagerDashboardClient year={selection.year} initialSelection={selection} />
    </HydrationBoundary>
  );
}
