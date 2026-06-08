'use client'
import { useState } from 'react'
import type { Turno } from '@/lib/types'
import { TurnoModal } from './turno-modal'
import { NuevoTurnoModal } from './nuevo-turno-modal'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

const statusConfig: Record<string, { label: string; classes: string }> = {
  confirmado:     { label: 'Confirmado',     classes: 'bg-ss-bg text-ss-text border border-border-success' },
  asistido:       { label: 'Asistido',       classes: 'bg-ss-bg text-ss-text border border-border-success' },
  agendado:       { label: 'Agendado',       classes: 'bg-si-bg text-si-text border border-border-primary' },
  cancelado:      { label: 'Cancelado',      classes: 'bg-se-bg text-se-text border border-border-error' },
  auto_cancelado: { label: 'Cancelado auto', classes: 'bg-se-bg text-se-text border border-border-error' },
}

function getTiempoStatus(fechaHora: Date, estado: string) {
  if (estado === 'asistido' || estado === 'cancelado' || estado === 'auto_cancelado') return 'neutro'
  const now = new Date()
  const diffMin = (fechaHora.getTime() - now.getTime()) / 60000
  if (diffMin >= -30 && diffMin <= 30) return 'en_curso'
  if (diffMin > 30 && diffMin <= 120) return 'proximo'
  if (diffMin < -30) return 'pasado'
  return 'neutro'
}

const TIEMPO_BADGE: Record<string, string> = {
  en_curso: 'bg-sw-bg border border-border-warning text-sw-text',
  proximo:  'bg-si-bg border border-border-primary text-si-text',
  pasado:   '',
  neutro:   '',
}

const TIEMPO_LABEL: Record<string, string> = {
  en_curso: 'En curso',
  proximo:  'Próximo',
  pasado:   '',
  neutro:   '',
}

interface Props {
  turnos: Turno[]
  showDate?: boolean
  canCreate?: boolean
  showLink?: boolean
}

export function TurnosTable({ turnos, showDate = false, canCreate = false, showLink = true }: Props) {
  const [selected, setSelected] = useState<Turno | null>(null)
  const [showNuevo, setShowNuevo] = useState(false)

  return (
    <>
      {canCreate && (
        <div className="flex justify-end mb-3">
          <button onClick={() => setShowNuevo(true)}
            className="bg-gradient-to-r from-nt-navy to-blue-600 hover:brightness-110 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors">
            + Nuevo turno
          </button>
        </div>
      )}
      <div className="bg-surface-card border border-outline-variant rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-surface-container-low text-[10px] font-semibold text-text-m uppercase tracking-wider">
              <th className="text-left px-4 py-3">Hora{showDate ? ' / Fecha' : ''}</th>
              <th className="text-left px-4 py-3">Cliente</th>
              <th className="text-left px-4 py-3">Servicio</th>
              <th className="text-left px-4 py-3">Barbero</th>
              <th className="text-left px-4 py-3">Estado</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {turnos.length === 0 && (
              <tr><td colSpan={6} className="text-center py-10 text-text-m text-sm">Sin turnos para este período</td></tr>
            )}
            {turnos.map(t => {
              const fecha = new Date(t.fecha_hora)
              const isCancelled = t.estado === 'cancelado' || t.estado === 'auto_cancelado'
              const sc = statusConfig[t.estado] ?? { label: t.estado, classes: 'bg-surface-container text-text-s border border-outline-variant' }
              const tiempo = getTiempoStatus(fecha, t.estado)
              return (
                <tr key={t.id} className={`border-t border-outline-variant hover:bg-surface-container transition-colors ${isCancelled ? 'opacity-60' : ''} ${tiempo === 'en_curso' ? 'border-l-2 border-l-sw-text' : ''}`}>
                  <td className={`px-4 py-3 font-mono text-sm text-text-s ${isCancelled ? 'line-through' : ''}`}>
                    <div className="flex items-center gap-2">
                      {showDate ? format(fecha, "d/MM · HH:mm", { locale: es }) : format(fecha, 'HH:mm')}
                      {TIEMPO_LABEL[tiempo] && (
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex items-center gap-1 ${TIEMPO_BADGE[tiempo]}`}>
                          {tiempo === 'en_curso' && <span className="inline-block w-1.5 h-1.5 rounded-full bg-sw-text animate-pulse" />}
                          {TIEMPO_LABEL[tiempo]}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-text-p">{t.clientes?.nombre ?? '—'}</td>
                  <td className="px-4 py-3 text-sm text-text-s">{t.servicio ?? '—'}</td>
                  <td className="px-4 py-3 text-sm text-text-s">
                    <div className="flex items-center gap-1.5">
                      {t.barberos?.color && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: t.barberos.color }} />}
                      {t.barberos?.nombre ?? '—'}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${sc.classes}`}>{sc.label}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => setSelected(t)}
                      className="text-xs bg-surface-container border border-outline-variant text-text-s hover:text-text-p rounded-md px-3 py-1 transition-colors">
                      Ver
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {selected && <TurnoModal turno={selected} onClose={() => setSelected(null)} showLink={showLink} />}
      {showNuevo && <NuevoTurnoModal onClose={() => setShowNuevo(false)} />}
    </>
  )
}
