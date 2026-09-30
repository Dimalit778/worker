'use client';

import { SubmissionsTable } from '@/features/availability/components/submissions-table';
import { availabilityPreferencesToRecord, countAvailableEntries } from '@/features/availability/utils';
import { useMyEmployeeSubmissions } from '@/features/availability/hooks';

export function EmployeeSubmissionsClient() {
  const { data: periods = [], isLoading, isError } = useMyEmployeeSubmissions();

  if (isLoading) {
    return <p className="text-sm text-muted-foreground" dir="rtl">טוען הגשות...</p>;
  }

  if (isError) {
    return <p className="text-sm text-destructive" dir="rtl">לא ניתן לטעון ההגשות.</p>;
  }

  const submissionsPayload = periods.map((p) => {
    const entries = availabilityPreferencesToRecord(p.entries);
    const selectedSlotCount = countAvailableEntries(entries);
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
