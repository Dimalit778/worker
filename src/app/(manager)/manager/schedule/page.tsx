import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { requireSession } from '@/lib/db/auth-helpers';
import { SystemRole } from '@/generated/prisma/client';
import { ManagerCurrentScheduleScreen } from '@/features/schedules/screens/manager-current-schedule-screen';
import { fetchCurrentSchedule } from '@/features/schedules/assignments/actions';
import { dehydrateOptions, getQueryClient } from '@/lib/react-query/get-query-client';
import { queryKeys } from '@/lib/react-query/query-keys';

export default async function ManagerCurrentSchedulePage() {
  const session = await requireSession(SystemRole.MANAGER);

  if (!session.user.courtId) {
    return <div dir="rtl">המשתמש לא משויך לבית משפט.</div>;
  }

  const queryClient = getQueryClient();

  await queryClient.prefetchQuery({
    queryKey: queryKeys.schedules.current(),
    queryFn: fetchCurrentSchedule,
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient, dehydrateOptions())}>
      <ManagerCurrentScheduleScreen />
    </HydrationBoundary>
  );
}
