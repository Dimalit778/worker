import { requireSession } from '@/lib/auth-helpers';
import { SystemRole } from '@/generated/prisma/client';
import { getFullCapacityRules } from '@/features/shifts/queries';
import { CapacityRulesForm } from '@/features/shifts/components/capacity-rules-form';

export default async function ManagerSettingsPage() {
  const session = await requireSession(SystemRole.MANAGER);
  const courtId = session.user.primaryCourtId ?? '';
  const capacity = await getFullCapacityRules(courtId);

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h1 className="text-2xl font-bold">הגדרות</h1>
        <p className="text-sm text-muted-foreground">הגדרות בית המשפט שלך</p>
      </div>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">כללי קיבולת משמרות</h2>
        <p className="text-sm text-muted-foreground">מספר המקסימלי של עובדים לכל סוג משמרת בבית המשפט שלך.</p>
        <CapacityRulesForm initialValues={capacity} />
      </section>
    </div>
  );
}
