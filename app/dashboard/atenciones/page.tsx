'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { AtencionesList } from '@/components/atenciones/atenciones-list'
import { AtencionDetail } from '@/components/atenciones/atencion-detail'
import { Topbar } from '@/components/layout/topbar'
import type { Conversacion } from '@/lib/types'

export default function AtencionesPage() {
  const [convs, setConvs] = useState<Conversacion[]>([])
  const [selectedConv, setSelectedConv] = useState<Conversacion | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.from('conversaciones')
      .select('*')
      .eq('handoff_humano', true)
      .order('updated_at', { ascending: false })
      .then(({ data }) => {
        if (data) setConvs(data as Conversacion[])
      })
  }, [])

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Topbar title="Atenciones en curso" subtitle={`${convs.length} cliente${convs.length !== 1 ? 's' : ''} esperando respuesta`}>
        <div className="flex items-center gap-1.5 text-xs text-[#3fb950] font-semibold">
          <span className="w-1.5 h-1.5 rounded-full bg-[#3fb950] animate-pulse"></span>
          Actualización en tiempo real
        </div>
      </Topbar>
      <div className="flex flex-1 overflow-hidden">
        <AtencionesList initial={convs} selectedPhone={selectedConv?.telefono ?? null} onSelect={setSelectedConv} />
        <div className="flex-1 overflow-y-auto">
          {selectedConv
            ? <AtencionDetail conv={selectedConv} onClosed={() => setSelectedConv(null)} />
            : <div className="flex items-center justify-center h-full text-[#8b949e] text-sm">Seleccioná una atención para responder</div>
          }
        </div>
      </div>
    </div>
  )
}
