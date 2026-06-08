import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  let body: { barbero_id?: unknown; fecha?: unknown; hora_inicio?: unknown; hora_fin?: unknown; motivo?: unknown }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const { barbero_id, fecha, hora_inicio, hora_fin, motivo } = body
  if (!barbero_id || !fecha) {
    return NextResponse.json({ error: 'barbero_id y fecha requeridos' }, { status: 400 })
  }

  const { data, error } = await supabase.from('bloqueos').insert({
    barbero_id,
    fecha,
    hora_inicio: hora_inicio ?? null,
    hora_fin: hora_fin ?? null,
    motivo: motivo ?? null,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
