import { createClient } from '@/lib/supabase/server'
import { getRole, getBarberoId } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { Topbar } from '@/components/layout/topbar'
import { AgendaSelectorView } from '@/components/agenda/agenda-selector-view'
import { addDays, startOfDay, format } from 'date-fns'
import { es } from 'date-fns/locale'

export default async function SemanaPage() {
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
  const barberoId = role === 'barbero' ? getBarberoId(user!.user_metadata) : null

  const desde = startOfDay(new Date())
  const hasta = addDays(desde, 7)
  const subtitle = `${format(desde, "d 'de' MMM", { locale: es })} → ${format(hasta, "d 'de' MMM", { locale: es })}`

  const { data: barberos } = await supabase
    .from('barberos')
    .select('id, slot, nombre, color, activo')
    .eq('activo', true)
    .order('slot')

  // Rol barbero: solo ve su propia agenda
  const visibles = barberoId
    ? (barberos ?? []).filter(b => b.id === barberoId)
    : (barberos ?? [])

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Topbar title="Agenda semanal" subtitle={subtitle} />
      <div className="flex-1 overflow-y-auto p-4">
        <AgendaSelectorView barberos={visibles} />
      </div>
    </div>
  )
}
