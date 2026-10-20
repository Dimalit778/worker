import '@testing-library/jest-dom'
import { vi } from 'vitest';

// Standalone unit/PostgreSQL tests have no Next request/cache runtime. Tests of
// cache behavior provide their own storage mock; other tests exercise live data.
vi.mock('next/cache', () => ({
  unstable_cache: (load: (...args: unknown[]) => unknown) => load,
  revalidateTag: vi.fn(),
  revalidatePath: vi.fn(),
}));
