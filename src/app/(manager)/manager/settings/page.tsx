import { PortalRole } from '@/lib/auth/portal';
import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { requireSession } from '@/lib/db/auth-helpers';
import { ManagerSettingsClient } from '@/features/settings/components/manager-settings-client';
import {
  getPositions,
  getShiftCapacities,
  getShiftStaffingPositions,
  getSubmissionWindowRule,
} from '@/features/settings/queries';
import { dehydrateOptions, getQueryClient } from '@/lib/react-query/get-query-client';
import { queryKeys } from '@/lib/react-query/query-keys';

export default async function ManagerSettingsPage() {
  const session = await requireSession(PortalRole.MANAGER);
  const facilityId = session.user.facilityId ?? '';
  const queryClient = getQueryClient();

  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: queryKeys.settings.positions(facilityId),
      queryFn: () => getPositions(facilityId),
    }),
    queryClient.prefetchQuery({
      queryKey: queryKeys.settings.capacities(facilityId),
      queryFn: () => getShiftCapacities(facilityId),
    }),
    queryClient.prefetchQuery({
      queryKey: queryKeys.settings.shiftStaffingPositions(facilityId),
      queryFn: () => getShiftStaffingPositions(facilityId),
    }),
    queryClient.prefetchQuery({
      queryKey: queryKeys.settings.submissionWindow(),
      queryFn: () => getSubmissionWindowRule(facilityId),
    }),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient, dehydrateOptions())}>
      <ManagerSettingsClient facilityId={facilityId} />
    </HydrationBoundary>
  );
}
