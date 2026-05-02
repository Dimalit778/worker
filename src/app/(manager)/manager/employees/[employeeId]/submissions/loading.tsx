export default function LoadingEmployeeSubmissionsPage() {
  return (
    <div className="space-y-6" dir="rtl">
      <div className="space-y-3">
        <div className="h-4 w-28 animate-pulse rounded bg-muted" />
        <div className="flex items-center gap-3">
          <div className="size-12 animate-pulse rounded-lg bg-muted" />
          <div className="space-y-2">
            <div className="h-7 w-36 animate-pulse rounded bg-muted" />
            <div className="h-4 w-48 animate-pulse rounded bg-muted" />
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="h-24 animate-pulse rounded-xl border bg-muted/30" />
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[23rem_minmax(0,1fr)]">
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-32 animate-pulse rounded-lg border bg-muted/30" />
          ))}
        </div>
        <div className="h-[36rem] animate-pulse rounded-lg border bg-muted/30" />
      </div>
    </div>
  );
}
