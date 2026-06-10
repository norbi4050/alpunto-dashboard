'use client'
import { useState, useTransition } from 'react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'

interface Feedback {
  id: string
  telefono: string
  calificacion: number | null
  comentario: string | null
  leido: boolean
  created_at: string
  turnos: {
    servicio: string | null
    fecha_hora: string | null
    barbero_id: string | null
    barberos: { nombre: string } | null
  } | null
  clientes: { nombre: string | null; whatsapp: string | null } | null
}

interface Props { feedbacks: Feedback[] }

function Stars({ n }: { n: number | null }) {
  if (!n) return <span className="text-xs text-text-m italic">sin calificación</span>
  return (
    <span className="flex gap-0.5">
      {[1,2,3,4,5].map(i => (
        <span key={i} className={i <= n ? 'text-amber-400' : 'text-text-m opacity-30'}>★</span>
      ))}
    </span>
  )
}

export function FeedbacksClient({ feedbacks: inicial }: Props) {
  const [items, setItems] = useState(inicial)
  const [filtro, setFiltro] = useState<'todos'|'sin_leer'|'con_comentario'>('todos')
  const [, startTransition] = useTransition()

  const filtrados = items.filter(f => {
    if (filtro === 'sin_leer') return !f.leido
    if (filtro === 'con_comentario') return !!f.comentario
    return true
  })

  async function marcarLeido(id: string) {
    startTransition(() => {
      setItems(prev => prev.map(f => f.id === id ? { ...f, leido: true } : f))
    })
    await fetch('/api/feedbacks/marcar-leido', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6">
      {/* Filtros */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {([
          ['todos', 'Todos'],
          ['sin_leer', 'Sin leer'],
          ['con_comentario', 'Con comentario'],
        ] as const).map(([val, label]) => (
          <button
            key={val}
            onClick={() => setFiltro(val)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filtro === val
                ? 'bg-stitch-primary text-white'
                : 'bg-surface-container text-text-m hover:text-on-surface'
            }`}
          >
            {label}
            {val === 'sin_leer' && (
              <span className="ml-1.5 bg-red-500/20 text-red-400 rounded-full px-1.5 py-0.5 text-[10px]">
                {items.filter(f => !f.leido).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {filtrados.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
          <div className="text-4xl">⭐</div>
          <p className="text-sm font-semibold text-text-s">Sin reseñas todavía</p>
          <p className="text-xs text-text-m">Las reseñas llegan después de la primera visita del cliente</p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtrados.map(f => {
            const nombre = f.clientes?.nombre ?? f.telefono
            const servicio = f.turnos?.servicio ?? '—'
            const barbero  = f.turnos?.barberos?.nombre ?? '—'
            const fechaTurno = f.turnos?.fecha_hora
              ? format(parseISO(f.turnos.fecha_hora), "d MMM yyyy 'a las' HH:mm", { locale: es })
              : null
            const fechaFeedback = format(parseISO(f.created_at), 'd MMM yyyy', { locale: es })

            return (
              <div
                key={f.id}
                className={`rounded-xl border p-4 flex flex-col gap-3 transition-colors ${
                  f.leido
                    ? 'bg-surface-card border-outline-variant'
                    : 'bg-surface-container border-stitch-primary/30 shadow-glow-primary'
                }`}
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-stitch-primary-container flex items-center justify-center text-[11px] font-bold text-stitch-on-primary flex-shrink-0">
                      {nombre.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-text-p truncate">{nombre}</p>
                      <p className="text-[10px] text-text-m">{f.telefono}</p>
                    </div>
                  </div>
                  {!f.leido && (
                    <span className="flex-shrink-0 text-[10px] bg-stitch-primary/20 text-stitch-primary border border-stitch-primary/30 rounded-full px-2 py-0.5 font-medium">
                      Nuevo
                    </span>
                  )}
                </div>

                {/* Calificación */}
                <Stars n={f.calificacion} />

                {/* Comentario */}
                {f.comentario && (
                  <p className="text-xs text-text-s italic bg-surface-deep rounded-lg px-3 py-2 border border-outline-variant leading-relaxed">
                    &ldquo;{f.comentario}&rdquo;
                  </p>
                )}

                {/* Detalle del turno */}
                <div className="text-[10px] text-text-m flex flex-col gap-0.5">
                  <span>✂️ {servicio} · {barbero}</span>
                  {fechaTurno && <span>📅 {fechaTurno}</span>}
                  <span className="text-text-m/60">Reseña enviada: {fechaFeedback}</span>
                </div>

                {/* Acción */}
                {!f.leido && (
                  <button
                    onClick={() => marcarLeido(f.id)}
                    className="mt-auto text-xs text-stitch-primary hover:underline self-start"
                  >
                    Marcar como leído ✓
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
