// dashboard/components/conversaciones/historial-list.tsx
'use client'
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Conversacion } from '@/lib/types'
import { format, isToday, parseISO } from 'date-fns'

type FilterType = 'all' | 'atencion' | 'ia' | 'esperando' | 'agendado'

export interface HistorialListHandle {
  updateConv: (conv: Conversacion) => void
}

interface Badge {
  icon: string
  label: string
  classes: string
  priority: number // 0=urgente … 3=normal
}

const WAITING_STATES = new Set([
  'esperando_booking_web',
  'esperando_turno_confirmacion',
  'esperando_feedback',
  'esperando_feedback_comentario',
  'esperando_dueno',
  'esperando_respuesta',
])

const badgeConfig = {
  handoff:   { label: '✋ Atención',  classes: 'bg-se-bg text-se-text border border-border-error' },
  esperando: { label: '⏳ Esperando', classes: 'bg-sw-bg text-sw-text border border-border-warning' },
  agendado:  { label: '✅ Agendado',  classes: 'bg-ss-bg text-ss-text border border-border-success' },
  ia:        { label: '🤖 IA',        classes: 'bg-si-bg text-si-text border border-border-primary' },
}

function getBadge(conv: Conversacion): Badge {
  if (conv.handoff_humano) {
    return { icon: '✋', label: 'Atención', classes: badgeConfig.handoff.classes, priority: 0 }
  }
  if (WAITING_STATES.has(conv.estado)) {
    return { icon: '⏳', label: 'Esperando', classes: badgeConfig.esperando.classes, priority: 1 }
  }
  const ctx = conv.contexto as Record<string, unknown>
  if (ctx?.turno_id) {
    return { icon: '✅', label: 'Agendado', classes: badgeConfig.agendado.classes, priority: 2 }
  }
  return { icon: '🤖', label: 'IA', classes: badgeConfig.ia.classes, priority: 3 }
}

function toDateKey(isoString: string): string {
  const d = parseISO(isoString)
  return isToday(d) ? 'Hoy' : format(d, 'dd/MM/yyyy')
}

interface Props {
  selectedPhone: string | null
  onSelect: (conv: Conversacion) => void
  initialPhone?: string | null
  role: string
}

export const HistorialList = forwardRef<HistorialListHandle, Props>(function HistorialList(
  { selectedPhone, onSelect, initialPhone, role: _role }, ref
) {
  const [convs, setConvs] = useState<Conversacion[]>([])
  const [clientesMap, setClientesMap] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(false)
  const [search, setSearch] = useState('')
  const [dateInput, setDateInput] = useState('')
  const [filter, setFilter] = useState<FilterType>('all')
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({})

  // Permite actualizar un item de la lista directamente sin esperar real-time
  useImperativeHandle(ref, () => ({
    updateConv: (conv: Conversacion) => {
      setConvs(prev => prev
        .map(c => c.telefono === conv.telefono ? conv : c)
        .sort((a, b) => {
          const pa = getBadge(a).priority
          const pb = getBadge(b).priority
          if (pa !== pb) return pa - pb
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        })
      )
    }
  }))

  useEffect(() => {
    const supabase = createClient()
    void supabase
      .from('conversaciones')
      .select('*')
      .order('updated_at', { ascending: false })
      .then(({ data, error }) => {
        setLoading(false)
        if (error) { setFetchError(true); return }
        if (data) {
          setConvs(data as Conversacion[])
          const phones = (data as Conversacion[]).map(c => c.telefono)
          if (phones.length > 0) {
            void supabase
              .from('clientes')
              .select('whatsapp,nombre')
              .in('whatsapp', phones)
              .then(({ data: pacs }) => {
                if (pacs) {
                  const map: Record<string, string> = {}
                  for (const p of pacs as { whatsapp: string; nombre: string }[]) map[p.whatsapp] = p.nombre
                  setClientesMap(map)
                }
              })
          }
        }
      })

    const ch = supabase
      .channel('conv-list-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'conversaciones' }, ({ new: row }) => {
        setConvs(prev => [row as Conversacion, ...prev])
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'conversaciones' }, ({ new: row }) => {
        setConvs(prev =>
          prev
            .map(c => c.telefono === (row as Conversacion).telefono ? row as Conversacion : c)
            .sort((a, b) => {
              const pa = getBadge(a).priority
              const pb = getBadge(b).priority
              if (pa !== pb) return pa - pb
              return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
            })
        )
      })
      .subscribe()

    return () => { void supabase.removeChannel(ch) }
  }, [])

  useEffect(() => {
    if (!initialPhone || convs.length === 0) return
    const match = convs.find(c => c.telefono === initialPhone)
    if (match) onSelect(match)
  }, [convs, initialPhone, onSelect])

  // Ordenar: urgente primero, luego por updated_at
  const sorted = [...convs].sort((a, b) => {
    const pa = getBadge(a).priority
    const pb = getBadge(b).priority
    if (pa !== pb) return pa - pb
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  })

  // Contadores para chips
  const counts = sorted.reduce<Record<FilterType, number>>(
    (acc, c) => {
      const badge = getBadge(c)
      if (badge.priority === 0) acc.atencion++
      else if (badge.priority === 1) acc.esperando++
      else if (badge.priority === 2) acc.agendado++
      else acc.ia++
      acc.all++
      return acc
    },
    { all: 0, atencion: 0, ia: 0, esperando: 0, agendado: 0 }
  )

  const filtered = sorted.filter(c => {
    const ctx = c.contexto as Record<string, unknown>
    const nombre = (clientesMap[c.telefono] ?? (ctx.clienteNombre as string) ?? '').toLowerCase()
    const q = search.toLowerCase()
    const matchesSearch = !search.trim() || nombre.includes(q) || c.telefono.includes(q)
    if (!matchesSearch) return false
    if (filter === 'all') return true
    const badge = getBadge(c)
    if (filter === 'atencion') return badge.priority === 0
    if (filter === 'esperando') return badge.priority === 1
    if (filter === 'agendado') return badge.priority === 2
    if (filter === 'ia') return badge.priority === 3
    return true
  })

  // Agrupar por fecha (solo cuando filter === 'all' y sin search)
  const showGroups = filter === 'all' && !search.trim()
  const groups: Array<{ key: string; items: Conversacion[] }> = []
  if (showGroups) {
    for (const conv of filtered) {
      const key = toDateKey(conv.updated_at)
      const last = groups[groups.length - 1]
      if (last?.key === key) { last.items.push(conv) }
      else { groups.push({ key, items: [conv] }) }
    }
  }

  useEffect(() => {
    if (!dateInput) return
    const [y, m, d] = dateInput.split('-')
    const todayLabel = format(new Date(), 'dd/MM/yyyy')
    const label = `${d}/${m}/${y}`
    const targetKey = label === todayLabel ? 'Hoy' : label
    sectionRefs.current[targetKey]?.scrollIntoView({ behavior: 'smooth' })
  }, [dateInput])

  const CHIPS: Array<{ key: FilterType; icon: string; label: string }> = [
    { key: 'all', icon: '', label: 'Todas' },
    { key: 'atencion', icon: '✋', label: '' },
    { key: 'ia', icon: '🤖', label: '' },
    { key: 'esperando', icon: '⏳', label: '' },
    { key: 'agendado', icon: '✅', label: '' },
  ]

  const renderItem = (c: Conversacion) => {
    const ctx = c.contexto as Record<string, unknown>
    const nombre = clientesMap[c.telefono] ?? (ctx.clienteNombre as string) ?? c.telefono
    const hora = format(parseISO(c.updated_at), 'HH:mm')
    const badge = getBadge(c)
    return (
      <button
        key={c.telefono}
        onClick={() => onSelect(c)}
        className={`w-full text-left px-3 py-2.5 border-b border-outline-variant transition-colors flex gap-2 items-start ${
          selectedPhone === c.telefono
            ? 'border-l-[3px] border-se-text bg-surface-container'
            : 'border-l-[3px] border-transparent hover:bg-surface-container'
        }`}
      >
        {/* Avatar */}
        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5 ${
          badge.priority === 0 ? 'bg-se-bg text-se-text'
          : badge.priority === 1 ? 'bg-sw-bg text-sw-text'
          : badge.priority === 2 ? 'bg-ss-bg text-ss-text'
          : 'bg-si-bg text-si-text'
        }`}>
          {nombre.slice(0, 2).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-center mb-0.5">
            <span className="text-[11px] font-semibold text-text-p truncate flex-1 mr-1">{nombre}</span>
            <span className="text-[9px] text-text-s flex-shrink-0">{hora}</span>
          </div>
          <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${badge.classes}`}>
            {badge.icon} {badge.label}
          </span>
        </div>
      </button>
    )
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Búsqueda */}
      <div className="p-2 border-b border-outline-variant flex flex-col gap-2">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="🔍 Nombre o teléfono..."
          className="w-full bg-surface-container border border-outline-variant rounded-md px-2.5 py-1.5 text-[11px] text-text-p placeholder:text-text-m outline-none focus:border-border-primary transition-colors"
        />
        <div className="flex items-center gap-1">
          <input
            type="date"
            value={dateInput}
            onChange={e => setDateInput(e.target.value)}
            className="flex-1 bg-surface-container border border-outline-variant rounded-md px-2 py-1.5 text-[11px] text-text-p outline-none focus:border-border-primary [color-scheme:dark]"
          />
          {dateInput && (
            <button onClick={() => setDateInput('')} className="text-text-s hover:text-text-p text-xs px-1">✕</button>
          )}
        </div>
      </div>

      {/* Filtros rápidos */}
      <div className="flex gap-1 px-2 py-1.5 border-b border-outline-variant overflow-x-auto">
        {CHIPS.map(chip => (
          <button
            key={chip.key}
            onClick={() => setFilter(chip.key)}
            className={`flex-shrink-0 text-[9px] px-2 py-1 rounded-full border transition-colors ${
              filter === chip.key
                ? 'bg-surface-container text-text-p border-border-primary'
                : 'text-text-s border-outline-variant hover:border-text-s'
            }`}
          >
            {chip.key === 'all' ? `Todas ${counts.all}` : `${chip.icon} ${counts[chip.key]}`}
          </button>
        ))}
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-y-auto">
        {loading && <div className="flex items-center justify-center p-8 text-text-s text-xs">Cargando...</div>}
        {!loading && fetchError && <div className="flex items-center justify-center p-8 text-se-text text-xs text-center">Error al cargar</div>}
        {!loading && !fetchError && filtered.length === 0 && (
          <div className="flex items-center justify-center p-8 text-text-s text-xs text-center">Sin conversaciones</div>
        )}
        {showGroups
          ? groups.map(({ key, items }) => (
              <div key={key} ref={el => { sectionRefs.current[key] = el }}>
                <div className="px-3 py-1.5 text-[9px] font-bold text-text-m uppercase tracking-wider border-b border-outline-variant bg-surface-container-low sticky top-0 z-10">
                  {key}
                </div>
                {items.map(renderItem)}
              </div>
            ))
          : filtered.map(renderItem)
        }
      </div>
    </div>
  )
})
