'use client';

import { useTransition, useState } from 'react';
import { Button } from '@/components/ui/button';
import { upsertCapacityRules } from '@/features/shifts/actions';
import type { CapacityMap, FullCapacityRules } from '@/features/shifts/types';

const SHIFT_LABELS: { key: keyof CapacityMap; label: string }[] = [
  { key: 'MORNING', label: 'בוקר' },
  { key: 'EVENING', label: 'ערב' },
  { key: 'NIGHT', label: 'לילה' },
];

const SECTIONS: { key: keyof FullCapacityRules; label: string; hint: string }[] = [
  { key: 'default', label: 'ברירת מחדל (ימים א׳–ה׳)', hint: 'חל על כל ימות השבוע שאין להם חריגה ספציפית' },
  { key: 'friday', label: 'יום שישי', hint: '0 = משמרת סגורה' },
  { key: 'saturday', label: 'שבת', hint: '0 = משמרת סגורה' },
];

function CapacitySection({
  label,
  hint,
  values,
  onChange,
}: {
  label: string;
  hint: string;
  values: CapacityMap;
  onChange: (shift: keyof CapacityMap, value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <div>
        <p className="text-sm font-semibold">{label}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <div className="flex flex-col gap-2 pr-2">
        {SHIFT_LABELS.map(({ key, label: shiftLabel }) => (
          <div key={key} className="flex items-center gap-3">
            <label className="w-16 text-sm text-right shrink-0">{shiftLabel}</label>
            <input
              type="number"
              min={0}
              max={999}
              value={values[key]}
              onChange={(e) => onChange(key, e.target.value)}
              className="w-20 rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <span className="text-xs text-muted-foreground">מקס׳ עובדים</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CapacityRulesForm({ initialValues }: { initialValues: FullCapacityRules }) {
  const [values, setValues] = useState<FullCapacityRules>(initialValues);
  const [status, setStatus] = useState<'idle' | 'ok' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [isPending, startTransition] = useTransition();

  function handleChange(section: keyof FullCapacityRules, shift: keyof CapacityMap, raw: string) {
    const n = parseInt(raw, 10);
    if (!isNaN(n) && n >= 0) {
      setValues((v) => ({ ...v, [section]: { ...v[section], [shift]: n } }));
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('idle');
    startTransition(async () => {
      const result = await upsertCapacityRules(values);
      if ('error' in result) {
        setStatus('error');
        setErrorMsg(result.error);
      } else {
        setStatus('ok');
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-xs" dir="rtl">
      {SECTIONS.map(({ key, label, hint }) => (
        <CapacitySection
          key={key}
          label={label}
          hint={hint}
          values={values[key]}
          onChange={(shift, raw) => handleChange(key, shift, raw)}
        />
      ))}

      <Button type="submit" disabled={isPending} size="sm">
        {isPending ? 'שומר...' : 'שמור שינויים'}
      </Button>

      {status === 'ok' && <p className="text-sm text-green-600">הגדרות נשמרו בהצלחה</p>}
      {status === 'error' && errorMsg && <p className="text-sm text-destructive">{errorMsg}</p>}
    </form>
  );
}
