// app/dashboard/feedbacks/page.tsx
import { createClient } from '@/lib/supabase/server'
import { getRole } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { Topbar } from '@/components/layout/topbar'
import { FeedbacksClient } from './feedbacks-client'

export default async function FeedbacksPage() {
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

  const { data: feedbacks } = await supabase
    .from('feedbacks')
    .select(`
      id, telefono, calificacion, comentario, leido, created_at,
      turnos ( servicio, fecha_hora, barbero_id,
        barberos ( nombre )
      ),
      clientes ( nombre, whatsapp )
    `)
    .order('created_at', { ascending: false })
    .limit(100)

  const total     = feedbacks?.length ?? 0
  const conCalif  = feedbacks?.filter(f => f.calificacion != null) ?? []
  const promedio  = conCalif.length
    ? (conCalif.reduce((s, f) => s + (f.calificacion ?? 0), 0) / conCalif.length).toFixed(1)
    : null
  const noLeidos  = feedbacks?.filter(f => !f.leido).length ?? 0

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Topbar
        title="Reseñas y Feedback"
        subtitle={`${total} total · ${noLeidos} sin leer${promedio ? ` · ⭐ ${promedio} promedio` : ''}`}
      />
      <FeedbacksClient feedbacks={feedbacks ?? []} />
    </div>
  )
}
