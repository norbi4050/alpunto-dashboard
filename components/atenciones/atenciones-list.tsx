// components/atenciones/atenciones-list.tsx
'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Conversacion } from '@/lib/types'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

interface Props {
  initial: Conversacion[]
  selectedPhone: string | null
  onSelect: (conv: Conversacion) => void
}

export function AtencionesList({ initial, selectedPhone, onSelect }: Props) {
  const [items, setItems] = useState<Conversacion[]>(initial)

  useEffect(() => { setItems(initial) }, [initial])

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('atenciones-realtime')
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'conversaciones',
        filter: 'handoff_humano=eq.true'
      }, () => {
        Promise.resolve(supabase.from('conversaciones')
          .select('*').eq('handoff_humano', true).order('updated_at', { ascending: false }))
          .then(({ data }) => { if (data) setItems(data as Conversacion[]) })
          .catch(() => {})
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  if (items.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-2 p-8 text-center">
        <span className="text-3xl">✅</span>
        <p className="text-sm font-semibold text-text-p">Sin atenciones pendientes</p>
        <p className="text-xs text-text-m max-w-xs">
          Cuando un cliente pida hablar con una persona, la conversación va a aparecer acá para que la respondas.
        </p>
      </div>
    )
  }

  return (
    <div className="w-64 border-r border-outline-variant flex flex-col overflow-y-auto flex-shrink-0">
      {items.map(c => {
        const ctx = c.contexto as Record<string, unknown>
        const nombre = (ctx.clienteNombre as string) ?? c.telefono
        return (
          <button key={c.telefono} onClick={() => onSelect(c)}
            className={`text-left px-4 py-3 border-b border-outline-variant transition-colors ${
              selectedPhone === c.telefono ? 'bg-surface-container-high' : 'hover:bg-surface-container'
            }`}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-semibold text-text-p truncate">{nombre}</span>
              <span className="text-[10px] text-text-m ml-2 flex-shrink-0">
                {formatDistanceToNow(new Date(c.updated_at), { locale: es, addSuffix: false })}
              </span>
            </div>
            <p className="text-[11px] text-stitch-primary">{c.telefono}</p>
          </button>
        )
      })}
    </div>
  )
}
