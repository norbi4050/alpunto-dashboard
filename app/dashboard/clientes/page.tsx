// app/dashboard/clientes/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Topbar } from '@/components/layout/topbar'
import type { Cliente } from '@/lib/types'

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

  const { data: clientes } = await supabase
    .from('clientes')
    .select('id, nombre, whatsapp, opt_in_promo, visitas, ultima_visita, created_at')
    .order('nombre', { ascending: true })

  const lista = (clientes ?? []) as Cliente[]

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
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-text-m uppercase tracking-wide">Promos</th>
              </tr>
            </thead>
            <tbody>
              {lista.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-[12px] text-text-m">Sin clientes registrados.</td>
                </tr>
              ) : lista.map((c, i) => (
                <tr key={c.id} className={`border-b border-outline-variant/50 hover:bg-surface-container transition-colors ${i % 2 === 0 ? '' : 'bg-surface-container/30'}`}>
                  <td className="px-4 py-3 text-[12px] font-semibold text-text-p">{c.nombre}</td>
                  <td className="px-4 py-3 text-[12px] text-text-s font-mono">{c.whatsapp}</td>
                  <td className="px-4 py-3 text-[12px] text-text-s">{c.visitas ?? 0}</td>
                  <td className="px-4 py-3 text-[12px] text-text-s">
                    {c.ultima_visita
                      ? new Date(c.ultima_visita).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })
                      : '—'}
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
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
