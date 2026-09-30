'use server';

import { requireSession } from '@/lib/db/auth-helpers';
import { getUpcomingSchedule } from './queries';

export async function fetchUpcomingSchedule() {
  const session = await requireSession();
  if (!session.user.facilityId) return null;
  return getUpcomingSchedule(session.user.facilityId);
}
