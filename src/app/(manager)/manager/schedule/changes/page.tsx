import { PortalRole } from '@/lib/auth/portal';
import { requireSession } from '@/lib/db/auth-helpers';
import { fetchActiveAndUpcomingScheduleChangeLogs } from '@/features/schedules/change-log/actions';
import { ChangeLogList } from '@/features/schedules/change-log/change-log-list';

export default async function ScheduleChangesPage() {
  const session = await requireSession(PortalRole.MANAGER);

  if (!session.user.facilityId) {
    return <div dir="rtl">המשתמש לא משויך לבית משפט.</div>;
  }

  const groups = await fetchActiveAndUpcomingScheduleChangeLogs();

  return (
    <div className="space-y-4" dir="rtl">
      <h1 className="text-xl font-bold">היסטוריית שינויים</h1>
      <ChangeLogList groups={groups} />
    </div>
  );
}
