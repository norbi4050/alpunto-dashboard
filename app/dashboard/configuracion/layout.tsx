import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getRole } from '@/lib/auth'

export default async function ConfiguracionLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  let user
  try {
    const { data } = await supabase.auth.getUser()
    user = data.user
  } catch {
    redirect('/login')
  }
  if (!user) redirect('/login')
  if (getRole(user.user_metadata) !== 'dueno') redirect('/dashboard')
  return <>{children}</>
}
