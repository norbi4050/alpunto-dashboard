import { NextResponse } from 'next/server'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { getRole, canAccess } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const phoneNumberId = process.env.META_WA_PHONE_NUMBER_ID
const metaToken = process.env.META_WHATSAPP_TOKEN

async function callMetaBlockApi(method: 'POST' | 'DELETE', waId: string) {
  if (!phoneNumberId || !metaToken) return { ok: false, error: 'Meta env vars no configurados' }
  const res = await fetch(`https://graph.facebook.com/v20.0/${phoneNumberId}/block_users`, {
    method,
    headers: { Authorization: `Bearer ${metaToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', block_users: [{ user: waId }] }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    return { ok: false, error: (body as { error?: { message?: string } }).error?.message ?? `Meta HTTP ${res.status}` }
  }
  return { ok: true }
}

function adminClient() {
  return createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function getAuthedUser() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

// POST /api/bloquear — bloquea un número
export async function POST(req: Request) {
  const user = await getAuthedUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const role = getRole(user.user_metadata)
  if (!canAccess(role, 'conversaciones')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: { telefono?: unknown; motivo?: unknown }
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }) }

  const { telefono, motivo } = body
  if (!telefono || typeof telefono !== 'string') {
    return NextResponse.json({ error: 'telefono requerido' }, { status: 400 })
  }

  const metaResult = await callMetaBlockApi('POST', telefono)

  const supabase = adminClient()
  await supabase.from('bloqueados').upsert({
    telefono,
    motivo: typeof motivo === 'string' ? motivo : null,
    bloqueado_por: user.email ?? role,
    created_at: new Date().toISOString(),
  }, { onConflict: 'telefono' })

  if (!metaResult.ok) {
    return NextResponse.json({
      ok: true,
      warning: `Guardado localmente pero Meta API falló: ${metaResult.error}. Configurá META_WA_PHONE_NUMBER_ID y META_WHATSAPP_TOKEN en EasyPanel.`,
    })
  }
  return NextResponse.json({ ok: true })
}

// DELETE /api/bloquear — desbloquea un número (body: { telefono })
export async function DELETE(req: Request) {
  const user = await getAuthedUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const role = getRole(user.user_metadata)
  if (!canAccess(role, 'conversaciones')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: { telefono?: unknown }
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }) }

  const { telefono } = body
  if (!telefono || typeof telefono !== 'string') {
    return NextResponse.json({ error: 'telefono requerido' }, { status: 400 })
  }

  await callMetaBlockApi('DELETE', telefono)

  const supabase = adminClient()
  await supabase.from('bloqueados').delete().eq('telefono', telefono)

  return NextResponse.json({ ok: true })
}

// GET /api/bloquear — lista números bloqueados (solo dueno)
export async function GET() {
  const user = await getAuthedUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (getRole(user.user_metadata) !== 'dueno') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const supabase = adminClient()
  const { data } = await supabase
    .from('bloqueados')
    .select('*')
    .order('created_at', { ascending: false })

  return NextResponse.json({ bloqueados: data ?? [] })
}
