// app/dashboard/conversaciones/conversaciones-client.tsx
'use client'
import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { ConvList } from '@/components/en-vivo/conv-list'
import { ChatThread } from '@/components/en-vivo/chat-thread'
import { HistorialList } from '@/components/conversaciones/historial-list'
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
      <p className="text-xs text-text-m">Hacé click en un paciente de la lista para ver el historial</p>
    </div>
  )
}

export function ConversacionesPageClient({ role }: Props) {
  const searchParams = useSearchParams()
  const initialPhone = searchParams.get('telefono')

  const [modo, setModo] = useState<'enlivo' | 'historial'>(
    !!initialPhone ? 'historial' : 'enlivo'
  )

  // En vivo state
  const [selectedEnVivo, setSelectedEnVivo] = useState<Conversacion | null>(null)

  // Historial state
  const [selectedHistorial, setSelectedHistorial] = useState<Conversacion | null>(null)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Topbar
        title="Conversaciones"
        subtitle={modo === 'enlivo'
          ? 'Solo lectura — Sofia responde automáticamente'
          : 'Historial completo de chats con pacientes'
        }
      >
        <div className="flex items-center gap-3">
          {modo === 'enlivo' && (
            <div className="flex items-center gap-1.5 text-xs text-ss-text font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-ss-text animate-pulse" />
              Realtime activo
            </div>
          )}
          {role === 'dueno' && (
            <div className="flex bg-surface-container-low border border-outline-variant rounded-lg overflow-hidden">
              <button
                onClick={() => setModo('enlivo')}
                className={`px-3 py-1.5 text-xs font-semibold transition-colors ${
                  modo === 'enlivo' ? 'bg-surface-container text-text-p' : 'text-text-s hover:text-text-p'
                }`}
              >
                En vivo
              </button>
              <button
                onClick={() => setModo('historial')}
                className={`px-3 py-1.5 text-xs font-semibold transition-colors ${
                  modo === 'historial' ? 'bg-surface-container text-text-p' : 'text-text-s hover:text-text-p'
                }`}
              >
                Historial
              </button>
            </div>
          )}
        </div>
      </Topbar>

      <div className="flex-1 flex overflow-hidden bg-surface-deep">
        {modo === 'enlivo' ? (
          <>
            <ConvList
              initial={[]}
              selectedPhone={selectedEnVivo?.telefono ?? null}
              onSelect={setSelectedEnVivo}
            />
            <div className="flex-1 flex overflow-hidden">
              {selectedEnVivo
                ? <ChatThread telefono={selectedEnVivo.telefono} estado={selectedEnVivo.estado} />
                : <EmptyState />
              }
            </div>
          </>
        ) : (
          <>
            {/* Left panel */}
            <div
              className="w-80 flex-shrink-0 flex flex-col border-r border-outline-variant"
              style={{ background: 'var(--glass-bg)', backdropFilter: `blur(var(--glass-blur))` }}
            >
              <BotNivelBanner role={role} />
              <MetricasVivo />
              <HistorialList
                selectedPhone={selectedHistorial?.telefono ?? null}
                onSelect={setSelectedHistorial}
                initialPhone={initialPhone}
                role={role}
              />
            </div>
            {/* Right panel */}
            <div
              className="flex-1 flex flex-col overflow-hidden"
              style={{ background: 'var(--glass-bg)', backdropFilter: `blur(var(--glass-blur))` }}
            >
              {selectedHistorial
                ? <HistorialChatPanel conv={selectedHistorial} onConvUpdate={setSelectedHistorial} onReset={() => setSelectedHistorial(null)} role={role} />
                : <EmptyState />
              }
            </div>
          </>
        )}
      </div>
    </div>
  )
}
