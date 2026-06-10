import { createClient } from '@/lib/supabase/server'
import { getRole } from '@/lib/auth'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if ((getRole(user.user_metadata) !== 'dueno' && getRole(user.user_metadata) !== 'admin')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { campana_id } = await req.json()
  if (!campana_id) return NextResponse.json({ error: 'campana_id requerido' }, { status: 400 })

  await supabase.from('campanas').update({ estado: 'enviando' }).eq('id', campana_id)

  const webhookUrl = process.env.N8N_CAMPANAS_WEBHOOK_URL
  if (!webhookUrl) return NextResponse.json({ error: 'N8N_CAMPANAS_WEBHOOK_URL not configured' }, { status: 500 })

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Dashboard-Key': process.env.DASHBOARD_SECRET_KEY ?? '',
      },
      body: JSON.stringify({ campana_id }),
    })
    if (!res.ok) throw new Error(`n8n returned ${res.status}`)
  } catch {
    await supabase.from('campanas').update({ estado: 'borrador' }).eq('id', campana_id)
    return NextResponse.json({ error: 'Error al disparar campaña' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
