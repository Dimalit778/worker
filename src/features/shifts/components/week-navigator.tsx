import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

type Props = {
  weekIndex: number; // 0 or 1
  onWeekChange: (w: number) => void;
  week0Label: string; // e.g. "22–28 מרץ"
  week1Label: string; // e.g. "15–21 מרץ"
};

export function WeekNavigator({ weekIndex, onWeekChange, week0Label, week1Label }: Props) {
  const label = weekIndex === 0 ? week0Label : week1Label;

  return (
    <div className="flex justify-center mb-5" dir="rtl">
      <div className="flex items-center gap-3 bg-white border border-border rounded-xl px-4 py-2 shadow-sm">
        {/* In RTL: ChevronRight sits on the right → navigates to week 1 (earlier dates) */}
        <button
          onClick={() => onWeekChange(0)}
          disabled={weekIndex === 0}
          className={cn(
            'flex items-center justify-center w-8 h-8 rounded-md border border-border bg-muted text-muted-foreground transition-colors',
            weekIndex === 0 ? 'opacity-30 cursor-default' : 'hover:bg-accent',
          )}
          aria-label="שבוע א׳"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        <div className="flex flex-col items-center gap-1 min-w-[180px]">
          <span className="font-semibold text-sm">{label}</span>
          <div className="flex gap-1.5">
            <div className={cn('w-2 h-2 rounded-full', weekIndex === 0 ? 'bg-primary' : 'bg-muted-foreground/30')} />
            <div className={cn('w-2 h-2 rounded-full', weekIndex === 1 ? 'bg-primary' : 'bg-muted-foreground/30')} />
          </div>
        </div>

        {/* ChevronLeft sits on the left in RTL → navigates to week 2 (later dates) */}
        <button
          onClick={() => onWeekChange(1)}
          disabled={weekIndex === 1}
          className={cn(
            'flex items-center justify-center w-8 h-8 rounded-md border border-border bg-muted text-muted-foreground transition-colors',
            weekIndex === 1 ? 'opacity-30 cursor-default' : 'hover:bg-accent',
          )}
          aria-label="שבוע ב׳"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
