// app/dashboard/conversaciones/page.tsx
import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getRole, canAccess } from '@/lib/auth'
import { ConversacionesPageClient } from './conversaciones-client'

export default async function ConversacionesPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const role = getRole(user.user_metadata)
  if (!canAccess(role, 'conversaciones')) redirect('/dashboard')

  return (
    <Suspense fallback={null}>
      <ConversacionesPageClient role={role} />
    </Suspense>
  )
}
