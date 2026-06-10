// lib/types.ts
export type UserRole = 'dueno' | 'admin' | 'barbero'

export interface Turno {
  id: string
  cliente_id: string
  barbero_id: string
  servicio: string
  fecha_hora: string
  estado: 'agendado' | 'confirmado' | 'cancelado' | 'auto_cancelado' | 'asistido' | 'no_show'
  clientes: { nombre: string; whatsapp: string | null } | null
  barberos: { nombre: string; slot: number; color: string } | null
  servicios?: { duracion_min: number } | null
}

export interface Cliente {
  id: string
  nombre: string
  whatsapp: string
  opt_in_promo: boolean
  visitas: number
  ultima_visita: string | null
  created_at: string
}

export interface Barbero {
  id: string
  slot: number
  nombre: string
  whatsapp: string | null
  color: string
  activo: boolean
  es_dueno: boolean
  auth_email?: string | null
}

export interface Servicio {
  id: string
  nombre: string
  precio: number
  duracion_min: number
  activo: boolean
}

export interface Conversacion {
  telefono: string
  estado: string
  handoff_humano: boolean
  contexto: Record<string, unknown>
  updated_at: string
}

export interface Mensaje {
  id: string
  telefono: string
  direccion: 'entrada' | 'salida'
  contenido: string
  estado_bot: string | null
  created_at: string
}

export interface AnalyticsData {
  noShowRate: number
  noShowCount: number
  totalTurnos: number
  confirmadosBot: number
  clientesNuevos: number
  actividadSemanas: Array<{ semana: string; noShowPct: number }>
  actividadBot: { recordatorios: number; reservas: number; cancelaciones: number; handoffs: number }
}

export interface Horario {
  id: string
  barbero_id: string
  dia_semana: number   // 1=Lun, 2=Mar, 3=Mié, 4=Jue, 5=Vie, 6=Sáb, 0=Dom
  hora_inicio: string  // "09:00"
  hora_fin: string     // "13:00"
}
