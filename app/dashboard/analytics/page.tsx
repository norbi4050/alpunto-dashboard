import { createClient } from '@/lib/supabase/server'
import { getRole } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { Topbar } from '@/components/layout/topbar'
import { BarChart } from '@/components/analytics/bar-chart'
import { startOfMonth, endOfMonth, subDays, format } from 'date-fns'
import { es } from 'date-fns/locale'

export default async function AnalyticsPage() {
  const supabase = createClient()
  let user
  try {
    const { data } = await supabase.auth.getUser()
    user = data.user
  } catch {
    redirect('/login')
  }
  if (!user) redirect('/login')
  if (getRole(user!.user_metadata) === 'barbero') redirect('/dashboard')

  const ahora = new Date()
  const desde = startOfMonth(ahora)
  const hasta = endOfMonth(ahora)

  const [turnosResult, clientesResult, turnosBarberoResult, configResult] = await Promise.all([
    supabase.from('turnos')
      .select('id, estado, fecha_hora, barbero_id, barberos(nombre)')
      .gte('fecha_hora', desde.toISOString())
      .lte('fecha_hora', hasta.toISOString()),
    supabase.from('clientes').select('id', { count: 'exact', head: true })
      .gte('created_at', desde.toISOString()),
    supabase.from('turnos')
      .select('barbero_id, barberos(nombre)')
      .gte('fecha_hora', desde.toISOString())
      .lte('fecha_hora', hasta.toISOString())
      .not('estado', 'in', '("cancelado","auto_cancelado")'),
    supabase.from('config').select('clave, valor').in('clave', ['barberia_valor_corte', 'barberia_costo_mensual']),
  ])

  const ts = turnosResult.data ?? []
  const total = ts.length
  const cancelados = ts.filter(t => t.estado === 'cancelado' || t.estado === 'auto_cancelado').length
  const asistidos = ts.filter(t => t.estado === 'asistido').length
  const confirmados = ts.filter(t => t.estado === 'confirmado').length
  const cancelRate = total > 0 ? Math.round((cancelados / total) * 100 * 10) / 10 : 0
  const clientesNuevos = clientesResult.count ?? 0

  const cfgMap = Object.fromEntries((configResult.data ?? []).map(r => [r.clave, r.valor]))
  const valorCorte = parseInt(cfgMap.barberia_valor_corte ?? '14000')
  const costoMensual = parseInt(cfgMap.barberia_costo_mensual ?? '50000')
  const ingresoEst = asistidos * valorCorte
  const roi = costoMensual > 0 ? Math.round(ingresoEst / costoMensual) : 0

  // Turnos por semana
  const semanas = [0, 1, 2, 3].map(i => {
    const fin = subDays(hasta, i * 7)
    const ini = subDays(fin, 7)
    const weekTs = ts.filter(t => new Date(t.fecha_hora) >= ini && new Date(t.fecha_hora) < fin)
    return { semana: `Sem ${4 - i}`, total: weekTs.length }
  }).reverse()

  // Turnos por barbero
  type BarberoCount = { nombre: string; count: number }
  const barberoMap: Record<string, BarberoCount> = {}
  for (const t of turnosBarberoResult.data ?? []) {
    const nombre = (Array.isArray(t.barberos) ? t.barberos[0]?.nombre : (t.barberos as { nombre: string } | null)?.nombre) ?? t.barbero_id
    if (!barberoMap[t.barbero_id]) barberoMap[t.barbero_id] = { nombre, count: 0 }
    barberoMap[t.barbero_id].count++
  }
  const porBarbero = Object.values(barberoMap).sort((a, b) => b.count - a.count)

  const titleDate = format(desde, "MMMM yyyy", { locale: es })

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Topbar title="Reportes" subtitle={`${titleDate} · Datos en tiempo real`} />
      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">

        {/* ROI Hero */}
        <div className="relative bg-surface-card border border-border-primary rounded-2xl p-6 overflow-visible">
          <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full opacity-20 blur-3xl" style={{ background: 'var(--primary)' }} />
          <p className="text-[10px] font-semibold text-stitch-primary uppercase tracking-widest mb-1">Impacto Financiero</p>
          <p className="text-sm text-text-s mb-4">Ingreso estimado vs costo mensual del sistema</p>
          <div className="flex items-end gap-6">
            <div className="bg-surface-container-low rounded-xl px-6 py-3 relative z-10">
              <span className="text-5xl font-bold font-mono text-stitch-secondary">{roi}×</span>
            </div>
            <div className="flex flex-col gap-1 text-xs text-text-s relative z-10">
              <span><span className="font-semibold text-text-p">{asistidos}</span> atendidos × ${valorCorte.toLocaleString('es-AR')}</span>
              <span>÷ ${costoMensual.toLocaleString('es-AR')} mensual</span>
              <span className="text-ss-text font-semibold mt-1">Ingreso estimado: ${ingresoEst.toLocaleString('es-AR')}</span>
            </div>
          </div>
        </div>

        {/* 4 métricas clave */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Tasa de cancelación', value: `${cancelRate}%`, sub: 'Este mes', color: 'text-sw-text' },
            { label: 'Turnos confirmados', value: confirmados, sub: 'Sin intervención humana', color: 'text-si-text' },
            { label: 'Turnos asistidos', value: asistidos, sub: 'Completados', color: 'text-ss-text' },
            { label: 'Clientes nuevos', value: clientesNuevos, sub: 'Este mes', color: 'text-text-p' },
          ].map(m => (
            <div key={m.label} className="bg-surface-card border border-outline-variant rounded-xl p-4">
              <p className="text-[10px] text-text-m font-medium leading-tight mb-2">{m.label}</p>
              <p className={`text-2xl font-bold font-mono ${m.color}`}>{m.value}</p>
              <p className="text-[10px] text-text-m mt-1">{m.sub}</p>
            </div>
          ))}
        </div>

        {/* Bar charts */}
        <div className="grid grid-cols-2 gap-4">
          <BarChart
            title="Turnos por semana"
            bars={semanas.map(s => ({ label: s.semana, value: s.total, color: 'bg-si-text' }))}
          />
          <BarChart
            title="Turnos confirmados por barbero (este mes)"
            bars={porBarbero.map(b => ({ label: b.nombre.split(' ')[0], value: b.count, color: 'bg-ss-text' }))}
          />
        </div>

        {/* Resumen actividad bot */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Total turnos gestionados', val: total, sub: 'Por BarberBot' },
            { label: 'Cancelaciones', val: cancelados, sub: 'Auto o manual' },
            { label: 'Tiempo respuesta', val: '~3s', sub: 'vs. horas sin bot' },
            { label: 'Completaron el flujo', val: `${total > 0 ? Math.round(((confirmados + asistidos) / total) * 100) : 0}%`, sub: 'Del total iniciado' },
          ].map(s => (
            <div key={s.label} className="bg-surface-card border border-outline-variant rounded-xl p-4">
              <p className="text-[10px] text-text-m font-medium leading-tight">{s.label}</p>
              <p className="text-2xl font-bold font-mono text-text-p mt-1">{s.val}</p>
              <p className="text-[10px] text-text-m mt-0.5">{s.sub}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
