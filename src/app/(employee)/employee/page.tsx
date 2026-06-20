import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { requireSession } from '@/lib/db/auth-helpers';
import { SystemRole } from '@/generated/prisma/client';
import { fetchEmployeeCurrentSchedule } from '@/features/schedules/assignments/actions';
import { dehydrateOptions, getQueryClient } from '@/lib/react-query/get-query-client';
import { queryKeys } from '@/lib/react-query/query-keys';
import { EmployeeCurrentScheduleScreen } from '@/features/schedules/screens/employee-current-schedule-screen';

export default async function EmployeeCurrentSchedulePage() {
  const session = await requireSession(SystemRole.EMPLOYEE);

  if (!session.user.employeeId) {
    return <div dir="rtl">המשתמש לא משויך לעובד.</div>;
  }

  const queryClient = getQueryClient();

  await queryClient.prefetchQuery({
    queryKey: queryKeys.schedules.employeeCurrent(),
    queryFn: fetchEmployeeCurrentSchedule,
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient, dehydrateOptions())}>
      <EmployeeCurrentScheduleScreen employeeId={session.user.employeeId} />
    </HydrationBoundary>
  );
}
