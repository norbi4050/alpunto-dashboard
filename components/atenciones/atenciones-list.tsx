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
    return <div className="flex-1 flex items-center justify-center text-[#8b949e] text-sm p-8">Sin atenciones activas</div>
  }

  return (
    <div className="w-64 border-r border-[#21262d] flex flex-col overflow-y-auto flex-shrink-0">
      {items.map(c => {
        const ctx = c.contexto as Record<string, unknown>
        const nombre = (ctx.clienteNombre as string) ?? c.telefono
        return (
          <button key={c.telefono} onClick={() => onSelect(c)}
            className={`text-left px-4 py-3 border-b border-[#21262d] transition-colors ${
              selectedPhone === c.telefono ? 'bg-[#1f3460]' : 'hover:bg-[#1a1f2e]'
            }`}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-semibold text-[#f0f6fc] truncate">{nombre}</span>
              <span className="text-[10px] text-[#8b949e] ml-2 flex-shrink-0">
                {formatDistanceToNow(new Date(c.updated_at), { locale: es, addSuffix: false })}
              </span>
            </div>
            <p className="text-[11px] text-[#58a6ff]">{c.telefono}</p>
          </button>
        )
      })}
    </div>
  )
}
