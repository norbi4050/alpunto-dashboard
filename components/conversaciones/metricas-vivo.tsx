'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Metrics {
  activas: number
  mensajesBot: number
  turnosHoy: number
  necesitanAtencion: number
}

export function MetricasVivo() {
  const [m, setM] = useState<Metrics>({ activas: 0, mensajesBot: 0, turnosHoy: 0, necesitanAtencion: 0 })

  const fetchMetrics = useCallback(async () => {
    const supabase = createClient()
    const hoyInicio = `${new Date().toISOString().slice(0, 10)}T00:00:00`
    const [activas, mensajesBot, turnosHoy, necesitanAtencion] = await Promise.all([
      supabase.from('conversaciones').select('*', { count: 'exact', head: true }).gte('updated_at', hoyInicio),
      supabase.from('mensajes').select('*', { count: 'exact', head: true }).gte('created_at', hoyInicio).eq('direccion', 'salida').eq('estado_bot', 'bot'),
      supabase.from('turnos').select('*', { count: 'exact', head: true }).gte('fecha_hora', hoyInicio).not('estado', 'in', '(cancelado,auto_cancelado)'),
      supabase.from('conversaciones').select('*', { count: 'exact', head: true }).eq('handoff_humano', true),
    ])
    setM({
      activas: activas.count ?? 0,
      mensajesBot: mensajesBot.count ?? 0,
      turnosHoy: turnosHoy.count ?? 0,
      necesitanAtencion: necesitanAtencion.count ?? 0,
    })
  }, [])

  useEffect(() => {
    void fetchMetrics()
    const supabase = createClient()
    const ch = supabase.channel('metricas-vivo')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversaciones' }, () => { void fetchMetrics() })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensajes' }, () => { void fetchMetrics() })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'turnos' }, () => { void fetchMetrics() })
      .subscribe()
    return () => { void supabase.removeChannel(ch) }
  }, [fetchMetrics])

  const stats = [
    { val: m.activas,           label: 'activas hoy',   color: 'text-on-surface' },
    { val: m.mensajesBot,       label: 'mensajes bot',  color: 'text-ss-text' },
    { val: m.turnosHoy,         label: 'turnos hoy',    color: 'text-si-text' },
    { val: m.necesitanAtencion, label: 'req. atención', color: 'text-se-text' },
  ]

  return (
    <div className="grid grid-cols-4 border-b border-outline-variant flex-shrink-0">
      {stats.map(s => (
        <div key={s.label} className="flex flex-col items-center py-2.5 px-1 border-r border-outline-variant last:border-r-0">
          <span className={`text-lg font-bold font-mono leading-none ${s.color}`}>{s.val}</span>
          <span className="text-[8px] text-text-m mt-1 text-center leading-tight">{s.label}</span>
        </div>
      ))}
    </div>
  )
}
