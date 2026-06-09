// POST /api/atenciones/responder
// Envía mensaje WhatsApp y opcionalmente cierra el handoff.
// Delega a Barber-DASH-1 en n8n (que ya tiene las credenciales Meta).
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  let body: { telefono?: unknown; mensaje?: unknown; cerrar?: unknown }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }
  const { telefono, mensaje, cerrar } = body
  if (!telefono || typeof telefono !== 'string' || !mensaje || typeof mensaje !== 'string') {
    return NextResponse.json({ error: 'telefono y mensaje son requeridos' }, { status: 400 })
  }

  const base = process.env.N8N_WEBHOOK_BASE!
  const key  = process.env.N8N_DASHBOARD_KEY!

  const res = await fetch(`${base}/webhook/barber-dash-responder`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ telefono, mensaje, cerrar: cerrar === true, _key: key }),
    cache: 'no-store' as RequestCache,
  })

  if (!res.ok) {
    const err = await res.text().catch(() => '')
    return NextResponse.json({ error: `Error al enviar: ${err.slice(0, 200)}` }, { status: 502 })
  }

  const data = await res.json().catch(() => ({ ok: true }))
  if (!data.ok) return NextResponse.json({ error: data.error ?? 'Error desconocido' }, { status: 502 })
  return NextResponse.json({ ok: true })
}
