import { requireSession } from '@/lib/db/auth-helpers';
import { SystemRole } from '@/generated/prisma/client';
import { getCourtShiftRoles } from '@/features/court-settings/queries';
import { ShiftRulesManager } from '@/features/court-settings/components/shift-rules-manager';

export default async function ManagerSettingsPage() {
  const session = await requireSession(SystemRole.MANAGER);
  const courtId = session.user.courtId ?? '';
  const roles = await getCourtShiftRoles(courtId);

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">הגדרות</h1>
        <p className="text-sm text-muted-foreground">הגדרות בית המשפט שלך</p>
      </div>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">כללי קיבולת משמרות</h2>
        <p className="text-sm text-muted-foreground">
          הגדר את מספר העובדים הנדרש לכל תפקיד, משמרת וסוג יום. לחץ על כמות כדי לערוך אותה.
        </p>
        <ShiftRulesManager initialRoles={roles} />
      </section>
    </div>
  );
}
