import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getRole } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const barberoId = searchParams.get('barbero_id')
  if (!barberoId) return NextResponse.json({ error: 'barbero_id requerido' }, { status: 400 })

  const { data, error } = await supabase
    .from('horarios_barbero')
    .select('id, dia_semana, hora_inicio, hora_fin')
    .eq('barbero_id', barberoId)
    .order('dia_semana')
    .order('hora_inicio')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ horarios: data ?? [] })
}

export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  let body: { barbero_id?: unknown; dia_semana?: unknown; hora_inicio?: unknown; hora_fin?: unknown }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }) }

  const { barbero_id, dia_semana, hora_inicio, hora_fin } = body
  if (!barbero_id || dia_semana === null || dia_semana === undefined || !hora_inicio || !hora_fin) {
    return NextResponse.json({ error: 'barbero_id, dia_semana, hora_inicio, hora_fin requeridos' }, { status: 400 })
  }
  if (String(hora_inicio) >= String(hora_fin)) {
    return NextResponse.json({ error: 'hora_inicio debe ser menor a hora_fin' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('horarios_barbero')
    .insert({ barbero_id, dia_semana, hora_inicio, hora_fin })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
