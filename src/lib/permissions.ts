import { SystemRole } from '@/generated/prisma/client'
import { prisma } from '@/lib/db/client'

// ─── הגדרת ההרשאות ───────────────────────────────────────────────────────────

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

// ברירת מחדל: אילו הרשאות יש לכל role ללא הענקה ידנית
const ROLE_DEFAULTS: Record<SystemRole, PermissionKey[]> = {
  EMPLOYEE: [],
  MANAGER: [
    PERMISSIONS.OPEN_PERIOD,
    PERMISSIONS.CLOSE_PERIOD,
    PERMISSIONS.VIEW_SUBMISSIONS,
    PERMISSIONS.APPROVE_SCHEDULE,
    PERMISSIONS.EDIT_SCHEDULE,
  ],
  ADMIN: Object.values(PERMISSIONS),
}

// מי יכול לתת איזה הרשאה
const GRANT_ALLOWED: Record<PermissionKey, SystemRole[]> = {
  [PERMISSIONS.OPEN_PERIOD]:       ['MANAGER', 'ADMIN'],
  [PERMISSIONS.CLOSE_PERIOD]:      ['MANAGER', 'ADMIN'],
  [PERMISSIONS.VIEW_SUBMISSIONS]:  ['MANAGER', 'ADMIN'],
  [PERMISSIONS.APPROVE_SCHEDULE]:  ['MANAGER', 'ADMIN'],
  [PERMISSIONS.EDIT_SCHEDULE]:     ['MANAGER', 'ADMIN'],
  [PERMISSIONS.MANAGE_USERS]:      ['ADMIN'],
  [PERMISSIONS.GRANT_PERMISSIONS]: ['ADMIN'],
}

// ─── פונקציות ─────────────────────────────────────────────────────────────────

// בדיקת הרשאה: מפורשת (UserPermission) עדיפה על ברירת מחדל (role)
export async function hasPermission(userId: string, permission: PermissionKey): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      systemRole: true,
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

  return ROLE_DEFAULTS[user.systemRole].includes(permission)
}

// הענקה/שלילת הרשאה עם ולידציה
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
    select: { systemRole: true },
  })

  if (!granter) throw new Error('Granter not found')

  if (!GRANT_ALLOWED[permission].includes(granter.systemRole)) {
    throw new Error(`${granter.systemRole} cannot grant permission "${permission}"`)
  }

  return prisma.userPermission.upsert({
    where:  { userId_permissionKey: { userId: targetUserId, permissionKey: permission } },
    create: { userId: targetUserId, permissionKey: permission, granted: grant, grantedById: granterId, note, expiresAt },
    update: { granted: grant, grantedById: granterId, note, expiresAt, updatedAt: new Date() },
  })
}

// שלילת הרשאה
export function revokePermission(granterId: string, targetUserId: string, permission: PermissionKey) {
  return grantPermission({ granterId, targetUserId, permission, grant: false })
}

// כל ההרשאות של משתמש (לדף ניהול)
export function getUserPermissions(userId: string) {
  return prisma.userPermission.findMany({
    where:   { userId },
    include: { grantedBy: { select: { id: true, email: true } } },
    orderBy: { createdAt: 'desc' },
  })
}
