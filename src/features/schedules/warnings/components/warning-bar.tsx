import { CardContent } from '@/components/ui/card';
export function WarningBar({
  submitted,
  eligible,
  submissionPct,
  missingEmployees,
}: {
  submitted: number;
  eligible: number;
  submissionPct: number;
  missingEmployees: { id: string; displayName: string; positionName: string | null }[];
}) {
  return (
    <CardContent className="pt-4">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.8fr)]">
        <div className="rounded-2xl border border-border/60 bg-muted/25 px-4 py-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">הגשות זמינות</p>
              <p className="mt-1 text-xs text-muted-foreground">עובדים פעילים שסימנו ושלחו זמינות לתקופה</p>
            </div>
            <p className="tabular-nums">
              <span className="text-2xl font-semibold tracking-tight">{submitted}</span>
              <span className="text-muted-foreground"> / {eligible}</span>
            </p>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out"
              style={{ width: `${submissionPct}%` }}
              role="progressbar"
              aria-valuenow={submissionPct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${submissionPct} אחוז מהעובדים הפעילים הגישו זמינות`}
            />
          </div>
        </div>

        <div className="rounded-2xl border border-border/60 bg-background px-4 py-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">לא הגישו</p>
              <p className="mt-1 text-xs text-muted-foreground">עובדים פעילים ללא הגשת זמינות</p>
            </div>
            <p className="tabular-nums">
              <span className="text-2xl font-semibold tracking-tight">{missingEmployees.length}</span>
            </p>
          </div>
          {missingEmployees.length > 0 ? (
            <ul className="mt-3 max-h-28 space-y-1 overflow-y-auto pe-1 text-sm">
              {missingEmployees.map((employee) => (
                <li
                  key={employee.id}
                  className="flex items-center justify-between gap-3 rounded-md bg-muted/40 px-2 py-1"
                >
                  <span className="font-medium">{employee.displayName}</span>
                  {employee.positionName && (
                    <span className="shrink-0 text-xs text-muted-foreground">{employee.positionName}</span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 rounded-md bg-green-50 px-2 py-2 text-sm text-green-800">
              כל העובדים הפעילים הגישו זמינות.
            </p>
          )}
        </div>
      </div>
    </CardContent>
  );
}
