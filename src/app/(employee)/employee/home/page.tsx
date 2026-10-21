import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { PortalRole } from '@/lib/auth/portal';
import { requireSession } from '@/lib/db/auth-helpers';
import { fetchCurrentSchedule } from '@/features/schedules/assignments/actions';
import { EmployeeHomeScreen } from '@/features/schedules/screens/employee-home-screen';
import { dehydrateOptions, getQueryClient } from '@/lib/react-query/get-query-client';
import { queryKeys } from '@/lib/react-query/query-keys';

export default async function EmployeeHomePage() {
  const session = await requireSession(PortalRole.EMPLOYEE);
  if (!session.user.employeeId) return <div dir="rtl">המשתמש לא משויך לעובד.</div>;

  const queryClient = getQueryClient();
  await queryClient.prefetchQuery({ queryKey: queryKeys.schedules.employeeCurrent(), queryFn: fetchCurrentSchedule });

  return (
    <HydrationBoundary state={dehydrate(queryClient, dehydrateOptions())}>
      <EmployeeHomeScreen employeeId={session.user.employeeId} initialNow={new Date().toISOString()} />
    </HydrationBoundary>
  );
}
