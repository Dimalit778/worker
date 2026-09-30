'use client';

import { CalendarClock, ListOrdered, SlidersHorizontal } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CourtCapacityRules } from '@/features/settings/components/court-capacity';
import { PositionOrderSection } from '@/features/settings/components/position-order-section';
import { SubmissionWindowSection } from '@/features/settings/components/submission-window-section';
import {
  useManagerPositions,
  useManagerShiftCapacities,
  useManagerShiftStaffingPositions,
  useSubmissionWindowRule,
} from '@/features/settings/hooks';

type ManagerSettingsClientProps = {
  facilityId: string;
};

export function ManagerSettingsClient({ facilityId }: ManagerSettingsClientProps) {
  const { data: positions = [] } = useManagerPositions(facilityId);
  const { data: capacities = [] } = useManagerShiftCapacities(facilityId);
  const { data: shiftStaffingPositions = [] } = useManagerShiftStaffingPositions(facilityId);
  const { data: submissionWindow, isSuccess: submissionWindowReady } = useSubmissionWindowRule();

  return (
    <div className="mx-auto w-full max-w-4xl space-y-8 pb-8 pt-1" dir="rtl">
      <header className="space-y-2 border-b border-border/60 pb-8">
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">הגדרות</h1>
        <p className="max-w-2xl text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">
          נהל תפקידים, דרישות כוח אדם, ואת המועדים הקבועים לפתיחה ולסגירה של הגשת זמינות.
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
            <PositionOrderSection facilityId={facilityId} positions={positions} />
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
            <CourtCapacityRules facilityId={facilityId} positions={shiftStaffingPositions} initialCapacities={capacities} />
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-border/80 shadow-sm">
          <CardHeader className="space-y-1 border-b border-border/50 bg-muted/20 pb-4 sm:pb-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-semibold text-primary"
                aria-hidden
              >
                <CalendarClock className="h-4 w-4" />
              </span>
              <div className="min-w-0 space-y-1.5">
                <CardTitle className="text-lg sm:text-xl">מועדי הגשה</CardTitle>
                <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
                  יום ושעה קבועים בשבוע שלפני התקופה, לשליחת הטופס לעובדים ולסגירת ההגשה.
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-5 sm:pt-6">
            {submissionWindowReady ? (
              <SubmissionWindowSection facilityId={facilityId} rule={submissionWindow ?? null} />
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
