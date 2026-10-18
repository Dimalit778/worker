'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { invalidateScheduleQueries } from '@/features/schedules/hooks';
import { approveRequest, rejectRequest } from '../actions';
import { invalidateRequests, useRequestQueue } from '../hooks';
import type { QueueFilter } from '../queries';
import { isOpenStatus, REQUEST_TYPE_LABELS, sortRequestsForQueue } from '../rules';
import type { AffectedSlotDto, RequestDto } from '../types';
import { AffectedSlotsList, formatIsoDate, RequestSummary } from './request-parts';

const FILTERS: { value: QueueFilter; label: string }[] = [
  { value: 'open', label: 'פתוחות' },
  { value: 'closed', label: 'סגורות' },
  { value: 'all', label: 'הכל' },
];

type Decision = { request: RequestDto; mode: 'approve' | 'reject' };

function DecisionDialog({ decision, onClose, onDone }: { decision: Decision | null; onClose: () => void; onDone: () => Promise<unknown> }) {
  const [note, setNote] = useState('');
  const [overrideReason, setOverrideReason] = useState('');
  const [violations, setViolations] = useState<{ code: string; message: string }[] | null>(null);
  const [result, setResult] = useState<{ affectedSlots: AffectedSlotDto[]; note?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const request = decision?.request;
  const isUrgent = request?.type === 'URGENT_ABSENCE';
  const reject = decision?.mode === 'reject';
  const noteRequired = reject || isUrgent;

  function close() {
    setNote(''); setOverrideReason(''); setViolations(null); setResult(null); setError(null);
    onClose();
  }

  async function submit() {
    if (!request) return;
    setPending(true); setError(null);
    try {
      if (reject) {
        const res = await rejectRequest(request.id, note);
        if (!res.ok) { setError(res.error); return; }
        await onDone();
        close();
        return;
      }
      const res = await approveRequest(request.id, { decisionNote: note, overrideReason: violations ? overrideReason : undefined });
      if (!res.ok) {
        if ('requiresOverride' in res) setViolations(res.violations);
        else setError(res.error);
        return;
      }
      await onDone();
      if (res.affectedSlots.length) setResult(res);
      else close();
    } catch {
      setError('הפעולה נכשלה');
    } finally {
      setPending(false);
    }
  }

  const title = !request ? '' : reject ? 'דחיית בקשה' : isUrgent ? 'סימון היעדרות כטופלה' : 'אישור בקשה';
  const canSubmit = !pending && (!noteRequired || note.trim().length >= 2) && (!violations || overrideReason.trim().length >= 3);

  return (
    <Dialog open={Boolean(decision)} onOpenChange={open => { if (!open) close(); }}>
      <DialogContent dir="rtl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {request && <DialogDescription>{REQUEST_TYPE_LABELS[request.type]} · {request.requesterName}</DialogDescription>}
        </DialogHeader>
        {request && <RequestSummary request={request} />}
        {result ? (
          <>
            <p className="text-sm font-medium text-green-700">הבקשה אושרה.</p>
            <AffectedSlotsList slots={result.affectedSlots} />
            {result.note && <p className="text-sm text-muted-foreground">{result.note}</p>}
            <DialogFooter><Button type="button" onClick={close}>סגור</Button></DialogFooter>
          </>
        ) : (
          <>
            {request && !reject && <AffectedSlotsList slots={request.affectedSlots} />}
            {violations && (
              <div className="space-y-2 rounded-md border border-destructive/40 p-2 text-sm" role="alert">
                <p className="font-medium">ההעברה חורגת מכללי השיבוץ:</p>
                <ul className="list-disc ps-5">{violations.map((v, i) => <li key={`${v.code}-${i}`}>{v.message}</li>)}</ul>
                <textarea className="min-h-16 w-full rounded-md border border-input bg-background p-2 text-sm"
                  aria-label="נימוק לאישור חריגה" placeholder="נימוק לאישור החריגה (חובה)"
                  value={overrideReason} onChange={e => setOverrideReason(e.target.value)} />
              </div>
            )}
            <textarea className="min-h-16 w-full rounded-md border border-input bg-background p-2 text-sm"
              aria-label="הערת מנהל"
              placeholder={reject ? 'סיבת הדחייה (חובה)' : isUrgent ? 'כיצד טופלה ההיעדרות (חובה)' : 'הערה (לא חובה)'}
              maxLength={500} value={note} onChange={e => setNote(e.target.value)} />
            {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={close}>ביטול</Button>
              <Button type="button" variant={reject ? 'destructive' : 'default'} disabled={!canSubmit} onClick={submit}>
                {reject ? 'דחה' : isUrgent ? 'סמן כטופל' : violations ? 'אשר חריגה' : 'אשר'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function ManagerRequestsClient() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<QueueFilter>('open');
  const { data, isLoading, isError } = useRequestQueue(filter);
  const [decision, setDecision] = useState<Decision | null>(null);
  const requests = sortRequestsForQueue(data ?? []);
  const refresh = () => Promise.all([invalidateRequests(queryClient), invalidateScheduleQueries(queryClient)]);

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold">בקשות עובדים</h1>
        <div className="flex gap-2" role="group" aria-label="סינון לפי מצב">
          {FILTERS.map(f => (
            <Button key={f.value} size="sm" variant={filter === f.value ? 'default' : 'outline'} aria-pressed={filter === f.value} onClick={() => setFilter(f.value)}>
              {f.label}
            </Button>
          ))}
        </div>
      </div>
      {isLoading && <p className="text-sm text-muted-foreground">טוען בקשות...</p>}
      {isError && <p className="text-sm text-destructive">לא ניתן לטעון את הבקשות.</p>}
      {data && !requests.length && <p className="text-sm text-muted-foreground">אין בקשות להצגה.</p>}
      <ul className="space-y-3">
        {requests.map(r => {
          const urgent = r.type === 'URGENT_ABSENCE' && isOpenStatus(r.status);
          return (
            <li key={r.id}>
              <Card className={urgent ? 'ring-2 ring-red-500' : undefined}>
                <CardContent className="space-y-2 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="font-medium">{r.requesterName}</p>
                      <RequestSummary request={r} />
                      <p className="text-xs text-muted-foreground">
                        נשלח {formatIsoDate(r.createdAt)}
                        {r.decidedByName ? ` · טופל ע״י ${r.decidedByName} ${formatIsoDate(r.decidedAt)}` : ''}
                      </p>
                    </div>
                    {isOpenStatus(r.status) && (
                      <div className="flex gap-2">
                        {r.status === 'PENDING_MANAGER' && (
                          <Button size="sm" onClick={() => setDecision({ request: r, mode: 'approve' })}>
                            {r.type === 'URGENT_ABSENCE' ? 'סמן כטופל' : 'אשר'}
                          </Button>
                        )}
                        <Button size="sm" variant="outline" onClick={() => setDecision({ request: r, mode: 'reject' })}>דחה</Button>
                      </div>
                    )}
                  </div>
                  {r.status === 'PENDING_PEER' && <p className="text-xs text-muted-foreground">ממתין להסכמת {r.targetName}</p>}
                  <AffectedSlotsList slots={r.affectedSlots} />
                </CardContent>
              </Card>
            </li>
          );
        })}
      </ul>
      <DecisionDialog decision={decision} onClose={() => setDecision(null)} onDone={refresh} />
    </div>
  );
}
