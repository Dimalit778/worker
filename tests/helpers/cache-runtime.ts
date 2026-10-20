import { vi } from 'vitest';

export const entries = new Map<string, { json: string; tags: string[] }>();

// A JSON cache double for application key/invalidation tests. Next.js owns the
// production provider, stale-while-revalidate behavior and distributed storage.
export const unstable_cache = vi.fn((
  load: (...args: unknown[]) => Promise<unknown>,
  key: string[],
  options: { tags?: string[]; revalidate?: number } = {},
) => async (...args: unknown[]) => {
  const id = JSON.stringify([key, args, load.toString()]);
  if (!entries.has(id)) {
    entries.set(id, { json: JSON.stringify(await load(...args)), tags: options.tags ?? [] });
  }
  return JSON.parse(entries.get(id)!.json);
});

export const revalidateTag = vi.fn((tag: string) => {
  for (const [key, entry] of entries) if (entry.tags.includes(tag)) entries.delete(key);
});
export const revalidatePath = vi.fn();
