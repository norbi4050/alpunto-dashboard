// app/dashboard/page.tsx
import { createClient } from '@/lib/supabase/server'
import { getRole } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { Topbar } from '@/components/layout/topbar'
import { TurnosTable } from '@/components/turnos/turnos-table'
import type { Turno } from '@/lib/types'

async function getAtencionesPendientes(supabase: ReturnType<typeof createClient>) {
  const { count } = await supabase
    .from('conversaciones')
    .select('*', { count: 'exact', head: true })
    .eq('handoff_humano', true)
  return count ?? 0
}

export default async function HoyPage() {
  const supabase = createClient()
  let user
  try {
    const { data } = await supabase.auth.getUser()
    user = data.user
  } catch {
    redirect('/login')
  }
  if (!user) redirect('/login')

  const role = getRole(user!.user_metadata)

  const hoyStart = new Date(); hoyStart.setHours(0, 0, 0, 0)
  const hoyEnd = new Date(); hoyEnd.setHours(23, 59, 59, 999)

  const { data: turnos } = await supabase
    .from('turnos')
    .select('*, clientes(nombre,whatsapp), barberos(nombre,slot,color)')
    .gte('fecha_hora', hoyStart.toISOString())
    .lte('fecha_hora', hoyEnd.toISOString())
    .order('fecha_hora', { ascending: true })

  const turnosList = (turnos ?? []) as Turno[]

  const confirmados = turnosList.filter(t => t.estado === 'confirmado' || t.estado === 'asistido').length
  const pendientes = turnosList.filter(t => t.estado === 'agendado').length
  const cancelados = turnosList.filter(t => t.estado === 'cancelado' || t.estado === 'auto_cancelado').length
  const atenciones = await getAtencionesPendientes(supabase)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Topbar title="Turnos de hoy" subtitle={`${turnosList.length} turno${turnosList.length !== 1 ? 's' : ''} programado${turnosList.length !== 1 ? 's' : ''}`}>
        <div className="flex items-center gap-1.5 text-xs text-ss-text font-semibold">
          <span className="w-1.5 h-1.5 rounded-full bg-ss-text animate-pulse"></span>
          En vivo
        </div>
      </Topbar>

      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Confirmados',  val: confirmados, bgVar: '--status-success-bg', textClass: 'text-ss-text', borderClass: 'border-border-success', shadowClass: 'hover:shadow-glow-success' },
            { label: 'Pendientes',   val: pendientes,  bgVar: '--status-info-bg',    textClass: 'text-si-text', borderClass: 'border-border-primary', shadowClass: 'hover:shadow-glow-primary' },
            { label: 'Cancelados',   val: cancelados,  bgVar: '--status-error-bg',   textClass: 'text-se-text', borderClass: 'border-border-error',   shadowClass: 'hover:shadow-glow-error' },
            { label: 'En atención', val: atenciones,  bgVar: '--status-warning-bg', textClass: 'text-sw-text', borderClass: 'border-border-warning', shadowClass: 'hover:shadow-glow-warning' },
          ].map(s => (
            <div
              key={s.label}
              className={`group relative overflow-hidden bg-surface-card border rounded-xl p-4 transition-shadow ${s.borderClass} ${s.shadowClass}`}
            >
              <div
                className="absolute -top-4 -right-4 w-20 h-20 rounded-full opacity-30 blur-2xl transition-opacity group-hover:opacity-60"
                style={{ background: `var(${s.bgVar})` }}
              />
              <p className="text-[11px] text-text-m font-medium uppercase tracking-wide relative z-10">{s.label}</p>
              <p className={`text-3xl font-bold mt-1 font-mono relative z-10 ${s.textClass}`}>{String(s.val).padStart(2, '0')}</p>
            </div>
          ))}
        </div>

        <TurnosTable turnos={turnosList} canCreate={true} showLink={true} />
      </div>
    </div>
  )
}
