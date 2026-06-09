import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { responderHandoff } from '@/lib/n8n'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  let body: { telefono?: unknown; mensaje?: unknown; cerrar?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }
  const { telefono, mensaje, cerrar } = body
  if (!telefono || typeof telefono !== 'string' || !mensaje || typeof mensaje !== 'string') {
    return NextResponse.json({ error: 'telefono y mensaje son requeridos' }, { status: 400 })
  }
  try {
    const data = await responderHandoff({ telefono, mensaje, cerrar: cerrar === true })
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Error al enviar' }, { status: 500 })
  }
}
