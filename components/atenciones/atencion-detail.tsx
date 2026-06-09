// components/atenciones/atencion-detail.tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Conversacion } from '@/lib/types'

interface Props { conv: Conversacion; onClosed?: () => void }

export function AtencionDetail({ conv, onClosed }: Props) {
  const router = useRouter()
  const [mensaje, setMensaje] = useState('')
  const [loading, setLoading] = useState<'enviar' | 'cerrar' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const ctx = conv.contexto as Record<string, unknown>

  async function send(cerrar = false) {
    if (!mensaje.trim() && !cerrar) return
    setLoading(cerrar ? 'cerrar' : 'enviar')
    setError(null)
    const mensajeEnviar = cerrar ? '✅ Atención finalizada. Quedamos a disposición.' : mensaje
    const res = await fetch('/api/atenciones/responder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telefono: conv.telefono, mensaje: mensajeEnviar, cerrar }),
    })
    if (res.ok) {
      setMensaje('')
      if (cerrar) { router.refresh(); onClosed?.() }
    } else { setError('Error al enviar. Intentá de nuevo.') }
    setLoading(null)
  }

  return (
    <div className="flex-1 flex flex-col p-5 gap-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-base font-bold text-text-p">{(ctx.clienteNombre as string) ?? 'Cliente'}</h2>
          <p className="text-xs text-stitch-primary mt-0.5">{conv.telefono} · Atención activa</p>
        </div>
        <span className="text-[11px] bg-sw-bg border border-border-warning text-sw-text px-2 py-0.5 rounded-full font-semibold">Esperando</span>
      </div>

      <div className="bg-surface-container rounded-xl p-4 flex flex-col gap-2 text-xs">
        {[
          ['Turno próximo', (ctx.turnoFecha as string) ?? '—'],
          ['Servicio', (ctx.servicioNombre as string) ?? '—'],
          ['Barbero', (ctx.barberNombre as string) ?? '—'],
          ['Último mensaje', (ctx.ultimoMensaje as string) ?? '—'],
        ].map(([k, v]) => (
          <div key={k} className="flex gap-2">
            <span className="text-text-m w-28 flex-shrink-0">{k}</span>
            <span className="text-on-surface">{v}</span>
          </div>
        ))}
      </div>

      <div className="mt-auto flex flex-col gap-2">
        {error && <p className="text-xs text-se-text">{error}</p>}
        <textarea
          value={mensaje}
          onChange={e => setMensaje(e.target.value)}
          placeholder="Respondé por WhatsApp directamente desde acá…"
          rows={3}
          className="w-full bg-surface-container border border-outline-variant rounded-xl px-4 py-3 text-sm text-on-surface resize-none outline-none focus:border-stitch-primary transition-colors"
        />
        <div className="flex gap-2">
          <button onClick={() => send(true)} disabled={!!loading}
            className="bg-surface-container border border-outline-variant text-text-m hover:text-on-surface rounded-lg px-4 py-2 text-xs font-semibold transition-colors disabled:opacity-60">
            {loading === 'cerrar' ? 'Cerrando…' : '✓ Cerrar atención'}
          </button>
          <button onClick={() => send(false)} disabled={!!loading || !mensaje.trim()}
            className="flex-1 bg-gradient-to-r from-nt-navy to-blue-600 hover:brightness-110 text-white rounded-lg py-2 text-xs font-semibold transition-colors disabled:opacity-60">
            {loading === 'enviar' ? 'Enviando…' : 'Enviar →'}
          </button>
        </div>
      </div>
    </div>
  )
}
