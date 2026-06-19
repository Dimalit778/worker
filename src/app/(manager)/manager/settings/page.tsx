import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { requireSession } from '@/lib/db/auth-helpers';
import { SystemRole } from '@/generated/prisma/client';
import { ManagerSettingsClient } from '@/features/settings/components/manager-settings-client';
import { getPositions, getShiftCapacities, getShiftStaffingPositions } from '@/features/settings/queries';
import { dehydrateOptions, getQueryClient } from '@/lib/react-query/get-query-client';
import { queryKeys } from '@/lib/react-query/query-keys';

export default async function ManagerSettingsPage() {
  const session = await requireSession(SystemRole.MANAGER);
  const courtId = session.user.courtId ?? '';
  const queryClient = getQueryClient();

  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: queryKeys.settings.positions(courtId),
      queryFn: () => getPositions(courtId),
    }),
    queryClient.prefetchQuery({
      queryKey: queryKeys.settings.capacities(courtId),
      queryFn: () => getShiftCapacities(courtId),
    }),
    queryClient.prefetchQuery({
      queryKey: queryKeys.settings.shiftStaffingPositions(courtId),
      queryFn: () => getShiftStaffingPositions(courtId),
    }),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient, dehydrateOptions())}>
      <ManagerSettingsClient courtId={courtId} />
    </HydrationBoundary>
  );
}
