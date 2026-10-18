'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SHIFT_LABELS } from '@/features/schedules/constants';
import { cancelRequest, createDateRequest, createTransferRequest, respondToTransfer } from '../actions';
import { invalidateRequests, useMyRequests, useTransferOptions } from '../hooks';
import { isOpenStatus, REQUEST_TYPE_LABELS } from '../rules';
import type { ActionResult, RequestDto } from '../types';
import { formatIsoDate, RequestSummary } from './request-parts';

type NewType = 'TIME_OFF' | 'SHIFT_SWAP' | 'URGENT_ABSENCE';
const NEW_TYPES: NewType[] = ['TIME_OFF', 'SHIFT_SWAP', 'URGENT_ABSENCE'];

function todayIso() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(new Date());
}

function NewRequestForm({ onDone }: { onDone: () => Promise<unknown> }) {
  const [type, setType] = useState<NewType>('TIME_OFF');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [slotId, setSlotId] = useState('');
  const [targetUserId, setTargetUserId] = useState('');
  const [reason, setReason] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const options = useTransferOptions(type === 'SHIFT_SWAP');
  const slot = options.data?.find(o => o.slotId === slotId);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true); setError(null); setSuccess(null);
    try {
      const res: ActionResult = type === 'SHIFT_SWAP'
        ? await createTransferRequest({ slotId, targetUserId, reason })
        : await createDateRequest({ type, startDate, endDate: endDate || startDate, reason });
      if (!res.ok) { setError(res.error); return; }
      setSuccess('הבקשה נשלחה');
      setStartDate(''); setEndDate(''); setSlotId(''); setTargetUserId(''); setReason('');
      await onDone();
    } catch {
      setError('שליחת הבקשה נכשלה');
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="flex flex-wrap gap-2" role="group" aria-label="סוג בקשה">
        {NEW_TYPES.map(t => (
          <Button key={t} type="button" size="sm" variant={type === t ? 'default' : 'outline'} aria-pressed={type === t}
            onClick={() => { setType(t); setError(null); setSuccess(null); }}>
            {REQUEST_TYPE_LABELS[t]}
          </Button>
        ))}
      </div>

      {type === 'SHIFT_SWAP' ? (
        <>
          <p className="text-xs text-muted-foreground">עד לאישור המנהל המשמרת נשארת באחריותך.</p>
          <div className="space-y-1">
            <Label htmlFor="req-slot">המשמרת להעברה</Label>
            {options.isLoading ? <p className="text-sm text-muted-foreground">טוען משמרות...</p> : options.data?.length ? (
              <Select value={slotId} onValueChange={v => { setSlotId(v); setTargetUserId(''); }}>
                <SelectTrigger id="req-slot" className="w-full"><SelectValue placeholder="בחרו משמרת" /></SelectTrigger>
                <SelectContent>
                  {options.data.map(o => (
                    <SelectItem key={o.slotId} value={o.slotId}>{formatIsoDate(o.date)} · {SHIFT_LABELS[o.shiftType]} · {o.positionName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : <p className="text-sm text-muted-foreground">אין משמרות עתידיות בשיבוץ המפורסם.</p>}
          </div>
          {slot && (
            <div className="space-y-1">
              <Label htmlFor="req-target">העובד המקבל</Label>
              {slot.colleagues.length ? (
                <Select value={targetUserId} onValueChange={setTargetUserId}>
                  <SelectTrigger id="req-target" className="w-full"><SelectValue placeholder="בחרו עובד" /></SelectTrigger>
                  <SelectContent>
                    {slot.colleagues.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : <p className="text-sm text-muted-foreground">אין עובדים מתאימים לתפקיד זה.</p>}
            </div>
          )}
        </>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label htmlFor="req-start">מתאריך</Label>
            <Input id="req-start" type="date" min={todayIso()} value={startDate} onChange={e => setStartDate(e.target.value)} required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="req-end">עד תאריך</Label>
            <Input id="req-end" type="date" min={startDate || todayIso()} value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
        </div>
      )}

      <div className="space-y-1">
        <Label htmlFor="req-reason">{type === 'URGENT_ABSENCE' ? 'סיבה (חובה)' : 'סיבה (לא חובה)'}</Label>
        <textarea id="req-reason" className="min-h-16 w-full rounded-md border border-input bg-background p-2 text-sm"
          maxLength={500} value={reason} onChange={e => setReason(e.target.value)} />
      </div>
      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
      {success && <p className="text-sm text-green-700">{success}</p>}
      <Button type="submit" disabled={pending || (type === 'SHIFT_SWAP' ? !slotId || !targetUserId : !startDate)}>
        {type === 'URGENT_ABSENCE' ? 'דווח היעדרות' : 'שלח בקשה'}
      </Button>
    </form>
  );
}

function RequestRow({ request, actions }: { request: RequestDto; actions?: React.ReactNode }) {
  return (
    <li className="flex flex-wrap items-start justify-between gap-2 rounded-md border p-3">
      <div className="min-w-0 flex-1">
        <RequestSummary request={request} />
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </li>
  );
}

export function EmployeeRequestsClient() {
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useMyRequests();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const refresh = () => invalidateRequests(queryClient);

  async function run(id: string, fn: () => Promise<ActionResult>) {
    setBusy(id); setError(null);
    try {
      const res = await fn();
      if (!res.ok) setError(res.error);
      await refresh();
    } catch {
      setError('הפעולה נכשלה');
    } finally {
      setBusy(null);
    }
  }

  const today = todayIso();
  const canCancel = (r: RequestDto) => isOpenStatus(r.status) || (r.type === 'TIME_OFF' && r.status === 'APPROVED' && !!r.startDate && r.startDate > today);
  const incomingOpen = data?.incoming.filter(r => r.status === 'PENDING_PEER') ?? [];

  return (
    <div className="mx-auto max-w-2xl space-y-6" dir="rtl">
      <h1 className="text-xl font-bold">הבקשות שלי</h1>

      <Card>
        <CardHeader><CardTitle>בקשה חדשה</CardTitle></CardHeader>
        <CardContent><NewRequestForm onDone={refresh} /></CardContent>
      </Card>

      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
      {isLoading && <p className="text-sm text-muted-foreground">טוען בקשות...</p>}
      {isError && <p className="text-sm text-destructive">לא ניתן לטעון את הבקשות.</p>}

      {incomingOpen.length > 0 && (
        <Card>
          <CardHeader><CardTitle>בקשות העברה אליי</CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {incomingOpen.map(r => (
                <RequestRow key={r.id} request={{ ...r, targetName: null }} actions={<>
                  <span className="self-center text-sm text-muted-foreground">מאת {r.requesterName}</span>
                  <Button size="sm" disabled={busy === r.id} onClick={() => run(r.id, () => respondToTransfer(r.id, true))}>אשר קבלה</Button>
                  <Button size="sm" variant="outline" disabled={busy === r.id} onClick={() => run(r.id, () => respondToTransfer(r.id, false))}>דחה</Button>
                </>} />
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {data && (
        <Card>
          <CardHeader><CardTitle>הבקשות ששלחתי</CardTitle></CardHeader>
          <CardContent>
            {data.mine.length ? (
              <ul className="space-y-2">
                {data.mine.map(r => (
                  <RequestRow key={r.id} request={r} actions={canCancel(r) ? (
                    <Button size="sm" variant="outline" disabled={busy === r.id} onClick={() => run(r.id, () => cancelRequest(r.id))}>בטל</Button>
                  ) : undefined} />
                ))}
              </ul>
            ) : <p className="text-sm text-muted-foreground">אין בקשות עדיין.</p>}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
