import { requireSession } from '@/lib/db/auth-helpers';
import { SystemRole } from '@/generated/prisma/client';
import { getEmployeeAvailability } from '@/features/availability/actions';
import { AvailabilityHistoryClient } from '@/features/availability/components/availability-history-client';
import { availabilityEntriesToRecord } from '@/features/availability/utils';

export default async function UserScheduleHistoryPage() {
  const session = await requireSession(SystemRole.EMPLOYEE);
  const periods = await getEmployeeAvailability(session.user.employeeId);

  const historyPayload = periods.map((p) => {
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
      <h1 className="text-xl font-bold">היסטוריית זמינות</h1>
      <p className="text-sm text-muted-foreground -mt-2">
        בחרו תקופה כדי לראות את לוח הזמינות שהוגש או נשמר בתקופה זו.
      </p>
      <AvailabilityHistoryClient periods={historyPayload} />
    </div>
  );
}
