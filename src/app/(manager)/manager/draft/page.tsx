import { PortalRole } from '@/lib/auth/portal';
import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { requireSession } from '@/lib/db/auth-helpers';
import { ManagerDraftScreen } from '@/features/schedules/screens/manager-draft-screen';
import { fetchDraftSchedule } from '@/features/schedules/assignments/actions';
import { dehydrateOptions, getQueryClient } from '@/lib/react-query/get-query-client';
import { queryKeys } from '@/lib/react-query/query-keys';

export default async function ManagerDraftSchedulePage({ searchParams }: { searchParams: Promise<{ scheduleId?: string }> }) {
  const { scheduleId } = await searchParams;
  await requireSession(PortalRole.MANAGER);
  const queryClient = getQueryClient();

  await queryClient.prefetchQuery({
    queryKey: [...queryKeys.schedules.draft(), scheduleId ?? 'latest'],
    queryFn: () => fetchDraftSchedule(scheduleId),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient, dehydrateOptions())}>
      <ManagerDraftScreen />
    </HydrationBoundary>
  );
}
