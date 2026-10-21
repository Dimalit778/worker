import { requireEmployee } from '@/lib/db/auth-helpers';
import { getFacilitySchedules } from '@/features/schedules/schedulecard/queries';
import { SchedulesList } from '@/features/schedules/schedulecard/schedules-list';

export default async function EmployeeSchedulesPage() {
  const { facilityId } = await requireEmployee();
  const schedules = await getFacilitySchedules(facilityId, 'published');

  return (
    <div className="space-y-4" dir="rtl">
      <h1 className="text-xl font-bold">כל השיבוצים</h1>
      <SchedulesList schedules={schedules} basePath="/employee/schedules" />
    </div>
  );
}
