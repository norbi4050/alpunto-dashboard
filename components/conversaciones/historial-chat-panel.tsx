// dashboard/components/conversaciones/historial-chat-panel.tsx
'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { Conversacion, Mensaje } from '@/lib/types'
import { format, parseISO } from 'date-fns'

interface Props {
  conv: Conversacion
  onConvUpdate: (conv: Conversacion) => void
  onReset?: () => void
  role?: string
}

export function HistorialChatPanel({ conv, onConvUpdate, onReset, role }: Props) {
  const [msgs, setMsgs] = useState<Mensaje[]>([])
  const [handoff, setHandoff] = useState(conv.handoff_humano)
  const [mensaje, setMensaje] = useState('')
  const [loading, setLoading] = useState<'enviar' | 'terminar' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmBlock, setConfirmBlock] = useState(false)
  const [blocking, setBlocking] = useState(false)
  const [blocked, setBlocked] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const [resetting, setResetting] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const supabaseRef = useRef(createClient())

  const ctx = conv.contexto as Record<string, unknown>
  const nombre = (ctx.clienteNombre as string) ?? conv.telefono
  const tieneTurno = !!ctx.turno_id

  useEffect(() => {
    setHandoff(conv.handoff_humano)
    setMensaje('')
    setError(null)
    setBlocked(false)
    const supabase = supabaseRef.current
    void Promise.all([
      supabase.from('mensajes').select('*')
        .eq('telefono', conv.telefono)
        .order('created_at', { ascending: true })
        .limit(200)
        .then(({ data }) => { if (data) setMsgs(data as Mensaje[]) }),
      supabase.from('bloqueados').select('telefono', { head: true, count: 'exact' })
        .eq('telefono', conv.telefono)
        .then(({ count }) => { if ((count ?? 0) > 0) setBlocked(true) }),
    ])
  }, [conv.telefono, conv.handoff_humano])

  useEffect(() => {
    const supabase = supabaseRef.current
    const ch = supabase
      .channel(`historial-${conv.telefono}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public',
        table: 'mensajes',
        filter: `telefono=eq.${conv.telefono}`,
      }, payload => {
        setMsgs(prev => {
          const incoming = payload.new as Mensaje
          if (prev.some(m => m.id === incoming.id)) return prev
          return [...prev, incoming]
        })
      })
      .subscribe()
    return () => { void supabase.removeChannel(ch) }
  }, [conv.telefono])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [msgs])

  async function enviar() {
    if (!mensaje.trim() || loading) return
    setLoading('enviar')
    setError(null)
    const text = mensaje
    setMensaje('')

    // Si no está en handoff, activarlo primero para que WF02 no interfiera
    if (!handoff) {
      const r = await fetch('/api/conversaciones/retomar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telefono: conv.telefono }),
      })
      if (!r.ok) {
        setError('No se pudo activar el modo dueno')
        setLoading(null)
        return
      }
      setHandoff(true)
      onConvUpdate({ ...conv, handoff_humano: true })
    }

    // Optimistic update
    const optimistic: Mensaje = {
      id: `opt-${Date.now()}`,
      telefono: conv.telefono,
      direccion: 'salida',
      contenido: text,
      estado_bot: 'dueno',
      created_at: new Date().toISOString(),
    }
    setMsgs(prev => [...prev, optimistic])

    const res = await fetch('/api/atenciones/responder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telefono: conv.telefono, mensaje: text, cerrar: false }),
    })
    if (!res.ok) {
      setError('Error al enviar el mensaje')
      setMsgs(prev => prev.filter(m => m.id !== optimistic.id))
    }
    setLoading(null)
  }

  async function reiniciar() {
    setResetting(true)
    setError(null)
    const res = await fetch('/api/conversaciones/reiniciar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telefono: conv.telefono }),
    })
    setResetting(false)
    setConfirmReset(false)
    if (!res.ok) { setError('Error al reiniciar la conversación'); return }
    onReset?.()
  }

  async function bloquear() {
    setBlocking(true)
    setError(null)
    const res = await fetch('/api/bloquear', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telefono: conv.telefono }),
    })
    setBlocking(false)
    setConfirmBlock(false)
    if (!res.ok) { setError('Error al bloquear el número'); return }
    const data = await res.json() as { ok: boolean; warning?: string }
    setBlocked(true)
    if (data.warning) setError(data.warning)
  }

  async function terminar() {
    setLoading('terminar')
    setError(null)
    const res = await fetch('/api/atenciones/responder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        telefono: conv.telefono,
        mensaje: '✅ Atención finalizada. Quedamos a disposición.',
        cerrar: true,
      }),
    })
    if (res.ok) {
      setHandoff(false)
      onConvUpdate({ ...conv, handoff_humano: false })
    } else {
      setError('Error al cerrar la atención')
    }
    setLoading(null)
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-outline-variant flex-shrink-0 bg-surface-container-low">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-stitch-primary-container flex items-center justify-center text-[11px] font-bold text-stitch-on-primary flex-shrink-0">
            {nombre.slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-text-p truncate">{nombre}</span>
              <span className="text-[10px] text-text-s">{conv.telefono}</span>
              <Link
                href={`/dashboard/clientes?search=${encodeURIComponent(conv.telefono)}`}
                className="text-[9px] text-stitch-primary hover:underline flex-shrink-0 font-medium"
              >
                Ver cliente →
              </Link>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              {handoff && (
                <span className="text-[9px] bg-se-bg text-se-text px-2 py-0.5 rounded-full font-bold border border-border-error">
                  ✋ Modo manual
                </span>
              )}
              {tieneTurno && !handoff && (
                <span className="text-[9px] bg-ss-bg text-ss-text px-2 py-0.5 rounded-full border border-border-success">
                  ✅ Turno agendado
                </span>
              )}
              {!handoff && !tieneTurno && (
                <span className="text-[9px] text-text-s">{conv.estado}</span>
              )}
            </div>
          </div>
          {/* Botones de acción */}
          {role === 'dueno' && (
            <button
              onClick={() => { setConfirmReset(true); setConfirmBlock(false) }}
              title="Reiniciar conversación"
              className="text-text-s hover:text-stitch-primary text-xs transition-colors flex-shrink-0 px-1"
            >
              🔄
            </button>
          )}
          {!blocked && role === 'dueno' && (
            <button
              onClick={() => { setConfirmBlock(true); setConfirmReset(false) }}
              title="Bloquear número"
              className="text-text-s hover:text-se-text text-xs transition-colors flex-shrink-0 px-1"
            >
              🚫
            </button>
          )}
          {blocked && (
            <span className="text-[9px] bg-se-bg text-se-text px-2 py-0.5 rounded-full font-bold border border-border-error flex-shrink-0">
              Bloqueado
            </span>
          )}
        </div>
        {/* Confirmación de reinicio */}
        {confirmReset && (
          <div className="mt-2 p-3 bg-si-bg border border-border-primary rounded-lg">
            <p className="text-[11px] text-text-p mb-1 font-semibold">¿Reiniciar esta conversación?</p>
            <p className="text-[10px] text-stitch-primary mb-3 font-mono">{conv.telefono}</p>
            <p className="text-[10px] text-text-s mb-3">El historial de mensajes se mantiene, pero el estado del bot se resetea. El próximo mensaje del cliente arranca el flujo desde cero.</p>
            <div className="flex gap-2">
              <button
                onClick={reiniciar}
                disabled={resetting}
                className="bg-stitch-primary-container hover:brightness-110 text-stitch-on-primary text-[11px] font-semibold px-3 py-1.5 rounded-md transition-colors disabled:opacity-60"
              >
                {resetting ? 'Reiniciando…' : 'Sí, reiniciar'}
              </button>
              <button
                onClick={() => setConfirmReset(false)}
                disabled={resetting}
                className="text-text-s hover:text-text-p text-[11px] px-3 py-1.5 rounded-md transition-colors disabled:opacity-60"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
        {/* Confirmación de bloqueo */}
        {confirmBlock && (
          <div className="mt-2 p-3 bg-se-bg border border-border-error rounded-lg">
            <p className="text-[11px] text-text-p mb-1 font-semibold">¿Seguro que querés bloquear este número?</p>
            <p className="text-[10px] text-se-text mb-3 font-mono">{conv.telefono}</p>
            <p className="text-[10px] text-text-s mb-3">El número no podrá enviar mensajes al bot. Esta acción se puede revertir desde Configuración.</p>
            <div className="flex gap-2">
              <button
                onClick={bloquear}
                disabled={blocking}
                className="bg-se-text hover:brightness-90 text-white text-[11px] font-semibold px-3 py-1.5 rounded-md transition-colors disabled:opacity-60"
              >
                {blocking ? 'Bloqueando…' : 'Sí, bloquear'}
              </button>
              <button
                onClick={() => setConfirmBlock(false)}
                disabled={blocking}
                className="text-text-s hover:text-text-p text-[11px] px-3 py-1.5 rounded-md transition-colors disabled:opacity-60"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Mensajes */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-2">
        {msgs.map(m => {
          const esSecretaria = m.estado_bot === 'dueno'
          return (
            <div key={m.id} className={`flex ${m.direccion === 'salida' ? 'justify-end' : 'justify-start'}`}>
              <div className="max-w-[75%]">
                <div className={`px-3 py-2 rounded-xl text-xs leading-relaxed ${
                  m.direccion === 'salida'
                    ? esSecretaria
                      ? 'bg-sw-bg border border-border-warning text-sw-text rounded-br-sm'
                      : 'bg-surface-container border border-border-primary text-stitch-primary rounded-br-sm'
                    : 'bg-surface-container-high text-on-surface rounded-bl-sm'
                }`}>
                  {m.contenido}
                </div>
                <div className={`text-[9px] text-text-m mt-0.5 ${m.direccion === 'salida' ? 'text-right' : ''}`}>
                  {m.direccion === 'salida' && (
                    <span className={`mr-1 ${esSecretaria ? 'text-sw-text' : 'text-ss-text'}`}>
                      {esSecretaria ? 'Secretaria ·' : 'BarberBot ·'}
                    </span>
                  )}
                  {format(parseISO(m.created_at), 'HH:mm')}
                </div>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Footer — input SIEMPRE visible */}
      <div className="px-4 py-3 border-t border-outline-variant flex-shrink-0">
        {error && <p className="text-[10px] text-se-text mb-2">{error}</p>}
        <div className="flex gap-2">
          <input
            value={mensaje}
            onChange={e => setMensaje(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void enviar() } }}
            placeholder={handoff ? 'Escribí un mensaje al cliente...' : 'Escribir como dueno (activa handoff)...'}
            className="flex-1 bg-surface-container border border-outline-variant rounded-lg px-3 py-2 text-xs text-on-surface placeholder-text-m outline-none focus:border-stitch-primary transition-colors"
          />
          <button
            onClick={enviar}
            disabled={!!loading || !mensaje.trim()}
            className="bg-stitch-primary-container hover:brightness-110 text-stitch-on-primary rounded-lg px-3 py-2 text-xs font-semibold transition-colors disabled:opacity-60"
          >
            {loading === 'enviar' ? '…' : 'Enviar'}
          </button>
        </div>
        {handoff && (
          <div className="flex items-center justify-between mt-2">
            <p className="text-[9px] text-sw-text">⚠ Bot pausado · los mensajes van al cliente</p>
            <button
              onClick={terminar}
              disabled={!!loading}
              className="text-[10px] bg-se-bg hover:brightness-90 text-se-text border border-border-error rounded-md px-3 py-1 font-semibold transition-colors disabled:opacity-60"
            >
              {loading === 'terminar' ? 'Cerrando…' : '✕ Terminar atención'}
            </button>
          </div>
        )}
        {!handoff && (
          <p className="text-[9px] text-text-m mt-1.5">
            Solo lectura · {msgs.length} mensajes · última actividad {format(parseISO(conv.updated_at), 'dd/MM HH:mm')}
          </p>
        )}
      </div>
    </div>
  )
}
