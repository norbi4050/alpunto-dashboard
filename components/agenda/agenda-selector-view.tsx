'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { WeeklyCalendar } from './weekly-calendar'
import type { Bloqueo } from './weekly-calendar'
import type { Turno, Horario } from '@/lib/types'
import { format, addDays, startOfDay } from 'date-fns'

interface BarberoProp { id: string; slot: number; nombre: string; color: string; activo: boolean }
interface Props { barberos: BarberoProp[] }

export function AgendaSelectorView({ barberos }: Props) {
  const [barberoId, setBarberoId] = useState(barberos[0]?.id ?? '')
  const [turnos, setTurnos] = useState<Turno[]>([])
  const [bloqueos, setBloqueos] = useState<Bloqueo[]>([])
  const [horarios, setHorarios] = useState<Horario[]>([])
  const [loading, setLoading] = useState(false)

  const desde = startOfDay(new Date())
  const hasta = addDays(desde, 7)

  useEffect(() => {
    if (!barberoId) return
    setLoading(true)
    const supabase = createClient()
    const fechaDesde = format(desde, 'yyyy-MM-dd')
    const fechaHasta = format(hasta, 'yyyy-MM-dd')

    Promise.all([
      supabase
        .from('turnos')
        .select('*, clientes(nombre,whatsapp), barberos(nombre,slot,color)')
        .eq('barbero_id', barberoId)
        .gte('fecha_hora', desde.toISOString())
        .lt('fecha_hora', hasta.toISOString())
        .not('estado', 'in', '("cancelado","auto_cancelado")')
        .order('fecha_hora', { ascending: true }),
      supabase
        .from('bloqueos')
        .select('*')
        .eq('barbero_id', barberoId)
        .gte('fecha', fechaDesde)
        .lte('fecha', fechaHasta),
      supabase
        .from('horarios_barbero')
        .select('id, dia_semana, hora_inicio, hora_fin')
        .eq('barbero_id', barberoId),
    ]).then(([turnosRes, bloqueosRes, horariosRes]) => {
      setTurnos((turnosRes.data ?? []) as Turno[])
      setBloqueos((bloqueosRes.data ?? []) as Bloqueo[])
      setHorarios((horariosRes.data ?? []) as Horario[])
      setLoading(false)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [barberoId])

  const barbero = barberos.find(b => b.id === barberoId)

  return (
    <div className="flex flex-col h-full gap-4">
      <div className="flex items-center gap-3">
        <label className="text-xs font-semibold text-text-m shrink-0">Barbero</label>
        <select
          value={barberoId}
          onChange={e => setBarberoId(e.target.value)}
          className="bg-surface-container border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface outline-none focus:border-border-primary transition-colors"
        >
          {barberos.map(b => (
            <option key={b.id} value={b.id}>{b.nombre}</option>
          ))}
        </select>
        {loading && <span className="text-xs text-text-m">Cargando…</span>}
        {barbero && (
          <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: barbero.color }} />
        )}
      </div>

      {barbero && !loading && (
        <div className="flex-1 min-h-0">
          <WeeklyCalendar
            turnos={turnos}
            bloqueos={bloqueos}
            horarios={horarios}
            barberoId={barberoId}
            desde={desde.toISOString()}
          />
        </div>
      )}
    </div>
  )
}
