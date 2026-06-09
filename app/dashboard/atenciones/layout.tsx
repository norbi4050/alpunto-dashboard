// Gate de acceso: los barberos no ven atenciones (handoffs de clientes)
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getRole, canAccess } from '@/lib/auth'

export default async function AtencionesLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  if (!canAccess(getRole(user.user_metadata), 'atenciones')) redirect('/dashboard')
  return <>{children}</>
}
