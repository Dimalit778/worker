import { notFound } from 'next/navigation';
import { PortalRole } from '@/lib/auth/portal';
import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { requireSession } from '@/lib/db/auth-helpers';
import { ManagerDraftScreen } from '@/features/schedules/screens/manager-draft-screen';
import { fetchDraftSchedule } from '@/features/schedules/assignments/actions';
import { dehydrateOptions, getQueryClient } from '@/lib/react-query/get-query-client';
import { queryKeys } from '@/lib/react-query/query-keys';

export default async function ManagerScheduleByIdPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireSession(PortalRole.MANAGER);

  const data = await fetchDraftSchedule(id);
  if (!data) notFound();

  const queryClient = getQueryClient();
  queryClient.setQueryData([...queryKeys.schedules.draft(), id], data);

  return (
    <HydrationBoundary state={dehydrate(queryClient, dehydrateOptions())}>
      <ManagerDraftScreen scheduleId={id} />
    </HydrationBoundary>
  );
}
