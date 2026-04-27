import { DayCategory, ShiftType } from '@/generated/prisma/client';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { addPositionWithCapacities } from '../actions';
import { DAY_ORDER, DAY_META, SHIFT_LABELS, SHIFT_ORDER } from '../constans';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

const SHIFT_SCOPE_OPTIONS: { value: ShiftType | 'ALL'; label: string }[] = SHIFT_ORDER.map((shift) => ({
  value: shift,
  label: SHIFT_LABELS[shift],
}));
const DAY_CATEGORY_OPTIONS: { value: DayCategory | 'ALL'; label: string }[] = DAY_ORDER.map((day) => ({
  value: day,
  label: day === 'ALL' ? 'כל הימים' : DAY_META[day].label,
}));

export const AddPositionModal = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  const router = useRouter();
  const [errorMsg, setErrorMsg] = useState('');
  const [isPending, startTransition] = useTransition();

  if (!open) {
    return null;
  }

  function handleSubmitWithCapacities(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name = (fd.get('name') as string) ?? '';
    const dayCategory = fd.get('dayCategory') as DayCategory;
    const shiftScope = fd.get('shiftScope') as ShiftType | 'ALL';
    const amountRaw = fd.get('amount') as string;

    setErrorMsg('');
    startTransition(async () => {
      const amount = parseInt(amountRaw, 10);
      const res = await addPositionWithCapacities({
        name,
        dayCategory,
        shiftScope,
        amount,
      });

      if ('error' in res) {
        setErrorMsg(res.error ?? '');
        return;
      }

      onClose();
      router.refresh();
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      dir="rtl"
      role="presentation"
      onClick={(ev) => {
        if (ev.target === ev.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl bg-background p-6 shadow-2xl ring-1 ring-border"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-position-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 id="add-position-title" className="text-lg font-semibold">
            הוספת תפקיד עם קיבולת
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="סגור"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmitWithCapacities} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="position-name">שם התפקיד</Label>
            <Input id="position-name" name="name" required autoComplete="off" placeholder="לדוגמה: קצין מתקן" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="day-category">סוג יום</Label>
            <select
              id="day-category"
              name="dayCategory"
              required
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              defaultValue="WEEKDAY"
            >
              {DAY_CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="shift-scope">משמרת</Label>
            <select
              id="shift-scope"
              name="shiftScope"
              required
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              defaultValue="MORNING"
            >
              {SHIFT_SCOPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="capacity-amount">כמות (קיבולת)</Label>
            <Input id="capacity-amount" name="amount" type="number" min={0} max={50} required defaultValue={1} />
          </div>

          {errorMsg ? <p className="text-sm text-destructive">{errorMsg}</p> : null}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
              ביטול
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'שומר...' : 'הוסף'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
