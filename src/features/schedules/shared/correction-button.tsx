'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { startScheduleCorrection } from '../assignments/actions';
import { invalidateScheduleQueries } from '../hooks';
import type { CurrentScheduleData } from '../types';
export function CorrectionButton({ data }: { data: CurrentScheduleData }) {
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const router = useRouter();
  const client = useQueryClient();
  return <><Button disabled={pending} onClick={async () => {
    setPending(true); setError('');
    try {
      await startScheduleCorrection(data.scheduleId, { versionId: data.versionId ?? null, revision: data.revision ?? 0 });
      await invalidateScheduleQueries(client, data.scheduleId);
      router.push(`/manager/draft?scheduleId=${encodeURIComponent(data.scheduleId)}`);
    } catch (e) { setError(e instanceof Error ? e.message : 'פתיחת טיוטה נכשלה'); }
    finally { setPending(false); }
  }}>פתח טיוטת תיקון</Button>{error && <p role="alert">{error} <a className="underline" href={`/manager/draft?scheduleId=${encodeURIComponent(data.scheduleId)}`}>פתח טיוטה קיימת</a></p>}</>;
}
