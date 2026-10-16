'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { ManualViolation } from '@/features/scheduling-engine/manual-violations';

export const MIN_OVERRIDE_REASON_LENGTH = 3;

/** Lists the business-rule violations of a manual assignment and asks the manager for an approval reason. */
export function ManualOverrideDialog({ violations, onConfirm, onCancel }: {
  violations: ManualViolation[] | null;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState('');
  const valid = reason.trim().length >= MIN_OVERRIDE_REASON_LENGTH;
  return (
    <Dialog open={Boolean(violations)} onOpenChange={open => { if (!open) { setReason(''); onCancel(); } }}>
      <DialogContent dir="rtl" onClick={e => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>השיבוץ חורג מכללי השיבוץ</DialogTitle>
          <DialogDescription>ניתן לאשר את החריגה בכל זאת. הסיבה תישמר בהיסטוריית השינויים.</DialogDescription>
        </DialogHeader>
        <ul className="list-disc space-y-1 pr-5 text-sm">
          {violations?.map((v, i) => <li key={`${v.code}-${i}`}>{v.message}</li>)}
        </ul>
        <textarea
          className="min-h-20 w-full rounded-md border border-input bg-background p-2 text-sm"
          placeholder="סיבת החריגה (חובה)"
          aria-label="סיבת החריגה"
          value={reason}
          onChange={e => setReason(e.target.value)}
        />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => { setReason(''); onCancel(); }}>ביטול</Button>
          <Button type="button" disabled={!valid} onClick={() => { onConfirm(reason.trim()); setReason(''); }}>אשר חריגה ושבץ</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
