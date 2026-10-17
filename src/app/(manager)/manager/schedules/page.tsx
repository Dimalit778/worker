import { PortalRole } from '@/lib/auth/portal';
import { requireSession } from '@/lib/db/auth-helpers';
import { SchedulesList } from '@/features/schedules/schedulecard/schedules-list';
import { getFacilitySchedules } from '@/features/schedules/schedulecard/queries';

export default async function ManagerSchedulesPage() {
  const session = await requireSession(PortalRole.MANAGER);

  if (!session.user.facilityId) {
    return <div dir="rtl">המשתמש לא משויך לבית משפט.</div>;
  }

  const schedules = await getFacilitySchedules(session.user.facilityId);

  return (
    <div className="space-y-4" dir="rtl">
      <h1 className="text-xl font-bold">כל השיבוצים</h1>
      <SchedulesList schedules={schedules} />
    </div>
  );
}
