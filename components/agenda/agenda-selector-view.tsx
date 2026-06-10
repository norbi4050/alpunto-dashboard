'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { WeeklyCalendar } from './weekly-calendar'
import { MonthlyCalendar } from './monthly-calendar'
import type { Bloqueo } from './weekly-calendar'
import type { Turno, Horario } from '@/lib/types'
import { format, addDays, startOfDay, startOfMonth, endOfMonth } from 'date-fns'

interface BarberoProp { id: string; slot: number; nombre: string; color: string; activo: boolean }
interface Props { barberos: BarberoProp[] }

type Vista = 'semana' | 'mes'

const TODOS = '__todos__'

export function AgendaSelectorView({ barberos }: Props) {
  const [barberoId, setBarberoId] = useState(barberos[0]?.id ?? '')
  const [vista, setVista] = useState<Vista>('semana')
  const [turnos, setTurnos] = useState<Turno[]>([])
  const [bloqueos, setBloqueos] = useState<Bloqueo[]>([])
  const [horarios, setHorarios] = useState<Horario[]>([])
  const [loading, setLoading] = useState(false)
  const [mes, setMes] = useState<Date>(startOfMonth(new Date()))

  const desde = startOfDay(new Date())
  const hasta = addDays(desde, 7)
  const isTodos = barberoId === TODOS

  useEffect(() => {
    if (!barberoId) return
    setLoading(true)
    const supabase = createClient()

    if (vista === 'semana') {
      if (isTodos) {
        // Fetch todos los barberos sin filtro
        Promise.all([
          supabase
            .from('turnos')
            .select('*, clientes(nombre,whatsapp), barberos(nombre,slot,color)')
            .gte('fecha_hora', desde.toISOString())
            .lt('fecha_hora', hasta.toISOString())
            .not('estado', 'in', '("cancelado","auto_cancelado")')
            .order('fecha_hora', { ascending: true }),
          supabase
            .from('horarios_barbero')
            .select('id, barbero_id, dia_semana, hora_inicio, hora_fin')
            .eq('activo', true),
        ]).then(([turnosRes, horariosRes]) => {
          setTurnos((turnosRes.data ?? []) as Turno[])
          setBloqueos([]) // en vista todos no bloqueamos días
          setHorarios((horariosRes.data ?? []) as Horario[])
          setLoading(false)
        })
      } else {
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
            .gte('fecha', format(desde, 'yyyy-MM-dd'))
            .lte('fecha', format(hasta, 'yyyy-MM-dd')),
          supabase
            .from('horarios_barbero')
            .select('id, barbero_id, dia_semana, hora_inicio, hora_fin')
            .eq('barbero_id', barberoId),
        ]).then(([turnosRes, bloqueosRes, horariosRes]) => {
          setTurnos((turnosRes.data ?? []) as Turno[])
          setBloqueos((bloqueosRes.data ?? []) as Bloqueo[])
          setHorarios((horariosRes.data ?? []) as Horario[])
          setLoading(false)
        })
      }
    } else {
      const mesDesde = startOfMonth(mes)
      const mesHasta = endOfMonth(mes)
      const query = supabase
        .from('turnos')
        .select('*, clientes(nombre,whatsapp), barberos(nombre,slot,color)')
        .gte('fecha_hora', mesDesde.toISOString())
        .lte('fecha_hora', mesHasta.toISOString())
        .order('fecha_hora', { ascending: true })
      if (!isTodos) query.eq('barbero_id', barberoId)
      query.then(({ data }) => {
        setTurnos((data ?? []) as Turno[])
        setLoading(false)
      })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [barberoId, vista, mes])

  const barbero = isTodos ? null : barberos.find(b => b.id === barberoId)

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <label className="text-xs font-semibold text-text-m shrink-0">Barbero</label>
        <select
          value={barberoId}
          onChange={e => setBarberoId(e.target.value)}
          className="bg-surface-container border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface outline-none focus:border-border-primary transition-colors"
        >
          <option value={TODOS}>Todos</option>
          {barberos.map(b => (
            <option key={b.id} value={b.id}>{b.nombre}</option>
          ))}
        </select>

        {/* Dot de color del barbero seleccionado, o dots de todos */}
        {isTodos ? (
          <div className="flex gap-1">
            {barberos.map(b => (
              <span key={b.id} className="w-2.5 h-2.5 rounded-full" style={{ background: b.color }} title={b.nombre} />
            ))}
          </div>
        ) : barbero ? (
          <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: barbero.color }} />
        ) : null}

        {/* Vista toggle */}
        <div className="ml-auto flex items-center gap-1 bg-surface-container rounded-lg p-0.5">
          {(['semana', 'mes'] as Vista[]).map(v => (
            <button
              key={v}
              onClick={() => setVista(v)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors capitalize
                ${vista === v
                  ? 'bg-stitch-primary text-white'
                  : 'text-text-m hover:text-text-p'}`}
            >
              {v}
            </button>
          ))}
        </div>

        {loading && <span className="text-xs text-text-m">Cargando…</span>}
      </div>

      {!loading && vista === 'semana' && (
        <div className="flex-1 min-h-0">
          <WeeklyCalendar
            turnos={turnos}
            bloqueos={bloqueos}
            horarios={horarios}
            barberoId={isTodos ? '' : barberoId}
            barberos={barberos}
            desde={desde.toISOString()}
            readOnly={isTodos}
          />
        </div>
      )}

      {!loading && vista === 'mes' && (
        <div className="flex-1 min-h-0">
          <MonthlyCalendar
            turnos={turnos}
            mes={mes}
            onMesChange={setMes}
            onTurnosChange={setTurnos}
          />
        </div>
      )}
    </div>
  )
}
