import { requireSession } from '@/lib/db/auth-helpers';
import { SystemRole } from '@/generated/prisma/client';
import { getPositions, getShiftCapacities } from '@/features/court-settings/queries';
import { CourtCapacityRules } from '@/features/court-settings/components/court-capacity';

export default async function ManagerSettingsPage() {
  const session = await requireSession(SystemRole.MANAGER);
  const courtId = session.user.courtId ?? '';

  const capacities = await getShiftCapacities(courtId);
  const positions = await getPositions(courtId);

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">הגדרות</h1>
        <p className="text-sm text-muted-foreground">הגדרות בית המשפט שלך</p>
      </div>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">כללי קיבולת משמרות</h2>
        <p className="text-sm text-muted-foreground">
          סדר את רשימת התפקידים, ואז הגדר מספר עובדים נדרש לכל תפקיד, משמרת וסוג יום. לחץ על כמות
          לעריכה.
        </p>
        <CourtCapacityRules positions={positions} initialCapacities={capacities} />
      </section>
    </div>
  );
}
