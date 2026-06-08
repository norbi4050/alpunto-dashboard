'use client'
import { useState } from 'react'
import { DayPicker } from 'react-day-picker'
import { createClient } from '@/lib/supabase/client'
import { format, startOfDay } from 'date-fns'
import { es } from 'date-fns/locale'

interface Props {
  barberoId: string
  value: string
  onChange: (val: string) => void
}

const DAY_CLS = 'w-7 h-7 text-xs rounded-md transition-colors text-[#e6edf3] hover:bg-[#21262d] disabled:opacity-25 disabled:cursor-not-allowed disabled:hover:bg-transparent'

export function DateTimePicker({ barberoId, value, onChange }: Props) {
  const [selected, setSelected] = useState<Date | undefined>(value ? new Date(value) : undefined)
  const [slots, setSlots] = useState<string[]>([])
  const [slot, setSlot] = useState<string | null>(value ? format(new Date(value), 'HH:mm') : null)
  const [loading, setLoading] = useState(false)

  async function onDaySelect(day: Date | undefined) {
    if (!day) return
    setSelected(day)
    setSlot(null)
    setSlots([])
    if (!barberoId) return
    setLoading(true)

    const supabase = createClient()
    const fechaStr = format(day, 'yyyy-MM-dd')
    const diaSemana = day.getDay()

    const [horariosRes, turnosRes, bloqueosRes] = await Promise.all([
      supabase.from('horarios_barbero')
        .select('hora_inicio,hora_fin')
        .eq('barbero_id', barberoId)
        .eq('dia_semana', diaSemana),
      supabase.from('turnos')
        .select('fecha_hora')
        .eq('barbero_id', barberoId)
        .gte('fecha_hora', `${fechaStr}T00:00:00`)
        .lt('fecha_hora', `${fechaStr}T23:59:59`)
        .not('estado', 'in', '("cancelado","auto_cancelado")'),
      supabase.from('bloqueos')
        .select('hora_inicio,hora_fin')
        .eq('barbero_id', barberoId)
        .eq('fecha', fechaStr),
    ])

    // Día completo bloqueado (hora_inicio === null)
    if ((bloqueosRes.data ?? []).some(b => b.hora_inicio === null)) {
      setSlots([])
      setLoading(false)
      return
    }

    const blockedRanges = (bloqueosRes.data ?? [])
      .filter(b => b.hora_inicio !== null)
      .map(b => {
        const [bsh, bsm] = (b.hora_inicio as string).split(':').map(Number)
        const [beh, bem] = (b.hora_fin as string).split(':').map(Number)
        return { start: bsh * 60 + bsm, end: beh * 60 + bem }
      })

    const taken = new Set(
      (turnosRes.data ?? []).map(t => format(new Date(t.fecha_hora), 'HH:mm'))
    )
    const dur = 30
    const available: string[] = []

    for (const h of horariosRes.data ?? []) {
      const [sh, sm] = h.hora_inicio.split(':').map(Number)
      const [eh, em] = h.hora_fin.split(':').map(Number)
      let cur = sh * 60 + sm
      const end = eh * 60 + em
      while (cur < end) {
        const hh = String(Math.floor(cur / 60)).padStart(2, '0')
        const mm = String(cur % 60).padStart(2, '0')
        const s = `${hh}:${mm}`
        const isBlocked = blockedRanges.some(r => cur >= r.start && cur < r.end)
        if (!taken.has(s) && !isBlocked) available.push(s)
        cur += dur
      }
    }

    setSlots(available)
    setLoading(false)
  }

  function pickSlot(s: string) {
    if (!selected) return
    setSlot(s)
    const [h, m] = s.split(':').map(Number)
    const dt = new Date(selected)
    dt.setHours(h, m, 0, 0)
    onChange(format(dt, "yyyy-MM-dd'T'HH:mm"))
  }

  return (
    <div className="flex gap-3">
      {/* Calendario */}
      <div className="shrink-0">
        <DayPicker
          mode="single"
          selected={selected}
          onSelect={onDaySelect}
          locale={es}
          disabled={{ before: startOfDay(new Date()) }}
          showOutsideDays={false}
          classNames={{
            root: '',
            months: '',
            month: 'flex flex-col gap-1.5',
            month_caption: 'flex justify-between items-center mb-1',
            caption_label: 'text-xs font-semibold text-[#e6edf3] capitalize',
            nav: 'flex gap-0.5',
            button_previous: '[all:unset] cursor-pointer text-white hover:text-[#58a6ff] px-1 transition-colors text-sm',
            button_next:     '[all:unset] cursor-pointer text-white hover:text-[#58a6ff] px-1 transition-colors text-sm',
            weeks: 'flex flex-col gap-0.5',
            weekdays: 'flex',
            weekday: 'w-7 text-center text-[9px] font-semibold text-[#8b949e] uppercase',
            week: 'flex',
            day: 'w-7 flex items-center justify-center',
            day_button: DAY_CLS,
            selected: '!bg-[#1f6feb] !text-white rounded-md',
            today: '!text-[#58a6ff] font-bold',
            outside: 'opacity-0 pointer-events-none',
            disabled: '!opacity-25 !cursor-not-allowed',
          }}
        />
      </div>

      {/* Slots */}
      <div className="flex-1 flex flex-col justify-center min-w-0">
        {!selected ? (
          <p className="text-[11px] text-[#8b949e] text-center">Seleccioná un día</p>
        ) : loading ? (
          <p className="text-[11px] text-[#8b949e] text-center">Cargando…</p>
        ) : !barberoId ? (
          <p className="text-[11px] text-[#8b949e] text-center">Seleccioná un profesional</p>
        ) : slots.length === 0 ? (
          <p className="text-[11px] text-[#8b949e] text-center">Sin disponibilidad</p>
        ) : (
          <div className="grid grid-cols-3 gap-1 max-h-48 overflow-y-auto pr-0.5">
            {slots.map(s => (
              <button key={s} type="button" onClick={() => pickSlot(s)}
                className={`text-[11px] py-1.5 rounded-md font-mono transition-colors ${
                  slot === s
                    ? 'bg-[#1f6feb] text-white'
                    : 'bg-[#21262d] text-[#8b949e] hover:text-[#e6edf3] hover:bg-[#30363d]'
                }`}>
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
