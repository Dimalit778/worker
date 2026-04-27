import { requireSession } from '@/lib/db/auth-helpers';
import { SystemRole } from '@/generated/prisma/client';
import { getPositions, getShiftCapacities } from '@/features/court-settings/queries';
import { CourtCapacityRules } from '@/features/court-settings/components/court-capacity';
import { PositionOrderSection } from '@/features/court-settings/components/position-order-section';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ListOrdered, SlidersHorizontal } from 'lucide-react';

export default async function ManagerSettingsPage() {
  const session = await requireSession(SystemRole.MANAGER);
  const courtId = session.user.courtId ?? '';

  const capacities = await getShiftCapacities(courtId);
  const positions = await getPositions(courtId);

  return (
    <div className="mx-auto w-full max-w-4xl space-y-8 pb-8 pt-1" dir="rtl">
      <header className="space-y-2 border-b border-border/60 pb-8">
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">הגדרות</h1>
        <p className="max-w-2xl text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">
          נהל את רשימת התפקידים ואת סידור הופעתם במסכים, ואת דרישות כוח האדם לפי ימים ומשמרות.
        </p>
      </header>

      <div className="space-y-6 sm:space-y-8">
        <Card className="overflow-hidden border-border/80 shadow-sm">
          <CardHeader className="space-y-1 border-b border-border/50 bg-muted/20 pb-4 sm:pb-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-semibold text-primary"
                aria-hidden
              >
                <ListOrdered className="h-4 w-4" />
              </span>
              <div className="min-w-0 space-y-1.5">
                <CardTitle className="text-lg sm:text-xl">תפקידים וסידור</CardTitle>
                <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
                  הגדר שמות, צור תפקידים חדשים והזז אותם בטבלה. הסדר משפיע על מסכי קיבולת ורשימות.
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-5 sm:pt-6">
            <PositionOrderSection positions={positions} />
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-border/80 shadow-sm ">
          <CardHeader className="space-y-1 border-b border-border/50 bg-muted/20 pb-4 sm:pb-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-semibold text-primary"
                aria-hidden
              >
                <SlidersHorizontal className="h-4 w-4" />
              </span>
              <div className="min-w-0 space-y-1.5">
                <CardTitle className="text-lg sm:text-xl">תקנים משמרות</CardTitle>
                <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
                  לכל סוג יום, עדכן כמה אנשי צוות נחוצים בכל תפקיד ובכל משמרת.
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-5 sm:pt-6">
            <CourtCapacityRules positions={positions} initialCapacities={capacities} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
