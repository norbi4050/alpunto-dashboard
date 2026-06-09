// lib/auth.ts
import type { UserRole } from './types'

export function getRole(userMetadata: Record<string, unknown>): UserRole {
  const role = userMetadata?.role as string | undefined
  if (role === 'admin') return 'admin'
  if (role === 'dueno') return 'dueno'
  if (role === 'barbero') return 'barbero'
  // Sin rol válido → el más restrictivo (nunca defaultear a dueño)
  console.warn('[auth] user_metadata.role missing or invalid, defaulting to barbero')
  return 'barbero'
}

// barbero_id del metadata — solo presente en usuarios con rol 'barbero'
export function getBarberoId(userMetadata: Record<string, unknown>): string | null {
  const id = userMetadata?.barbero_id
  return typeof id === 'string' && id.length > 0 ? id : null
}

export function canAccess(role: UserRole, section: 'analytics' | 'conversaciones' | 'clientes' | 'atenciones' | 'configuracion'): boolean {
  if (role === 'barbero') return false // barberos solo ven su agenda (Hoy/Semana)
  return true
}
