import { PortalRole } from '@/lib/auth/portal';
import { requireSession } from '@/lib/db/auth-helpers';
import { ManagerScheduleScreen } from '@/features/schedules/screens/manager-chedule-screen';
import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { fetchCurrentSchedule } from '@/features/schedules/assignments/actions';
import { dehydrateOptions, getQueryClient } from '@/lib/react-query/get-query-client';
import { queryKeys } from '@/lib/react-query/query-keys';

export default async function ManagerSchedulePage() {
  const session = await requireSession(PortalRole.MANAGER);

  if (!session.user.facilityId) {
    return <div dir="rtl">המשתמש לא משויך לבית משפט.</div>;
  }

  const queryClient = getQueryClient();
  await queryClient.prefetchQuery({
    queryKey: queryKeys.schedules.current(),
    queryFn: fetchCurrentSchedule,
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient, dehydrateOptions())}>
      <ManagerScheduleScreen />
    </HydrationBoundary>
  );
}
