export type Capability = 'GUARD' | 'CONTROLLER' | 'SHIFT_MANAGER';
const ranks: Record<Capability, number> = { GUARD: 1, CONTROLLER: 2, SHIFT_MANAGER: 3 };

export function getPositionRoleRank(capability: string | undefined): number | null {
  return capability && Object.hasOwn(ranks, capability) ? ranks[capability as Capability] : null;
}

export function canEmployeeFillPosition(capability: string | undefined, required: string | undefined): boolean {
  const rank = getPositionRoleRank(capability);
  const minimum = getPositionRoleRank(required);
  return rank !== null && minimum !== null && rank >= minimum;
}

export function isExactPositionMatch(capability: string | undefined, required: string | undefined): boolean {
  return getPositionRoleRank(capability) !== null && capability === required;
}
