// Rank is the role: 1 facility officer, 2 armorer, 3 controller, 4 guard.
// A smaller rank is more senior and can fill that role or any larger rank.
export function canEmployeeFillPosition(employeeRank: number | undefined, requiredRank: number | undefined): boolean {
  return typeof employeeRank === 'number' && typeof requiredRank === 'number' && employeeRank <= requiredRank;
}
