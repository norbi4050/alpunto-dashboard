// components/turnos/turno-modal.tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { createClient } from '@/lib/supabase/client'
import type { Turno } from '@/lib/types'

interface Props { turno: Turno; onClose: () => void; showLink?: boolean; onCancelled?: (turnoId: string) => void }

const ESTADO_BADGE: Record<string, { label: string; cls: string }> = {
  agendado:       { label: 'Agendado',   cls: 'bg-si-bg text-si-text border-border-info' },
  confirmado:     { label: 'Confirmado', cls: 'bg-ss-bg text-ss-text border-border-success' },
  asistido:       { label: 'Asistió',    cls: 'bg-ss-bg text-ss-text border-border-success' },
  no_show:        { label: 'No vino',    cls: 'bg-sw-bg text-sw-text border-border-warning' },
  cancelado:      { label: 'Cancelado',  cls: 'bg-se-bg text-se-text border-border-error' },
  auto_cancelado: { label: 'Cancelado',  cls: 'bg-se-bg text-se-text border-border-error' },
}

export function TurnoModal({ turno, onClose, showLink = true, onCancelled }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState<'cancelar' | 'link' | 'asistido' | 'no_show' | null>(null)
  const [estado, setEstado] = useState(turno.estado)
  const [link, setLink] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleCancelar() {
    setLoading('cancelar')
    const res = await fetch('/api/turnos/cancelar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ turno_id: turno.id }),
    })
    if (res.ok) { onCancelled ? onCancelled(turno.id) : router.refresh(); onClose() } else { setError('No se pudo cancelar'); setLoading(null) }
  }

  async function marcarAsistencia(nuevoEstado: 'asistido' | 'no_show') {
    setLoading(nuevoEstado)
    setError(null)
    const { error: err } = await createClient()
      .from('turnos')
      .update({ estado: nuevoEstado, updated_at: new Date().toISOString() })
      .eq('id', turno.id)
    if (err) { setError('No se pudo actualizar'); setLoading(null); return }
    setEstado(nuevoEstado)
    setLoading(null)
    router.refresh()
  }

  const badge = ESTADO_BADGE[estado] ?? ESTADO_BADGE.agendado
  const esActivo = estado === 'agendado' || estado === 'confirmado'

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-surface-card border border-outline-variant rounded-2xl p-6 w-full max-w-md flex flex-col gap-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-base font-bold text-text-p">{turno.clientes?.nombre ?? 'Cliente'}</h2>
            <p className="text-xs text-text-m mt-0.5">{turno.clientes?.whatsapp}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${badge.cls}`}>{badge.label}</span>
            <button onClick={onClose} className="text-text-m hover:text-on-surface text-lg">✕</button>
          </div>
        </div>

        <div className="bg-surface-container rounded-xl p-4 flex flex-col gap-2 text-xs">
          {[
            ['Fecha y hora', format(new Date(turno.fecha_hora), "EEEE d 'de' MMMM · HH:mm", { locale: es })],
            ['Servicio', turno.servicio ?? '—'],
            ['Barbero', turno.barberos?.nombre ?? '—'],
            ['WhatsApp', turno.clientes?.whatsapp ?? '—'],
          ].map(([k, v]) => (
            <div key={k} className="flex gap-2">
              <span className="text-text-m w-24 flex-shrink-0">{k}</span>
              <span className="text-on-surface font-medium">{v}</span>
            </div>
          ))}
        </div>

        {link && (
          <div className="bg-si-bg border border-border-info rounded-xl p-3">
            <p className="text-xs text-text-m mb-1">Link de check-in generado:</p>
            <p className="text-xs text-si-text break-all font-mono">{link}</p>
          </div>
        )}

        {error && <p className="text-xs text-se-text">{error}</p>}

        {esActivo && (
          <div className="flex gap-2">
            <button onClick={() => marcarAsistencia('asistido')} disabled={!!loading}
              className="flex-1 bg-ss-bg border border-border-success text-ss-text rounded-lg py-2 text-xs font-semibold hover:brightness-110 transition-all disabled:opacity-60">
              {loading === 'asistido' ? 'Guardando…' : '✓ Asistió'}
            </button>
            <button onClick={() => marcarAsistencia('no_show')} disabled={!!loading}
              className="flex-1 bg-sw-bg border border-border-warning text-sw-text rounded-lg py-2 text-xs font-semibold hover:brightness-110 transition-all disabled:opacity-60">
              {loading === 'no_show' ? 'Guardando…' : '✗ No vino'}
            </button>
          </div>
        )}

        {esActivo && (
          <button onClick={handleCancelar} disabled={!!loading}
            className="w-full bg-se-bg border border-border-error text-se-text rounded-lg py-2 text-xs font-semibold hover:brightness-110 transition-all disabled:opacity-60">
            {loading === 'cancelar' ? 'Cancelando…' : '✕ Cancelar turno'}
          </button>
        )}

        {(estado === 'asistido' || estado === 'no_show') && (
          <button onClick={() => marcarAsistencia(estado === 'asistido' ? 'no_show' : 'asistido')} disabled={!!loading}
            className="w-full bg-surface-container border border-outline-variant text-text-m hover:text-on-surface rounded-lg py-2 text-[11px] font-semibold transition-colors disabled:opacity-60">
            Corregir: marcar como {estado === 'asistido' ? 'No vino' : 'Asistió'}
          </button>
        )}
      </div>
    </div>
  )
}
