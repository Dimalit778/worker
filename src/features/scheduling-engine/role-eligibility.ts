function normalizePositionName(name: string | undefined): string {
  return (name ?? "")
    .replace(/[״"]/g, "")
    .replace(/[׳']/g, "")
    .trim();
}

export function getPositionRoleRank(positionName: string | undefined): number | null {
  const normalized = normalizePositionName(positionName);
  if (normalized === "אחמש") return 3;
  if (normalized === "בקר") return 2;
  if (normalized === "מאבטח") return 1;
  return null;
}

export function canEmployeeFillPosition(
  employeePositionName: string | undefined,
  slotPositionName: string | undefined
): boolean {
  const employeeRank = getPositionRoleRank(employeePositionName);
  const slotRank = getPositionRoleRank(slotPositionName);
  if (employeeRank === null || slotRank === null) return false;
  return employeeRank >= slotRank;
}

export function isExactPositionMatch(
  employeePositionName: string | undefined,
  slotPositionName: string | undefined
): boolean {
  const employeeRank = getPositionRoleRank(employeePositionName);
  const slotRank = getPositionRoleRank(slotPositionName);
  return employeeRank !== null && employeeRank === slotRank;
}
