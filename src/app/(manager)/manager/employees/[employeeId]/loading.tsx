export default function LoadingEmployeePage() {
  return (
    <div className="space-y-6" dir="rtl">
      <div className="space-y-3">
        <div className="h-4 w-24 animate-pulse rounded bg-muted" />
        <div className="flex items-center gap-3">
          <div className="size-14 animate-pulse rounded-lg bg-muted" />
          <div className="space-y-2">
            <div className="h-7 w-44 animate-pulse rounded bg-muted" />
            <div className="h-4 w-28 animate-pulse rounded bg-muted" />
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="h-24 animate-pulse rounded-xl border bg-muted/30" />
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="space-y-6">
          <div className="h-72 animate-pulse rounded-xl border bg-muted/30" />
          <div className="h-80 animate-pulse rounded-xl border bg-muted/30" />
        </div>
        <div className="space-y-6">
          <div className="h-64 animate-pulse rounded-xl border bg-muted/30" />
          <div className="h-72 animate-pulse rounded-xl border bg-muted/30" />
        </div>
      </div>
    </div>
  );
}
