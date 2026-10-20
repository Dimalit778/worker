import { revalidateTag, unstable_cache } from 'next/cache';

const ALL_FACILITIES = 'facility-data-v1';
const ADMIN_DATA = 'admin-data-v1';
const facilityTag = (facilityId: string) => `${ALL_FACILITIES}:${facilityId}`;

/** Only pass data loaders here: authorize the caller before entering this scope. */
export function readFacilityCache<T>(
  facilityId: string,
  key: string[],
  load: () => Promise<T>,
  seconds = 30,
  timeSensitive = false,
): Promise<T> {
  // A new time bucket is a blocking miss, so clock-driven state transitions do
  // not serve stale-while-revalidate data from a previous window.
  const clockKey = timeSensitive ? [String(Math.floor(Date.now() / (seconds * 1000)))] : [];
  return unstable_cache(load, [ALL_FACILITIES, facilityId, ...key, ...clockKey], {
    tags: [ALL_FACILITIES, facilityTag(facilityId)],
    revalidate: seconds,
  })();
}

export function readAdminCache<T>(load: () => Promise<T>): Promise<T> {
  return unstable_cache(load, [ADMIN_DATA], { tags: [ADMIN_DATA], revalidate: 300 })();
}

// Expire immediately after a committed write: the next read must wait for fresh
// data. These functions also work in route handlers (unlike updateTag).
export function expireFacilityData(facilityId: string) {
  revalidateTag(facilityTag(facilityId), { expire: 0 });
}

export function expireEmployeeData(facilityId: string) {
  expireFacilityData(facilityId);
  revalidateTag(ADMIN_DATA, { expire: 0 });
}

export function expireAllFacilityData() {
  revalidateTag(ALL_FACILITIES, { expire: 0 });
  revalidateTag(ADMIN_DATA, { expire: 0 });
}
