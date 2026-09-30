import { PortalRole } from '@/lib/auth/portal';
import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { requireSession } from '@/lib/db/auth-helpers';
import { fetchCurrentSchedule } from '@/features/schedules/assignments/actions';
import { dehydrateOptions, getQueryClient } from '@/lib/react-query/get-query-client';
import { queryKeys } from '@/lib/react-query/query-keys';

import { EmployeeScheduleScreen } from '@/features/schedules/screens/employee-schedule-screen';

export default async function EmployeeSchedulePage() {
  const session = await requireSession(PortalRole.EMPLOYEE);

  if (!session.user.employeeId) {
    return <div dir="rtl">המשתמש לא משויך לעובד.</div>;
  }

  const queryClient = getQueryClient();

  await queryClient.prefetchQuery({
    queryKey: queryKeys.schedules.employeeCurrent(),
    queryFn: fetchCurrentSchedule,
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient, dehydrateOptions())}>
      <EmployeeScheduleScreen employeeId={session.user.employeeId} />
    </HydrationBoundary>
  );
}
