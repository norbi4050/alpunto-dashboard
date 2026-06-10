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
        <div className="flex items-center gap-1.5 text-xs text-ss-text font-semibold">
          <span className="w-1.5 h-1.5 rounded-full bg-ss-text animate-pulse"></span>
          En vivo
        </div>
      </Topbar>

      {/* Mobile: master-detail. Si hay seleccionado, muestra detalle a pantalla completa */}
      <div className="flex flex-1 overflow-hidden">
        {/* Panel lista — oculto en mobile cuando hay selección */}
        <div className={`${selectedConv ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-64 flex-shrink-0 border-r border-outline-variant`}>
          <AtencionesList
            initial={convs}
            selectedPhone={selectedConv?.telefono ?? null}
            onSelect={setSelectedConv}
          />
        </div>

        {/* Panel detalle — fullscreen en mobile */}
        <div className={`${selectedConv ? 'flex' : 'hidden md:flex'} flex-1 flex-col overflow-y-auto`}>
          {selectedConv ? (
            <>
              {/* Botón volver — solo mobile */}
              <button
                onClick={() => setSelectedConv(null)}
                className="md:hidden flex items-center gap-2 px-4 py-3 border-b border-outline-variant text-sm text-stitch-primary font-semibold bg-surface-card flex-shrink-0">
                ← Volver
              </button>
              <AtencionDetail conv={selectedConv} onClosed={() => setSelectedConv(null)} />
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-text-m text-sm">
              Seleccioná una atención para responder
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
