/** App portal derived from SystemRole plus a facility manager membership. */
export const PortalRole = {
  EMPLOYEE: 'EMPLOYEE',
  MANAGER: 'MANAGER',
  ADMIN: 'ADMIN',
} as const;

export type PortalRole = (typeof PortalRole)[keyof typeof PortalRole];
