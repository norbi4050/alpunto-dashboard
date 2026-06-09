// app/dashboard/clientes/page.tsx
import { createClient } from '@/lib/supabase/server'
import { getRole } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { Topbar } from '@/components/layout/topbar'
import type { Cliente } from '@/lib/types'

function calcFrecuencia(fechas: string[]): number | null {
  if (fechas.length < 2) return null
  const sorted = [...fechas].sort()
  let totalDias = 0
  for (let i = 1; i < sorted.length; i++) {
    const diff = (new Date(sorted[i]).getTime() - new Date(sorted[i - 1]).getTime()) / 86_400_000
    totalDias += diff
  }
  return Math.round(totalDias / (sorted.length - 1))
}

export default async function ClientesPage() {
  const supabase = createClient()
  let user
  try {
    const { data } = await supabase.auth.getUser()
    user = data.user
  } catch {
    redirect('/login')
  }
  if (!user) redirect('/login')
  if (getRole(user.user_metadata) === 'barbero') redirect('/dashboard')

  const [clientesRes, turnosRes] = await Promise.all([
    supabase
      .from('clientes')
      .select('id, nombre, whatsapp, opt_in_promo, visitas, ultima_visita, created_at')
      .order('nombre', { ascending: true }),
    supabase
      .from('turnos')
      .select('cliente_id, fecha_hora')
      .eq('estado', 'asistido')
      .order('fecha_hora', { ascending: true }),
  ])

  const lista = (clientesRes.data ?? []) as Cliente[]

  // Agrupar fechas asistidas por cliente
  const visitasPorCliente: Record<string, string[]> = {}
  for (const t of turnosRes.data ?? []) {
    if (!t.cliente_id) continue
    if (!visitasPorCliente[t.cliente_id]) visitasPorCliente[t.cliente_id] = []
    visitasPorCliente[t.cliente_id].push(t.fecha_hora)
  }

  const hoy = new Date()

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Topbar title="Clientes" subtitle={`${lista.length} cliente${lista.length !== 1 ? 's' : ''} registrado${lista.length !== 1 ? 's' : ''}`} />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="bg-surface-card border border-outline-variant rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-outline-variant">
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-text-m uppercase tracking-wide">Nombre</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-text-m uppercase tracking-wide">WhatsApp</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-text-m uppercase tracking-wide">Visitas</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-text-m uppercase tracking-wide">Última visita</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-text-m uppercase tracking-wide">Frecuencia</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-text-m uppercase tracking-wide">Próx. estimada</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-text-m uppercase tracking-wide">Promos</th>
              </tr>
            </thead>
            <tbody>
              {lista.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-[12px] text-text-m">Sin clientes registrados.</td>
                </tr>
              ) : lista.map((c, i) => {
                const fechas = visitasPorCliente[c.id] ?? []
                const frecDias = calcFrecuencia(fechas)
                let proximaEst: Date | null = null
                if (frecDias && c.ultima_visita) {
                  proximaEst = new Date(new Date(c.ultima_visita).getTime() + frecDias * 86_400_000)
                }
                const proximaVencida = proximaEst && proximaEst < hoy

                return (
                  <tr key={c.id} className={`border-b border-outline-variant/50 hover:bg-surface-container transition-colors ${i % 2 === 0 ? '' : 'bg-surface-container/30'}`}>
                    <td className="px-4 py-3 text-[12px] font-semibold text-text-p">{c.nombre}</td>
                    <td className="px-4 py-3 text-[12px] text-text-s font-mono">{c.whatsapp}</td>
                    <td className="px-4 py-3 text-[12px] text-text-s">{c.visitas ?? 0}</td>
                    <td className="px-4 py-3 text-[12px] text-text-s">
                      {c.ultima_visita
                        ? new Date(c.ultima_visita).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-[12px] text-text-s">
                      {frecDias
                        ? <span className="text-si-text font-semibold">~{frecDias}d</span>
                        : <span className="text-text-m">—</span>}
                    </td>
                    <td className="px-4 py-3 text-[12px]">
                      {proximaEst
                        ? <span className={proximaVencida ? 'text-sw-text font-semibold' : 'text-text-s'}>
                            {proximaEst.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                            {proximaVencida && ' ⚠'}
                          </span>
                        : <span className="text-text-m">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                        c.opt_in_promo
                          ? 'bg-ss-bg text-ss-text border border-border-success'
                          : 'bg-surface-container text-text-m border border-outline-variant'
                      }`}>
                        {c.opt_in_promo ? 'Sí' : 'No'}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Leyenda */}
        <div className="mt-3 flex items-center gap-4">
          <p className="text-[10px] text-text-m">
            <span className="text-si-text font-semibold">~Nd</span> = promedio de días entre visitas
          </p>
          <p className="text-[10px] text-text-m">
            <span className="text-sw-text font-semibold">⚠</span> = próxima visita estimada ya pasó — candidato para promo
          </p>
        </div>
      </div>
    </div>
  )
}
