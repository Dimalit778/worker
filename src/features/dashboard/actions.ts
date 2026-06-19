'use server';

import { getManagerDashboardData } from '@/features/dashboard/queries';

export async function fetchManagerDashboardData(year: number) {
  return getManagerDashboardData(year);
}
