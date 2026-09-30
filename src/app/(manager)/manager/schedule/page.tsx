import { PortalRole } from '@/lib/auth/portal';
import { requireSession } from '@/lib/db/auth-helpers';
import { ManagerScheduleScreen } from '@/features/schedules/screens/manager-chedule-screen';

export default async function ManagerSchedulePage() {
  const session = await requireSession(PortalRole.MANAGER);

  if (!session.user.facilityId) {
    return <div dir="rtl">המשתמש לא משויך לבית משפט.</div>;
  }

  return <ManagerScheduleScreen />;
}
