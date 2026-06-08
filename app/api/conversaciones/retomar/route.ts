// app/api/conversaciones/retomar/route.ts
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { getRole, canAccess } from '@/lib/auth'

export async function POST(req: Request) {
  const supabaseAdmin = createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (!canAccess(getRole(user.user_metadata), 'conversaciones')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: { telefono?: unknown }
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }) }

  const { telefono } = body
  if (!telefono || typeof telefono !== 'string') {
    return NextResponse.json({ error: 'telefono requerido' }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from('conversaciones')
    .update({ handoff_humano: true })
    .eq('telefono', telefono)

  if (error) return NextResponse.json({ error: 'Error al activar handoff' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
