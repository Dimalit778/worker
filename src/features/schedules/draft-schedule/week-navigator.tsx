import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

type Props = {
  index: number;
  onChange: (index: number) => void;
  labels: string[];
  prevAriaLabel?: string;
  nextAriaLabel?: string;
};

export function WeekNavigator({
  index,
  onChange,
  labels,
  prevAriaLabel = 'הקודם',
  nextAriaLabel = 'הבא',
}: Props) {
  const count = labels.length;
  const lastIndex = Math.max(0, count - 1);
  const label = labels[index] ?? labels[0] ?? '';
  const atStart = index <= 0;
  const atEnd = index >= lastIndex;

  const navButtonClass = (disabled: boolean) =>
    cn(
      'flex size-8 shrink-0 items-center justify-center rounded-[6px] border border-border text-card-foreground/80 transition-colors',
      disabled ? 'cursor-default opacity-30' : 'hover:bg-muted hover:text-card-foreground',
    );

  return (
    <div
      className="flex items-center justify-between gap-3 rounded-md border border-border bg-card px-2 py-1.5 shadow-[var(--glass-shadow)] md:justify-start md:gap-6"
      dir="rtl"
    >
      <button
        type="button"
        onClick={() => onChange(index - 1)}
        disabled={atStart}
        className={navButtonClass(atStart)}
        aria-label={prevAriaLabel}
      >
        <ChevronRight className="h-4 w-4" strokeWidth={1.75} />
      </button>

      <div className="flex min-w-[11rem] flex-col items-center gap-1 px-2">
        <span className="text-sm font-semibold tabular-nums tracking-wide text-card-foreground">{label}</span>
        {count > 1 ? (
          <div className="flex gap-1.5" aria-hidden>
            {Array.from({ length: count }, (_, i) => (
              <div
                key={i}
                className={cn(
                  'h-1.5 w-1.5 rounded-full transition-colors',
                  index === i ? 'bg-primary' : 'bg-muted-foreground/35',
                )}
              />
            ))}
          </div>
        ) : null}
      </div>

      <button
        type="button"
        onClick={() => onChange(index + 1)}
        disabled={atEnd}
        className={navButtonClass(atEnd)}
        aria-label={nextAriaLabel}
      >
        <ChevronLeft className="h-4 w-4" strokeWidth={1.75} />
      </button>
    </div>
  );
}
