// lib/auth.ts
import type { UserRole } from './types'

export function getRole(userMetadata: Record<string, unknown>): UserRole {
  const role = userMetadata?.role as string | undefined
  if (role === 'admin') return 'admin'
  if (role === 'dueno') return 'dueno'
  console.warn('[auth] user_metadata.role missing or invalid, defaulting to dueno')
  return 'dueno'
}

export function canAccess(role: UserRole, section: 'analytics' | 'conversaciones' | 'clientes' | 'atenciones'): boolean {
  return true
}
