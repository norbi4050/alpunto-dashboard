'use client'
import { useState } from 'react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths, isToday, isSameMonth } from 'date-fns'
import { es } from 'date-fns/locale'
import type { Turno } from '@/lib/types'
import { TurnoModal } from '@/components/turnos/turno-modal'

interface Props {
  turnos: Turno[]
  mes: Date
  onMesChange: (d: Date) => void
  onTurnosChange: (turnos: Turno[]) => void
}

const DIAS_HEADER = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

function dayIndex(date: Date): number {
  // 0=Lun ... 6=Dom
  return (getDay(date) + 6) % 7
}

export function MonthlyCalendar({ turnos, mes, onMesChange, onTurnosChange }: Props) {
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)
  const [selectedTurno, setSelectedTurno] = useState<Turno | null>(null)

  const monthStart = startOfMonth(mes)
  const monthEnd   = endOfMonth(mes)
  const days        = eachDayOfInterval({ start: monthStart, end: monthEnd })
  const startPad    = dayIndex(monthStart) // blank cells before month starts

  // Map fecha → turnos
  const turnosByDay: Record<string, Turno[]> = {}
  for (const t of turnos) {
    const key = format(new Date(t.fecha_hora), 'yyyy-MM-dd')
    if (!turnosByDay[key]) turnosByDay[key] = []
    turnosByDay[key].push(t)
  }

  const selectedKey = selectedDay ? format(selectedDay, 'yyyy-MM-dd') : null
  const turnosDelDia = selectedKey ? (turnosByDay[selectedKey] ?? []) : []

  function estadoColor(estado: string) {
    switch (estado) {
      case 'agendado':   return 'bg-si-text'
      case 'confirmado': return 'bg-ss-text'
      case 'asistido':   return 'bg-stitch-primary'
      case 'cancelado':
      case 'auto_cancelado': return 'bg-se-text'
      default: return 'bg-text-m'
    }
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-4">
      {/* Navigation */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => onMesChange(subMonths(mes, 1))}
          className="p-1 rounded-lg hover:bg-surface-container text-text-m hover:text-text-p transition-colors text-sm"
        >
          ‹
        </button>
        <span className="text-sm font-semibold text-text-p capitalize min-w-[140px] text-center">
          {format(mes, "MMMM yyyy", { locale: es })}
        </span>
        <button
          onClick={() => onMesChange(addMonths(mes, 1))}
          className="p-1 rounded-lg hover:bg-surface-container text-text-m hover:text-text-p transition-colors text-sm"
        >
          ›
        </button>
      </div>

      {/* Mobile: columna (grid arriba, panel abajo). Desktop: lado a lado */}
      <div className="flex flex-col md:flex-row gap-3 md:gap-4 flex-1 min-h-0">
        {/* Grid */}
        <div className="flex-1 overflow-auto rounded-xl border border-outline-variant bg-surface-card" style={{ minHeight: 0 }}>
          <div className="grid grid-cols-7 min-w-[420px]">
            {/* Day headers */}
            {DIAS_HEADER.map(d => (
              <div key={d} className="h-8 flex items-center justify-center border-b border-r border-outline-variant">
                <span className="text-[10px] font-semibold text-text-m uppercase tracking-wide">{d}</span>
              </div>
            ))}

            {/* Padding cells */}
            {Array.from({ length: startPad }).map((_, i) => (
              <div key={`pad-${i}`} className="h-20 border-b border-r border-outline-variant/30 bg-surface-container-low/30" />
            ))}

            {/* Day cells */}
            {days.map(day => {
              const key    = format(day, 'yyyy-MM-dd')
              const dayTs  = turnosByDay[key] ?? []
              const today  = isToday(day)
              const isSelected = selectedKey === key
              const count  = dayTs.length

              return (
                <div
                  key={key}
                  onClick={() => setSelectedDay(isSelected ? null : day)}
                  className={`h-20 border-b border-r border-outline-variant/30 p-1.5 flex flex-col gap-1 cursor-pointer transition-colors
                    ${isSelected ? 'bg-surface-container' : 'hover:bg-surface-container/60'}
                  `}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-[11px] font-bold leading-none rounded-full w-5 h-5 flex items-center justify-center
                      ${today ? 'bg-stitch-primary text-white' : 'text-text-p'}`}
                    >
                      {format(day, 'd')}
                    </span>
                    {count > 0 && (
                      <span className="text-[9px] font-semibold text-text-m">{count}</span>
                    )}
                  </div>
                  {/* Dots por turno — color del barbero */}
                  <div className="flex flex-wrap gap-0.5">
                    {dayTs.slice(0, 6).map(t => (
                      <span key={t.id} className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                        style={{ background: (t as any).barberos?.color ?? '#6b7280' }} />
                    ))}
                    {dayTs.length > 6 && (
                      <span className="text-[8px] text-text-m">+{dayTs.length - 6}</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Panel de día — ancho completo en mobile, fijo en desktop */}
        <div
          className="w-full md:w-64 flex-shrink-0 rounded-xl border border-outline-variant overflow-hidden flex flex-col"
          style={{ background: 'var(--glass-bg)', backdropFilter: `blur(var(--glass-blur))`, minHeight: selectedDay ? '200px' : '80px' }}
        >
          <div className="px-3 py-2.5 border-b border-outline-variant">
            <p className="text-xs font-semibold text-text-p">
              {selectedDay
                ? format(selectedDay, "EEEE d 'de' MMMM", { locale: es })
                : 'Seleccioná un día'}
            </p>
            {selectedDay && (
              <p className="text-[10px] text-text-m mt-0.5">
                {turnosDelDia.length === 0
                  ? 'Sin turnos'
                  : `${turnosDelDia.length} turno${turnosDelDia.length !== 1 ? 's' : ''}`}
              </p>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            {!selectedDay && (
              <div className="h-full flex items-center justify-center">
                <p className="text-[10px] text-text-m text-center px-4">
                  Hacé click en un día para ver los turnos
                </p>
              </div>
            )}
            {selectedDay && turnosDelDia.length === 0 && (
              <div className="h-full flex items-center justify-center">
                <p className="text-[10px] text-text-m">Sin turnos ese día</p>
              </div>
            )}
            {turnosDelDia
              .sort((a, b) => new Date(a.fecha_hora).getTime() - new Date(b.fecha_hora).getTime())
              .map(t => (
                <button
                  key={t.id}
                  onClick={() => setSelectedTurno(t)}
                  className="w-full px-3 py-2 border-b border-outline-variant/30 hover:bg-surface-container/40 transition-colors text-left"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ background: (t as any).barberos?.color ?? '#6b7280' }} />
                    <span className="text-[10px] font-mono font-semibold text-text-p">
                      {format(new Date(t.fecha_hora), 'HH:mm')}
                    </span>
                    {(t as any).barberos?.nombre && (
                      <span className="text-[9px] text-text-m truncate">{(t as any).barberos.nombre}</span>
                    )}
                  </div>
                  <p className="text-[11px] font-medium text-text-p mt-0.5 truncate">
                    {t.clientes?.nombre ?? '—'}
                  </p>
                  <p className="text-[10px] text-text-m truncate">{t.servicio}</p>
                </button>
              ))}
          </div>
        </div>
      </div>

      {selectedTurno && (
        <TurnoModal
          turno={selectedTurno}
          onClose={() => setSelectedTurno(null)}
          showLink={false}
          onCancelled={id => {
            onTurnosChange(turnos.filter(t => t.id !== id))
            setSelectedTurno(null)
          }}
        />
      )}
    </div>
  )
}
