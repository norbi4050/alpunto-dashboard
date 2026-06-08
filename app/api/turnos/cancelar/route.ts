import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { cancelarTurno } from '@/lib/n8n'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  let body: { turno_id?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }
  const { turno_id } = body
  if (!turno_id || typeof turno_id !== 'string') {
    return NextResponse.json({ error: 'turno_id requerido' }, { status: 400 })
  }
  try {
    const data = await cancelarTurno(turno_id)
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Error al cancelar' }, { status: 500 })
  }
}
