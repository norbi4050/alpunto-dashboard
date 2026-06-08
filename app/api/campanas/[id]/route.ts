import { createClient } from '@/lib/supabase/server'
import { getRole } from '@/lib/auth'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (getRole(user.user_metadata) !== 'dueno') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: campana } = await supabase
    .from('campanas')
    .select('*')
    .eq('id', params.id)
    .single()

  if (!campana) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })

  const { count: respondieron } = await supabase
    .from('consultorio_campana_envios')
    .select('*', { count: 'exact', head: true })
    .eq('campana_id', params.id)
    .eq('estado', 'respondio')

  return NextResponse.json({ campana: { ...campana, total_respondieron: respondieron ?? 0 } })
}
