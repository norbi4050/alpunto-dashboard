// POST /api/turnos/cancelar
// Cancela un turno directamente en Supabase (sin pasar por n8n).
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  let body: { turno_id?: unknown }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }
  const { turno_id } = body
  if (!turno_id || typeof turno_id !== 'string') {
    return NextResponse.json({ error: 'turno_id requerido' }, { status: 400 })
  }

  const { error } = await supabase
    .from('turnos')
    .update({ estado: 'cancelado', updated_at: new Date().toISOString() })
    .eq('id', turno_id)

  if (error) return NextResponse.json({ error: 'Error al cancelar' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
