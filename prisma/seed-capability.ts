import type { Capability } from '../src/generated/prisma/client';
// Fixture-only mapping. These numeric codes are not a runtime authorization rule.
export function seedCapability(code: number): Capability {
  return code === 1 || code === 2 ? 'SHIFT_MANAGER' : code === 3 ? 'CONTROLLER' : 'GUARD';
}
