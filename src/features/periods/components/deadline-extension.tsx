'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { invalidateScheduleQueries } from '@/features/schedules/hooks';
import { queryKeys } from '@/lib/react-query/query-keys';
import { extendSubmissionDeadline, getDeadlineExtensions } from '../actions';
import { EXTENSION_REASON_MAX } from '../extension';
import { formatJerusalemDateTime, formatJerusalemLocal } from '../submission-window';

const extensionsKey = (scheduleId: string) => [...queryKeys.schedules.all(), 'deadlineExtensions', scheduleId] as const;

function formatInstant(value: string | null) {
  return value ? formatJerusalemDateTime(new Date(value)) : '—';
}

/** Manager control for extending the submission deadline. Renders nothing when not relevant. */
export function DeadlineExtension({ scheduleId }: { scheduleId: string }) {
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: extensionsKey(scheduleId),
    queryFn: () => getDeadlineExtensions(scheduleId),
  });

  const [open, setOpen] = useState(false);
  const [deadline, setDeadline] = useState('');
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState<{ tone: 'ok' | 'warn' | 'error'; text: string } | null>(null);

  const mutation = useMutation({
    mutationFn: () => extendSubmissionDeadline({ scheduleId, newDeadline: deadline, reason }),
    onSuccess: async (result) => {
      if ('error' in result) {
        setMessage({ tone: 'error', text: result.error });
        return;
      }
      setOpen(false);
      setMessage(
        result.emailWarning
          ? { tone: 'warn', text: result.emailWarning }
          : { tone: 'ok', text: `מועד ההגשה הוארך. נשלחה הודעה ל-${result.notified} עובדים.` },
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: extensionsKey(scheduleId) }),
        invalidateScheduleQueries(queryClient, scheduleId),
      ]);
    },
    onError: () => setMessage({ tone: 'error', text: 'שגיאה בהארכת מועד ההגשה' }),
  });

  if (!data || (!data.canExtend && data.extensions.length === 0)) return null;

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next && data) {
      setDeadline(formatJerusalemLocal(new Date(data.submissionDeadline)));
      setReason('');
      setMessage(null);
    }
  }

  const canSubmit = deadline !== '' && reason.trim() !== '' && !mutation.isPending;

  return (
    <div className="space-y-2 text-sm" dir="rtl">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-muted-foreground">מועד הגשה: {formatInstant(data.submissionDeadline)}</span>
        {data.canExtend && (
          <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                הארכת מועד הגשה
              </Button>
            </DialogTrigger>
            <DialogContent dir="rtl">
              <DialogHeader>
                <DialogTitle>הארכת מועד הגשה</DialogTitle>
                <DialogDescription>
                  העובדים שטרם הגישו זמינות יקבלו הודעה על המועד החדש. ההארכה נשמרת ביומן השינויים.
                </DialogDescription>
              </DialogHeader>
              <form
                className="space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (canSubmit) mutation.mutate();
                }}
              >
                <div className="space-y-1.5">
                  <Label htmlFor={`extension-deadline-${scheduleId}`}>מועד הגשה חדש (שעון ישראל)</Label>
                  <Input
                    id={`extension-deadline-${scheduleId}`}
                    type="datetime-local"
                    dir="ltr"
                    value={deadline}
                    onChange={(event) => setDeadline(event.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`extension-reason-${scheduleId}`}>סיבת ההארכה</Label>
                  <textarea
                    id={`extension-reason-${scheduleId}`}
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    maxLength={EXTENSION_REASON_MAX}
                    rows={3}
                    required
                    className="w-full rounded-md border border-transparent bg-input/50 px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
                  />
                </div>
                {message?.tone === 'error' && <p className="text-sm text-destructive">{message.text}</p>}
                <DialogFooter>
                  <Button type="submit" disabled={!canSubmit}>
                    {mutation.isPending ? 'מאריך...' : 'הארכה ושליחת הודעה'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {message && message.tone !== 'error' && !open && (
        <p className={message.tone === 'warn' ? 'text-amber-700' : 'text-green-700'} role="status">
          {message.text}
        </p>
      )}

    </div>
  );
}
