'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { UserRole } from '@/lib/types'

interface Props { role: UserRole }

const NIVEL_CONFIG = {
  '1': {
    dot: 'bg-[#6366f1] animate-pulse',
    text: 'Bot en Modo Básico · Respondés vos desde acá',
    color: 'text-[#6366f1]',
    bg: 'bg-[#1a1a2e] border-[#6366f130]',
  },
  '2': {
    dot: 'bg-[#3fb950]',
    text: 'Bot Asistente activo · Escala casos complejos a Agustín',
    color: 'text-[#3fb950]',
    bg: 'bg-[#1e2a1e] border-[#3fb95030]',
  },
  '3': {
    dot: 'bg-[#3fb950]',
    text: 'Sistema completo activo',
    color: 'text-[#3fb950]',
    bg: 'bg-[#1e2a1e] border-[#3fb95030]',
  },
} as const

export function BotNivelBanner({ role }: Props) {
  const [nivel, setNivel] = useState<'1' | '2' | '3'>('3')

  useEffect(() => {
    fetch('/api/configuracion')
      .then(r => r.json())
      .then(({ config }: { config: Record<string, string> }) => {
        const n = config?.bot_nivel
        if (n === '1' || n === '2' || n === '3') setNivel(n)
      })
      .catch(() => {})
  }, [])

  const cfg = NIVEL_CONFIG[nivel]

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 border-b ${cfg.bg}`}>
      <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
      <span className={`text-[10px] flex-1 ${cfg.color}`}>{cfg.text}</span>
      {role === 'dueno' && (
        <Link
          href="/dashboard/configuracion"
          className="text-[9px] text-[#8b949e] hover:text-[#e6edf3] underline flex-shrink-0 transition-colors"
        >
          Cambiar
        </Link>
      )}
    </div>
  )
}
