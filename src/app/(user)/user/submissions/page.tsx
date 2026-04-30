import { requireSession } from '@/lib/db/auth-helpers';
import { SystemRole } from '@/generated/prisma/client';
import { getEmployeeAvailability } from '@/features/availability/actions';
import { SubmissionsTable } from '@/features/availability/components/submissions-table';
import { availabilityEntriesToRecord } from '@/features/availability/utils';

export default async function UserSubmissionsPage() {
  const session = await requireSession(SystemRole.EMPLOYEE);
  const periods = await getEmployeeAvailability(session.user.employeeId);

  const submissionsPayload = periods.map((p) => {
    const entries = availabilityEntriesToRecord(p.entries);
    const selectedSlotCount = Object.values(entries).filter(Boolean).length;
    return {
      id: p.id,
      name: p.name,
      startDate: p.startDate,
      endDate: p.endDate,
      status: p.status,
      isSubmitted: p.isSubmitted,
      entries,
      selectedSlotCount,
    };
  });

  return (
    <div className="space-y-6" dir="rtl">
      <h1 className="text-xl font-bold">ההגשות שלי</h1>
      <p className="text-sm text-muted-foreground -mt-2">בחרו תקופה כדי לראות את ההגשה שלכם בתקופה זו.</p>
      <SubmissionsTable periods={submissionsPayload} />
    </div>
  );
}
