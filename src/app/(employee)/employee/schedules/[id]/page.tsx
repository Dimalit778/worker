import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireEmployee } from '@/lib/db/auth-helpers';
import { getPublishedScheduleById } from '@/features/schedules/assignments/queries';
import { CurrentScheduleScreen } from '@/features/schedules/screens/current-schedule-screen';

export default async function EmployeeScheduleByIdPage({ params }: { params: Promise<{ id: string }> }) {
  const { facilityId, employeeId } = await requireEmployee();
  const { id } = await params;
  const data = await getPublishedScheduleById(id, facilityId);
  if (!data) notFound();

  return (
    <div className="space-y-4" dir="rtl">
      <Link href="/employee/schedules" className="text-sm font-medium text-primary underline underline-offset-4">חזרה לכל השיבוצים</Link>
      <h1 className="text-xl font-bold">{data.scheduleName}</h1>
      <CurrentScheduleScreen
        data={data}
        isLoading={false}
        isError={false}
        loadingMessage="טוען שיבוץ..."
        errorMessage="לא ניתן לטעון את השיבוץ."
        currentEmployeeId={employeeId}
        isReadOnly
      />
    </div>
  );
}
