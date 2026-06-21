import { requireSession } from '@/lib/db/auth-helpers';
import { SystemRole } from '@/generated/prisma/client';
import { ManagerCurrentScheduleScreen } from '@/features/schedules/screens/manager-current-schedule-screen';

export default async function ManagerCurrentSchedulePage() {
  const session = await requireSession(SystemRole.MANAGER);

  if (!session.user.courtId) {
    return <div dir="rtl">המשתמש לא משויך לבית משפט.</div>;
  }

  return <ManagerCurrentScheduleScreen />;
}
