import type { PeriodStatus } from '@/generated/prisma/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const TZ = 'Asia/Jerusalem'

const PERIOD_STATUS_HE: Record<PeriodStatus, string> = {
  DRAFT: 'טיוטה',
  OPEN_FOR_SUBMISSION: 'פתוח להגשות',
  LOCKED: 'נעול',
  ARCHIVED: 'בארכיון',
}

function formatDateLong(d: Date): string {
  return new Intl.DateTimeFormat('he-IL', {
    dateStyle: 'long',
    timeZone: TZ,
  }).format(d)
}

function formatDateTimeLong(d: Date): string {
  return new Intl.DateTimeFormat('he-IL', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: TZ,
  }).format(d)
}

export type CurrentSchedulingPeriodSummary = {
  name: string
  startDate: Date
  endDate: Date
  submissionDeadline: Date
  status: PeriodStatus
}

type Props = {
  period: CurrentSchedulingPeriodSummary | null
}

export function CurrentPeriodPanel({ period }: Props) {
  if (!period) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground text-sm">
            אין תקופת תזמון שמכסה את היום (לפי לוח השנה בישראל).
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{period.name}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div>
          <p className="text-muted-foreground text-xs">טווח התקופה (14 ימים)</p>
          <p className="font-medium" dir="ltr">
            {formatDateLong(period.startDate)} – {formatDateLong(period.endDate)}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs">מועד אחרון להגשה</p>
          <p className="font-medium">{formatDateTimeLong(period.submissionDeadline)}</p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs">סטטוס</p>
          <p className="font-medium">{PERIOD_STATUS_HE[period.status]}</p>
        </div>
      </CardContent>
    </Card>
  )
}
