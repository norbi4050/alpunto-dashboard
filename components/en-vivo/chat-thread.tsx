'use client'
import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Mensaje } from '@/lib/types'
import { format } from 'date-fns'

interface Props { telefono: string; estado: string }

export function ChatThread({ telefono, estado }: Props) {
  const [msgs, setMsgs] = useState<Mensaje[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const supabase = createClient()
    void supabase.from('mensajes').select('*')
      .eq('telefono', telefono)
      .order('created_at', { ascending: true })
      .limit(100)
      .then(({ data }) => { if (data) setMsgs(data as Mensaje[]) })

    const channel = supabase
      .channel(`chat-${telefono}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'mensajes',
        filter: `telefono=eq.${telefono}`
      }, payload => {
        setMsgs(prev => [...prev, payload.new as Mensaje])
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [telefono])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [msgs])

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-4 py-3 border-b border-[#21262d] flex items-center justify-between flex-shrink-0">
        <p className="text-sm font-bold text-[#f0f6fc]">{telefono}</p>
        <span className="text-[10px] bg-[#1f3460] text-[#58a6ff] px-2 py-0.5 rounded-full font-semibold">{estado}</span>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-2">
        {msgs.map(m => (
          <div key={m.id} className={`flex ${m.direccion === 'salida' ? 'justify-end' : 'justify-start'}`}>
            <div className="max-w-[75%]">
              <div className={`px-3 py-2 rounded-xl text-xs leading-relaxed ${
                m.direccion === 'salida'
                  ? 'bg-blue-800 text-blue-100 rounded-br-sm'
                  : 'bg-[#21262d] text-[#c9d1d9] rounded-bl-sm'
              }`}>{m.contenido}</div>
              <div className={`text-[9px] text-[#64748b] mt-0.5 ${m.direccion === 'salida' ? 'text-right' : ''}`}>
                {m.direccion === 'salida' && <span className="text-green-600 mr-1">BarberBot ·</span>}
                {format(new Date(m.created_at), 'HH:mm')}
              </div>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="px-4 py-2.5 border-t border-[#21262d] flex-shrink-0">
        <p className="text-[11px] text-[#64748b]">👁 Vista de solo lectura · BarberBot está respondiendo automáticamente</p>
      </div>
    </div>
  )
}
