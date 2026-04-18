'use client';

import { useTransition, useState } from 'react';
import { Button } from '@/components/ui/button';
import { upsertCapacityRules } from '@/features/shibutz/actions';
import type { CapacityMap } from '@/features/shibutz/types';

export function CapacityRulesForm({ initialValues }: { initialValues: CapacityMap }) {
  const [values, setValues] = useState(initialValues);
  const [status, setStatus] = useState<'idle' | 'ok' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [isPending, startTransition] = useTransition();

  function handleChange(shift: keyof CapacityMap, raw: string) {
    const n = parseInt(raw, 10);
    if (!isNaN(n) && n >= 1) setValues((v) => ({ ...v, [shift]: n }));
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

  const LABELS: { key: keyof CapacityMap; label: string }[] = [
    { key: 'MORNING', label: 'בוקר' },
    { key: 'EVENING', label: 'ערב' },
    { key: 'NIGHT', label: 'לילה' },
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-xs">
      {LABELS.map(({ key, label }) => (
        <div key={key} className="flex items-center gap-3">
          <label className="w-16 text-sm font-medium text-right">{label}</label>
          <input
            type="number"
            min={1}
            value={values[key]}
            onChange={(e) => handleChange(key, e.target.value)}
            className="w-20 rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <span className="text-xs text-muted-foreground">מקס׳ עובדים</span>
        </div>
      ))}

      <Button type="submit" disabled={isPending} size="sm">
        {isPending ? 'שומר...' : 'שמור שינויים'}
      </Button>

      {status === 'ok' && <p className="text-sm text-green-600">הגדרות נשמרו בהצלחה</p>}
      {status === 'error' && <p className="text-sm text-destructive">{errorMsg}</p>}
    </form>
  );
}
