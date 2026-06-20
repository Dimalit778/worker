import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { requireSession } from '@/lib/db/auth-helpers';
import { SystemRole } from '@/generated/prisma/client';
import { fetchEmployeeActiveSchedule } from '@/features/schedules/assignments/actions';
import { dehydrateOptions, getQueryClient } from '@/lib/react-query/get-query-client';
import { queryKeys } from '@/lib/react-query/query-keys';
import { EmployeeActiveScheduleScreen } from '@/features/schedules/screens/employee-active-schedule-screen';

export default async function EmployeeActiveSchedulePage() {
  const session = await requireSession(SystemRole.EMPLOYEE);

  if (!session.user.employeeId) {
    return <div dir="rtl">המשתמש לא משויך לעובד.</div>;
  }

  const queryClient = getQueryClient();

  await queryClient.prefetchQuery({
    queryKey: queryKeys.schedules.employeeActive(),
    queryFn: fetchEmployeeActiveSchedule,
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient, dehydrateOptions())}>
      <EmployeeActiveScheduleScreen employeeId={session.user.employeeId} />
    </HydrationBoundary>
  );
}
