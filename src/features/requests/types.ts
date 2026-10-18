import type { EmployeeRequestStatus, EmployeeRequestType, ShiftType } from '@/generated/prisma/enums';

export type AffectedSlotDto = {
  id: string;
  date: string;
  shiftType: ShiftType;
  positionName: string;
  scheduleName: string;
  versionKind: 'PUBLISHED' | 'DRAFT';
};

export type RequestDto = {
  id: string;
  type: EmployeeRequestType;
  status: EmployeeRequestStatus;
  requesterId: string;
  requesterName: string;
  targetUserId: string | null;
  targetName: string | null;
  startDate: string | null;
  endDate: string | null;
  slot: { date: string; shiftType: ShiftType; positionName: string; startsAt: string; endsAt: string } | null;
  reason: string | null;
  decisionNote: string | null;
  overrideReason: string | null;
  decidedByName: string | null;
  decidedAt: string | null;
  createdAt: string;
  affectedSlots: AffectedSlotDto[];
};

export type TransferOption = {
  slotId: string;
  date: string;
  shiftType: ShiftType;
  positionName: string;
  scheduleName: string;
  startsAt: string;
  colleagues: { id: string; name: string }[];
};

export type ActionResult<T = object> = ({ ok: true } & T) | { ok: false; error: string };

export type ApproveResult =
  | { ok: true; affectedSlots: AffectedSlotDto[]; note?: string }
  | { ok: false; error: string }
  | { ok: false; requiresOverride: true; violations: { code: string; message: string }[] };
