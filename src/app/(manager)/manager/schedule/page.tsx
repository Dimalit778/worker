import { requireSession } from '@/lib/db/auth-helpers';
import { SystemRole } from '@/generated/prisma/client';
import { ManagerScheduleScreen } from '@/features/schedules/screens/manager-chedule-screen';

export default async function ManagerSchedulePage() {
  const session = await requireSession(SystemRole.MANAGER);

  if (!session.user.courtId) {
    return <div dir="rtl">המשתמש לא משויך לבית משפט.</div>;
  }

  return <ManagerScheduleScreen />;
}
