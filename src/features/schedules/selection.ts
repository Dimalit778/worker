import { todayUtcDateForTimeZone } from '@/features/periods/utils';

export function currentScheduleWhere(facilityId: string, now = new Date()) {
  const today = todayUtcDateForTimeZone('Asia/Jerusalem', now);
  return { facilityId, status: 'PUBLISHED' as const, startDate: { lte: today }, endDate: { gte: today } };
}

export function preparationScheduleWhere(facilityId: string, now = new Date()) {
  return {
    facilityId,
    status: 'DRAFT' as const,
    endDate: { gte: todayUtcDateForTimeZone('Asia/Jerusalem', now) },
    submissionClosesAt: { lte: now },
  };
}
