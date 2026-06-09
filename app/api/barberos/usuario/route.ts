// POST: crea (o actualiza la contraseña de) el usuario de dashboard de un barbero.
// DELETE: revoca el acceso. Solo dueño/admin. Usa la Admin API de Supabase (service role).
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { getRole } from '@/lib/auth'

export const dynamic = 'force-dynamic'

function adminClient() {
  return createSupabaseClient(
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

async function requireGestor() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'No autorizado' }, { status: 401 }) }
  const role = getRole(user.user_metadata)
  if (role !== 'dueno' && role !== 'admin') {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  return { supabase }
}

export async function POST(req: Request) {
  const gate = await requireGestor()
  if ('error' in gate) return gate.error
  const { supabase } = gate

  let body: { barbero_id?: unknown; email?: unknown; password?: unknown }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }) }

  const barberoId = typeof body.barbero_id === 'string' ? body.barbero_id : ''
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const password = typeof body.password === 'string' ? body.password : ''

  if (!barberoId || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'La contraseña debe tener al menos 8 caracteres' }, { status: 400 })
  }

  const { data: barbero } = await supabase
    .from('barberos').select('id, nombre, es_dueno, auth_email').eq('id', barberoId).single()
  if (!barbero) return NextResponse.json({ error: 'Barbero no encontrado' }, { status: 404 })
  if (barbero.es_dueno) return NextResponse.json({ error: 'El dueño ya tiene su propio acceso' }, { status: 400 })

  const admin = adminClient()

  // ¿Existe ya un usuario con este email?
  const { data: usersPage, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (listErr) return NextResponse.json({ error: 'Error consultando usuarios' }, { status: 500 })
  const existente = usersPage.users.find(u => u.email?.toLowerCase() === email)

  if (existente) {
    // Solo se puede reutilizar si ya pertenece a este mismo barbero
    if (existente.user_metadata?.barbero_id !== barberoId) {
      return NextResponse.json({ error: 'Ese email ya está en uso por otro usuario' }, { status: 409 })
    }
    const { error: updErr } = await admin.auth.admin.updateUserById(existente.id, { password })
    if (updErr) return NextResponse.json({ error: 'No se pudo actualizar la contraseña' }, { status: 500 })
  } else {
    const { error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role: 'barbero', barbero_id: barberoId, nombre: barbero.nombre },
    })
    if (createErr) return NextResponse.json({ error: createErr.message }, { status: 500 })
  }

  await supabase.from('barberos').update({ auth_email: email }).eq('id', barberoId)
  return NextResponse.json({ ok: true, accion: existente ? 'password_actualizada' : 'usuario_creado' })
}

export async function DELETE(req: Request) {
  const gate = await requireGestor()
  if ('error' in gate) return gate.error
  const { supabase } = gate

  let body: { barbero_id?: unknown }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }) }
  const barberoId = typeof body.barbero_id === 'string' ? body.barbero_id : ''
  if (!barberoId) return NextResponse.json({ error: 'barbero_id requerido' }, { status: 400 })

  const { data: barbero } = await supabase
    .from('barberos').select('id, auth_email').eq('id', barberoId).single()
  if (!barbero?.auth_email) return NextResponse.json({ error: 'Este barbero no tiene acceso' }, { status: 404 })

  const admin = adminClient()
  const { data: usersPage } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const user = usersPage?.users.find(u => u.email?.toLowerCase() === barbero.auth_email!.toLowerCase())
  if (user) await admin.auth.admin.deleteUser(user.id)

  await supabase.from('barberos').update({ auth_email: null }).eq('id', barberoId)
  return NextResponse.json({ ok: true })
}
