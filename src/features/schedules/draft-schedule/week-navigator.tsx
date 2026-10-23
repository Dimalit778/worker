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

  return (
    <div className="mb-3 flex justify-center" dir="rtl">
      <div className="flex items-center gap-2 rounded-[8px] border border-border/60 bg-card px-3 py-1.5 shadow-sm">
        <button
          type="button"
          onClick={() => onChange(index - 1)}
          disabled={atStart}
          className={cn(
            'flex size-8 items-center justify-center rounded-md border border-border bg-muted text-muted-foreground transition-colors',
            atStart ? 'cursor-default opacity-30' : 'hover:bg-accent',
          )}
          aria-label={prevAriaLabel}
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>

        <div className="flex min-w-[160px] flex-col items-center gap-0.5">
          <span className="text-sm font-semibold tabular-nums">{label}</span>
          {count > 1 ? (
            <div className="flex gap-1">
              {Array.from({ length: count }, (_, i) => (
                <div
                  key={i}
                  className={cn(
                    'h-1.5 w-1.5 rounded-full',
                    index === i ? 'bg-primary' : 'bg-muted-foreground/30',
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
          className={cn(
            'flex size-8 items-center justify-center rounded-md border border-border bg-muted text-muted-foreground transition-colors',
            atEnd ? 'cursor-default opacity-30' : 'hover:bg-accent',
          )}
          aria-label={nextAriaLabel}
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
