export default function LoadingAdminPage() {
  return (
    <div className="space-y-6" dir="rtl">
      <div className="space-y-2">
        <div className="h-7 w-44 animate-pulse rounded bg-muted" />
        <div className="h-4 w-64 animate-pulse rounded bg-muted" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-24 animate-pulse rounded-xl border bg-muted/30" />
        ))}
      </div>

      <div className="h-96 animate-pulse rounded-xl border bg-muted/30" />
    </div>
  );
}
