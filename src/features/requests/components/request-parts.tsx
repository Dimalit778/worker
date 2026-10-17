import { Badge } from '@/components/ui/badge';
import { SHIFT_LABELS } from '@/features/schedules/constants';
import { requestStatusLabel, REQUEST_TYPE_LABELS } from '../rules';
import type { AffectedSlotDto, RequestDto } from '../types';

export function formatIsoDate(iso: string | null) {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

export function RequestStatusBadge({ request }: { request: Pick<RequestDto, 'type' | 'status'> }) {
  const variant = request.status === 'APPROVED' ? 'default' : request.status === 'REJECTED' ? 'destructive' : request.status === 'CANCELLED' ? 'outline' : 'secondary';
  return <Badge variant={variant}>{requestStatusLabel(request.type, request.status)}</Badge>;
}

export function RequestSummary({ request }: { request: RequestDto }) {
  return (
    <div className="space-y-1 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">{REQUEST_TYPE_LABELS[request.type]}</span>
        <RequestStatusBadge request={request} />
        {request.type === 'URGENT_ABSENCE' && (request.status === 'PENDING_MANAGER') && <Badge className="bg-red-600 text-white">דחוף</Badge>}
      </div>
      {request.startDate && (
        <p>{request.startDate === request.endDate ? formatIsoDate(request.startDate) : `${formatIsoDate(request.startDate)} – ${formatIsoDate(request.endDate)}`}</p>
      )}
      {request.slot && (
        <p>משמרת {SHIFT_LABELS[request.slot.shiftType]} {formatIsoDate(request.slot.date)} · {request.slot.positionName}{request.targetName ? ` · אל ${request.targetName}` : ''}</p>
      )}
      {request.reason && <p className="text-muted-foreground">סיבה: {request.reason}</p>}
      {request.decisionNote && <p className="text-muted-foreground">הערת מנהל: {request.decisionNote}</p>}
      {request.overrideReason && <p className="text-muted-foreground">נימוק חריגה: {request.overrideReason}</p>}
    </div>
  );
}

export function AffectedSlotsList({ slots }: { slots: AffectedSlotDto[] }) {
  if (!slots.length) return null;
  return (
    <div className="rounded-md border border-amber-300 bg-amber-50 p-2 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200" role="alert">
      <p className="font-medium">שיבוצים קיימים שנפגעים ({slots.length}):</p>
      <ul className="list-disc ps-5">
        {slots.map(slot => (
          <li key={slot.id}>
            {formatIsoDate(slot.date)} · {SHIFT_LABELS[slot.shiftType]} · {slot.positionName} · {slot.scheduleName} ({slot.versionKind === 'DRAFT' ? 'טיוטה' : 'מפורסם'})
          </li>
        ))}
      </ul>
    </div>
  );
}
