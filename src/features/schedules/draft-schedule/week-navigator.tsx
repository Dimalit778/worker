import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

type Props = {
  weekIndex: number;
  onWeekChange: (w: number) => void;
  week0Label: string;
  week1Label: string;
};

export function WeekNavigator({ weekIndex, onWeekChange, week0Label, week1Label }: Props) {
  const label = weekIndex === 0 ? week0Label : week1Label;

  return (
    <div className="mb-3 flex justify-center" dir="rtl">
      <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 shadow-sm">
        <button
          onClick={() => onWeekChange(0)}
          disabled={weekIndex === 0}
          className={cn(
            'flex size-8 items-center justify-center rounded-md border border-border bg-muted text-muted-foreground transition-colors',
            weekIndex === 0 ? 'cursor-default opacity-30' : 'hover:bg-accent',
          )}
          aria-label="שבוע א׳"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>

        <div className="flex min-w-[160px] flex-col items-center gap-0.5">
          <span className="text-sm font-semibold">{label}</span>
          <div className="flex gap-1">
            <div className={cn('h-1.5 w-1.5 rounded-full', weekIndex === 0 ? 'bg-primary' : 'bg-muted-foreground/30')} />
            <div className={cn('h-1.5 w-1.5 rounded-full', weekIndex === 1 ? 'bg-primary' : 'bg-muted-foreground/30')} />
          </div>
        </div>

        <button
          onClick={() => onWeekChange(1)}
          disabled={weekIndex === 1}
          className={cn(
            'flex size-8 items-center justify-center rounded-md border border-border bg-muted text-muted-foreground transition-colors',
            weekIndex === 1 ? 'cursor-default opacity-30' : 'hover:bg-accent',
          )}
          aria-label="שבוע ב׳"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
