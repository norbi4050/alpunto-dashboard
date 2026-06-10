'use client'
import { useState, Fragment } from 'react'
import { format, addDays, getDay, isToday } from 'date-fns'
import { es } from 'date-fns/locale'
import type { Turno, Horario } from '@/lib/types'
import { TurnoModal } from '@/components/turnos/turno-modal'
import { NuevoTurnoModal } from '@/components/turnos/nuevo-turno-modal'

export interface Bloqueo {
  id: string
  fecha: string
  hora_inicio: string | null
  hora_fin: string | null
  motivo: string | null
}

interface BarberoProp { id: string; slot: number; nombre: string; color: string; activo: boolean }

type SlotStatus = 'libre' | 'ocupado' | 'bloqueado_horas' | 'fuera_horario'

interface GridSlot {
  hora: string
  status: SlotStatus
  turnos?: Turno[]
  bloqueoId?: string
}

interface DiaGrid {
  fecha: Date
  fechaStr: string
  isNoLaboral: boolean
  isDiaBloqueado: boolean
  turnoCount: number
  slots: GridSlot[]
}

function timeToMin(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function minToTime(m: number): string {
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

function buildYAxis(horarios: Horario[], duracionMin: number): string[] {
  if (!horarios.length) return []
  const lo = Math.min(...horarios.map(h => timeToMin(h.hora_inicio)))
  const hi = Math.max(...horarios.map(h => timeToMin(h.hora_fin)))
  const result: string[] = []
  for (let m = lo; m < hi; m += duracionMin) result.push(minToTime(m))
  return result
}

function buildDiaGrid(
  dia: Date,
  yAxis: string[],
  horarios: Horario[],
  turnos: Turno[],
  bloqueos: Bloqueo[],
  duracionMin: number,
): DiaGrid {
  const fechaStr = format(dia, 'yyyy-MM-dd')
  const diaSemana = getDay(dia)
  const horariosDelDia = horarios.filter(h => h.dia_semana === diaSemana)
  const blqDia = bloqueos.filter(b => b.fecha === fechaStr)
  const blqCompleto = blqDia.find(b => b.hora_inicio === null)
  const blqHoras = blqDia.filter(b => b.hora_inicio !== null)

  // Acumular TODOS los turnos por slot (puede haber varios barberos a la misma hora)
  const ocupados = new Map<string, Turno[]>()
  turnos
    .filter(t => format(new Date(t.fecha_hora), 'yyyy-MM-dd') === fechaStr)
    .forEach(t => {
      const hora = format(new Date(t.fecha_hora), 'HH:mm')
      const arr = ocupados.get(hora) ?? []
      arr.push(t)
      ocupados.set(hora, arr)
    })

  const slots: GridSlot[] = yAxis.map(hora => {
    const hMin = timeToMin(hora)
    const hFinMin = hMin + duracionMin

    const isWork = horariosDelDia.some(
      h => hMin >= timeToMin(h.hora_inicio) && hFinMin <= timeToMin(h.hora_fin)
    )
    if (!isWork || blqCompleto) return { hora, status: 'fuera_horario' }

    const blq = blqHoras.find(b => {
      const bi = timeToMin(b.hora_inicio!.slice(0, 5))
      const bf = timeToMin(b.hora_fin!.slice(0, 5))
      return hMin >= bi && hMin < bf
    })
    if (blq) return { hora, status: 'bloqueado_horas', bloqueoId: blq.id }

    if (ocupados.has(hora)) return { hora, status: 'ocupado', turnos: ocupados.get(hora) }
    return { hora, status: 'libre' }
  })

  return {
    fecha: dia,
    fechaStr,
    isNoLaboral: horariosDelDia.length === 0,
    isDiaBloqueado: !!blqCompleto,
    turnoCount: Array.from(ocupados.values()).reduce((s, arr) => s + arr.length, 0),
    slots,
  }
}

// Devuelve el color de fondo y borde para un turno dado su barbero
function turnoColor(t: Turno): { bg: string; border: string } {
  const hex = (t as Turno & { barberos?: { color?: string } }).barberos?.color ?? '#6366f1'
  return { bg: `${hex}26`, border: hex }
}

interface Props {
  turnos: Turno[]
  bloqueos: Bloqueo[]
  horarios: Horario[]
  duracionMin?: number
  barberoId: string
  barberos?: BarberoProp[]
  desde: string
  readOnly?: boolean
}

const ROW_H = 44

export function WeeklyCalendar({
  turnos: initialTurnos,
  bloqueos: initialBloqueos,
  horarios,
  duracionMin = 30,
  barberoId,
  desde,
  readOnly = false,
}: Props) {
  const [turnos, setTurnos] = useState<Turno[]>(initialTurnos)
  const [bloqueos, setBloqueos] = useState<Bloqueo[]>(initialBloqueos)
  const [selected, setSelected] = useState<Turno | null>(null)
  const [nuevoSlot, setNuevoSlot] = useState<{ fecha: string; hora: string } | null>(null)
  const [addingDia, setAddingDia] = useState<string | null>(null)
  const [addForm, setAddForm] = useState({ hora_inicio: '09:00', hora_fin: '10:00' })
  const [loadingKey, setLoadingKey] = useState<string | null>(null)

  const dur = duracionMin || 30
  const desdeDate = new Date(desde)
  const dias = Array.from({ length: 7 }, (_, i) => addDays(desdeDate, i))
  const yAxis = buildYAxis(horarios, dur)
  const diaGrids = dias.map(dia => buildDiaGrid(dia, yAxis, horarios, turnos, bloqueos, dur))

  async function bloquearDia(dg: DiaGrid) {
    if (!barberoId) return
    if (!window.confirm(`¿Bloquear ${format(dg.fecha, "EEEE d 'de' MMMM", { locale: es })}?`)) return
    setLoadingKey(`dia-${dg.fechaStr}`)
    const res = await fetch('/api/agenda/bloqueos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ barbero_id: barberoId, fecha: dg.fechaStr }),
    })
    if (res.ok) { const data = await res.json(); setBloqueos(prev => [...prev, data]) }
    setLoadingKey(null)
  }

  async function habilitarDia(dg: DiaGrid) {
    setLoadingKey(`habilitar-${dg.fechaStr}`)
    try {
      const results = await Promise.all(
        bloqueos.filter(b => b.fecha === dg.fechaStr).map(b =>
          fetch(`/api/agenda/bloqueos/${b.id}`, { method: 'DELETE' })
        )
      )
      if (results.every(r => r.ok)) {
        setBloqueos(prev => prev.filter(b => b.fecha !== dg.fechaStr))
      }
    } finally {
      setLoadingKey(null)
    }
  }

  async function agregarBloqueoHoras(fechaStr: string) {
    if (!barberoId || addForm.hora_inicio >= addForm.hora_fin) return
    setLoadingKey(`add-${fechaStr}`)
    try {
      const res = await fetch('/api/agenda/bloqueos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          barbero_id: barberoId,
          fecha: fechaStr,
          hora_inicio: addForm.hora_inicio,
          hora_fin: addForm.hora_fin,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setBloqueos(prev => [...prev, data])
        setAddingDia(null)
      }
    } finally {
      setLoadingKey(null)
    }
  }

  async function eliminarBloqueo(id: string) {
    setLoadingKey(`del-${id}`)
    await fetch(`/api/agenda/bloqueos/${id}`, { method: 'DELETE' })
    setBloqueos(prev => prev.filter(b => b.id !== id))
    setLoadingKey(null)
  }

  return (
    <>
      <div className="flex-1 overflow-auto min-h-0 rounded-xl border border-outline-variant bg-surface-card">
        <div
          className="grid min-w-[560px]"
          style={{ gridTemplateColumns: '3rem repeat(7, 1fr)' }}
        >
          {/* HEADER ROW */}
          <div className="sticky top-0 z-20 bg-surface-container-low border-b border-r border-outline-variant" style={{ minHeight: 64 }} />
          {diaGrids.map(dg => {
            const today = isToday(dg.fecha)
            return (
              <div
                key={`hdr-${dg.fechaStr}`}
                className="sticky top-0 z-20 bg-surface-container-low border-b border-r border-outline-variant px-1.5 py-1.5 flex flex-col gap-0.5"
                style={{ minHeight: 64 }}
              >
                <p className="text-[9px] text-text-m font-semibold uppercase tracking-wide leading-tight">
                  {format(dg.fecha, 'EEE', { locale: es })}
                </p>
                <p className={`text-[11px] font-bold leading-tight ${today ? 'text-stitch-primary' : 'text-text-p'}`}>
                  {format(dg.fecha, 'd MMM', { locale: es })}
                  {dg.turnoCount > 0 && !dg.isDiaBloqueado && !dg.isNoLaboral && (
                    <span className="ml-1 text-[9px] font-normal text-text-m">
                      · {dg.turnoCount}t
                    </span>
                  )}
                </p>
                {!readOnly && (
                  <div className="flex gap-1.5 items-center mt-auto">
                    {dg.isDiaBloqueado ? (
                      <button
                        onClick={() => habilitarDia(dg)}
                        disabled={loadingKey === `habilitar-${dg.fechaStr}`}
                        className="text-[9px] text-se-text font-semibold hover:underline disabled:opacity-50"
                      >
                        Habilitar
                      </button>
                    ) : !dg.isNoLaboral ? (
                      <>
                        <button
                          onClick={() => bloquearDia(dg)}
                          disabled={!!loadingKey}
                          title="Bloquear día completo"
                          className="text-[9px] text-text-m hover:text-se-text transition-colors disabled:opacity-50"
                        >
                          ⊘
                        </button>
                        <button
                          onClick={() => { setAddingDia(dg.fechaStr); setAddForm({ hora_inicio: '09:00', hora_fin: '10:00' }) }}
                          title="Bloquear rango de horas"
                          className="text-[9px] text-text-m hover:text-sw-text transition-colors"
                        >
                          +blq
                        </button>
                      </>
                    ) : null}
                  </div>
                )}
              </div>
            )
          })}

          {/* EMPTY STATE */}
          {yAxis.length === 0 && (
            <>
              <div className="border-r border-outline-variant" style={{ height: 120 }} />
              {diaGrids.map(dg => (
                <div
                  key={`empty-${dg.fechaStr}`}
                  style={{ height: 120 }}
                  className="border-r border-outline-variant bg-surface-container-low flex items-center justify-center"
                >
                  <span className="text-[10px] text-text-m">Sin horario</span>
                </div>
              ))}
            </>
          )}

          {/* SLOT ROWS */}
          {yAxis.map((hora, rowIdx) => (
            <Fragment key={hora}>
              {/* Y-axis label */}
              <div
                style={{ height: ROW_H }}
                className="flex items-start pt-0.5 justify-end pr-1.5 text-[9px] font-mono text-text-m border-b border-r border-outline-variant/30 flex-shrink-0"
              >
                {hora}
              </div>

              {/* Day cells */}
              {diaGrids.map(dg => {
                const slot = dg.slots[rowIdx]
                if (!slot) return (
                  <div key={dg.fechaStr} style={{ height: ROW_H }}
                    className="border-b border-r border-outline-variant/20 bg-surface-container-low" />
                )

                if (slot.status === 'fuera_horario') return (
                  <div key={dg.fechaStr} style={{ height: ROW_H }}
                    className="border-b border-r border-outline-variant/20 bg-surface-container-low" />
                )

                if (slot.status === 'libre') return (
                  <div
                    key={dg.fechaStr}
                    style={{ height: ROW_H }}
                    onClick={() => !readOnly && setNuevoSlot({ fecha: dg.fechaStr, hora })}
                    className={`border-b border-r border-outline-variant/30 border-l-[2px] border-l-border-success/30 bg-ss-bg/10 transition-colors flex items-center px-1.5 ${!readOnly ? 'hover:bg-ss-bg/40 cursor-pointer' : ''}`}
                  >
                    {!readOnly && <span className="text-[9px] text-ss-text/50 font-mono">{hora}</span>}
                  </div>
                )

                if (slot.status === 'ocupado' && slot.turnos?.length) {
                  const ts = slot.turnos
                  return (
                    <div
                      key={dg.fechaStr}
                      style={{ height: ROW_H }}
                      className="border-b border-r border-outline-variant/30 overflow-hidden px-0.5 py-0.5 flex flex-col gap-0.5"
                    >
                      {ts.map(t => {
                        const { bg, border } = turnoColor(t)
                        return (
                          <div
                            key={t.id}
                            onClick={() => setSelected(t)}
                            style={{ background: bg, borderLeft: `3px solid ${border}` }}
                            className="flex-1 min-h-0 cursor-pointer hover:brightness-110 transition-all px-1 rounded-sm overflow-hidden flex flex-col justify-center"
                          >
                            <p className="text-[9px] font-mono font-bold leading-none truncate" style={{ color: border }}>
                              {hora}
                            </p>
                            <p className="text-[9px] text-on-surface font-medium truncate leading-tight">
                              {t.clientes?.nombre ?? '—'}
                            </p>
                          </div>
                        )
                      })}
                    </div>
                  )
                }

                if (slot.status === 'bloqueado_horas') return (
                  <div
                    key={dg.fechaStr}
                    style={{ height: ROW_H }}
                    className="border-b border-r border-outline-variant/30 bg-se-bg/15 px-1.5 flex items-center justify-between"
                  >
                    <span className="text-[9px] text-se-text/60 font-medium">Bloq.</span>
                    {!readOnly && slot.bloqueoId && (
                      <button
                        onClick={() => eliminarBloqueo(slot.bloqueoId!)}
                        disabled={loadingKey === `del-${slot.bloqueoId}`}
                        className="text-[9px] text-se-text/50 hover:text-se-text transition-colors disabled:opacity-40"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                )

                return <div key={dg.fechaStr} style={{ height: ROW_H }} className="border-b border-r border-outline-variant/30" />
              })}
            </Fragment>
          ))}
        </div>
      </div>

      {/* Modal bloqueo de horas — solo en vista individual */}
      {!readOnly && addingDia && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setAddingDia(null)}>
          <div
            className="bg-surface-card border border-outline-variant rounded-xl p-4 w-64 flex flex-col gap-3 shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            <p className="text-xs font-semibold text-text-p">Bloquear rango de horas</p>
            <div className="flex items-center gap-2">
              <input
                type="time"
                value={addForm.hora_inicio}
                onChange={e => setAddForm(f => ({ ...f, hora_inicio: e.target.value }))}
                className="flex-1 bg-surface-container border border-outline-variant rounded-lg px-2 py-1.5 text-xs text-on-surface outline-none focus:border-border-primary [color-scheme:dark]"
              />
              <span className="text-text-m text-xs">→</span>
              <input
                type="time"
                value={addForm.hora_fin}
                onChange={e => setAddForm(f => ({ ...f, hora_fin: e.target.value }))}
                className="flex-1 bg-surface-container border border-outline-variant rounded-lg px-2 py-1.5 text-xs text-on-surface outline-none focus:border-border-primary [color-scheme:dark]"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => agregarBloqueoHoras(addingDia)}
                disabled={loadingKey === `add-${addingDia}`}
                className="flex-1 bg-gradient-to-r from-nt-navy to-blue-600 text-white rounded-lg py-1.5 text-xs font-semibold disabled:opacity-60"
              >
                {loadingKey === `add-${addingDia}` ? '…' : 'Agregar'}
              </button>
              <button onClick={() => setAddingDia(null)} className="text-text-m hover:text-on-surface text-xs px-2 transition-colors">
                ✕
              </button>
            </div>
          </div>
        </div>
      )}

      {selected && (
        <TurnoModal
          turno={selected}
          onClose={() => setSelected(null)}
          showLink={false}
          onCancelled={id => { setTurnos(prev => prev.filter(t => t.id !== id)); setSelected(null) }}
        />
      )}
      {!readOnly && nuevoSlot && (
        <NuevoTurnoModal
          onClose={() => setNuevoSlot(null)}
          defaultFecha={nuevoSlot.fecha}
          defaultHora={nuevoSlot.hora}
        />
      )}
    </>
  )
}
