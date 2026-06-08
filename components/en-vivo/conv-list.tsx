'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Conversacion } from '@/lib/types'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

const DOT_COLOR: Record<string, string> = {
  eligiendo_servicio: 'bg-green-400',
  eligiendo_barbero: 'bg-green-400',
  eligiendo_slot: 'bg-green-400',
  confirmando_turno: 'bg-yellow-400',
  esperando_confirmacion: 'bg-yellow-400',
  inicio: 'bg-blue-400',
  confirmado: 'bg-blue-400',
}

interface Props {
  initial: Conversacion[]
  selectedPhone: string | null
  onSelect: (conv: Conversacion) => void
}

export function ConvList({ initial, selectedPhone, onSelect }: Props) {
  const [items, setItems] = useState(initial)

  useEffect(() => {
    const supabase = createClient()
    const thirtyMinAgo = () => new Date(Date.now() - 30 * 60 * 1000).toISOString()
    const fetchItems = () => {
      supabase.from('conversaciones').select('*')
        .neq('estado', 'inicio').gte('updated_at', thirtyMinAgo())
        .order('updated_at', { ascending: false })
        .then(({ data }) => { if (data) setItems(data as Conversacion[]) })
    }
    fetchItems()
    const channel = supabase
      .channel('enlivo-convs')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversaciones' }, fetchItems)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  return (
    <div className="w-56 border-r border-[#21262d] flex flex-col overflow-y-auto flex-shrink-0">
      <div className="px-3 py-2 border-b border-[#21262d]">
        <p className="text-[11px] font-semibold text-[#8b949e] uppercase tracking-wide">{items.length} activas ahora</p>
      </div>
      {items.length === 0 && (
        <div className="flex-1 flex items-center justify-center p-8 text-[#8b949e] text-xs text-center">
          Sin conversaciones activas en los últimos 30 min
        </div>
      )}
      {items.map(c => {
        const ctx = c.contexto as Record<string, unknown>
        const nombre = (ctx.clienteNombre as string) ?? c.telefono
        const dot = DOT_COLOR[c.estado] ?? 'bg-[#8b949e]'
        return (
          <button key={c.telefono} onClick={() => onSelect(c)}
            className={`text-left px-3 py-2.5 border-b border-[#21262d] transition-colors ${selectedPhone === c.telefono ? 'bg-[#1f3460]' : 'hover:bg-[#1a1f2e]'}`}>
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dot}`}></span>
              <span className="text-xs font-semibold text-[#f0f6fc] truncate flex-1">{nombre}</span>
              <span className="text-[9px] text-[#8b949e]">{formatDistanceToNow(new Date(c.updated_at), { locale: es })}</span>
            </div>
            <p className="text-[10px] text-[#8b949e] pl-3">{c.estado}</p>
          </button>
        )
      })}
    </div>
  )
}
