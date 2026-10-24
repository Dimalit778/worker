import { Scale } from 'lucide-react';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="auth-shell flex min-h-dvh flex-col items-center justify-center gap-8 px-4 py-12 max-md:scrollbar-hide">
      <div className="flex flex-col items-center gap-4">
        <div className="flex size-14 items-center justify-center rounded-full border border-border bg-secondary/50 shadow-[var(--glass-shadow)]">
          <Scale className="size-6 text-foreground" aria-hidden />
        </div>
        <p className="auth-eyebrow">מערכת ניהול ושיבוץ</p>
      </div>
      {children}
    </main>
  );
}
