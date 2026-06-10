import { createClient } from '@/lib/supabase/server'
import { getRole } from '@/lib/auth'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  // Lectura: dueño, admin y barbero pueden leer config (BotNivelBanner lo necesita)
  // Solo dueño puede modificar (PATCH abajo)

  const { data } = await supabase.from('config').select('clave, valor')
  return NextResponse.json({
    config: Object.fromEntries((data ?? []).map(r => [r.clave, r.valor]))
  })
}

export async function PATCH(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const patchRole = getRole(user.user_metadata)
  if (patchRole !== 'dueno' && patchRole !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const updates: Record<string, string> = await req.json()
  for (const [clave, valor] of Object.entries(updates)) {
    await supabase
      .from('config')
      .upsert({ clave, valor, updated_at: new Date().toISOString() }, { onConflict: 'clave' })
  }
  return NextResponse.json({ ok: true })
}
