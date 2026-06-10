// app/dashboard/conversaciones/conversaciones-client.tsx
'use client'
import { useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { HistorialList, type HistorialListHandle } from '@/components/conversaciones/historial-list'
import { HistorialChatPanel } from '@/components/conversaciones/historial-chat-panel'
import { BotNivelBanner } from '@/components/conversaciones/bot-nivel-banner'
import { MetricasVivo } from '@/components/conversaciones/metricas-vivo'
import { Topbar } from '@/components/layout/topbar'
import type { Conversacion, UserRole } from '@/lib/types'

interface Props { role: UserRole }

function EmptyState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-8">
      <div className="w-12 h-12 rounded-2xl bg-surface-container flex items-center justify-center text-2xl">💬</div>
      <p className="text-sm font-semibold text-text-s">Seleccioná una conversación</p>
      <p className="text-xs text-text-m">Hacé click en un cliente de la lista para ver el historial</p>
    </div>
  )
}

export function ConversacionesPageClient({ role }: Props) {
  const searchParams = useSearchParams()
  const initialPhone = searchParams.get('telefono')
  const listRef = useRef<HistorialListHandle>(null)

  const [selected, setSelected] = useState<Conversacion | null>(null)

  function handleConvUpdate(conv: Conversacion) {
    setSelected(conv)
    listRef.current?.updateConv(conv)  // actualiza badge en la lista inmediatamente
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Topbar
        title="Conversaciones"
        subtitle="Historial completo de chats con clientes"
      />

      <div className="flex-1 flex overflow-hidden bg-surface-deep">
        {/* Left panel — oculto en mobile cuando hay conversación seleccionada */}
        <div
          className={`${selected ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-64 lg:w-80 flex-shrink-0 border-r border-outline-variant`}
          style={{ background: 'var(--glass-bg)', backdropFilter: `blur(var(--glass-blur))` }}
        >
          <BotNivelBanner role={role} />
          <MetricasVivo />
          <HistorialList
            ref={listRef}
            selectedPhone={selected?.telefono ?? null}
            onSelect={setSelected}
            initialPhone={initialPhone}
            role={role}
          />
        </div>
        {/* Right panel — fullscreen en mobile cuando hay selección */}
        <div
          className={`${selected ? 'flex' : 'hidden md:flex'} flex-1 flex-col overflow-hidden`}
          style={{ background: 'var(--glass-bg)', backdropFilter: `blur(var(--glass-blur))` }}
        >
          {selected ? (
            <>
              <button
                onClick={() => setSelected(null)}
                className="md:hidden flex items-center gap-2 px-4 py-3 border-b border-outline-variant text-sm text-stitch-primary font-semibold bg-surface-card flex-shrink-0">
                ← Conversaciones
              </button>
              <HistorialChatPanel conv={selected} onConvUpdate={handleConvUpdate} onReset={() => setSelected(null)} role={role} />
            </>
          ) : (
            <EmptyState />
          )}
        </div>
      </div>
    </div>
  )
}
