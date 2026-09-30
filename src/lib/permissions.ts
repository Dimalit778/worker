import { FacilityRole, SystemRole } from '@/generated/prisma/client'
import { prisma } from '@/lib/db/client'
import { PortalRole, type PortalRole as PortalRoleValue } from '@/lib/auth/portal'

export const PERMISSIONS = {
  OPEN_PERIOD:       'OPEN_PERIOD',
  CLOSE_PERIOD:      'CLOSE_PERIOD',
  VIEW_SUBMISSIONS:  'VIEW_SUBMISSIONS',
  APPROVE_SCHEDULE:  'APPROVE_SCHEDULE',
  EDIT_SCHEDULE:     'EDIT_SCHEDULE',
  MANAGE_USERS:      'MANAGE_USERS',
  GRANT_PERMISSIONS: 'GRANT_PERMISSIONS',
} as const

export type PermissionKey = typeof PERMISSIONS[keyof typeof PERMISSIONS]

const MANAGER_DEFAULTS: PermissionKey[] = [
  PERMISSIONS.OPEN_PERIOD,
  PERMISSIONS.CLOSE_PERIOD,
  PERMISSIONS.VIEW_SUBMISSIONS,
  PERMISSIONS.APPROVE_SCHEDULE,
  PERMISSIONS.EDIT_SCHEDULE,
]

const GRANT_ALLOWED: Record<PermissionKey, PortalRoleValue[]> = {
  [PERMISSIONS.OPEN_PERIOD]:       [PortalRole.MANAGER, PortalRole.ADMIN],
  [PERMISSIONS.CLOSE_PERIOD]:      [PortalRole.MANAGER, PortalRole.ADMIN],
  [PERMISSIONS.VIEW_SUBMISSIONS]:  [PortalRole.MANAGER, PortalRole.ADMIN],
  [PERMISSIONS.APPROVE_SCHEDULE]:  [PortalRole.MANAGER, PortalRole.ADMIN],
  [PERMISSIONS.EDIT_SCHEDULE]:     [PortalRole.MANAGER, PortalRole.ADMIN],
  [PERMISSIONS.MANAGE_USERS]:      [PortalRole.ADMIN],
  [PERMISSIONS.GRANT_PERMISSIONS]: [PortalRole.ADMIN],
}

function portalsFor(user: { systemRole: SystemRole; facilityRoles: { role: FacilityRole }[] }): PortalRoleValue[] {
  const portals: PortalRoleValue[] = []
  if (user.systemRole === SystemRole.ADMIN) portals.push(PortalRole.ADMIN)
  if (user.facilityRoles.some((membership) => membership.role === FacilityRole.MANAGER)) portals.push(PortalRole.MANAGER)
  return portals
}

export async function hasPermission(userId: string, permission: PermissionKey): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      systemRole: true,
      facilityRoles: { select: { role: true } },
      receivedPermissions: {
        where: {
          permissionKey: permission,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        select: { granted: true },
      },
    },
  })

  if (!user) return false

  if (user.receivedPermissions.length > 0) {
    return user.receivedPermissions[0].granted
  }

  const portals = portalsFor(user)
  if (portals.includes(PortalRole.ADMIN)) return true
  if (portals.includes(PortalRole.MANAGER)) return MANAGER_DEFAULTS.includes(permission)
  return false
}

export async function grantPermission({
  granterId,
  targetUserId,
  permission,
  grant,
  note,
  expiresAt,
}: {
  granterId:     string
  targetUserId:  string
  permission:    PermissionKey
  grant:         boolean
  note?:         string
  expiresAt?:    Date
}) {
  const granter = await prisma.user.findUnique({
    where: { id: granterId },
    select: { systemRole: true, facilityRoles: { select: { role: true } } },
  })

  if (!granter) throw new Error('Granter not found')

  const portals = portalsFor(granter)
  if (!GRANT_ALLOWED[permission].some((role) => portals.includes(role))) {
    throw new Error(`${granter.systemRole} cannot grant permission "${permission}"`)
  }

  return prisma.userPermission.upsert({
    where:  { userId_permissionKey: { userId: targetUserId, permissionKey: permission } },
    create: { userId: targetUserId, permissionKey: permission, granted: grant, grantedById: granterId, note, expiresAt },
    update: { granted: grant, grantedById: granterId, note, expiresAt, updatedAt: new Date() },
  })
}

export function revokePermission(granterId: string, targetUserId: string, permission: PermissionKey) {
  return grantPermission({ granterId, targetUserId, permission, grant: false })
}

export function getUserPermissions(userId: string) {
  return prisma.userPermission.findMany({
    where:   { userId },
    include: { grantedBy: { select: { id: true, email: true } } },
    orderBy: { createdAt: 'desc' },
  })
}
