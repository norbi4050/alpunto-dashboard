// POST /api/atenciones/responder
// Envía mensaje WhatsApp (vía Barber-DASH-1 en n8n) y cierra el handoff en Supabase.
// El cierre en Supabase ocurre SIEMPRE, aunque el envío de WA falle
// (cliente fuera de ventana 24h, etc.).
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

  // 1. Cerrar handoff en Supabase PRIMERO — esto siempre debe funcionar
  if (cerrar === true) {
    await supabase
      .from('conversaciones')
      .update({ handoff_humano: false, estado: 'inicio', updated_at: new Date().toISOString() })
      .eq('telefono', telefono)
  }

  // 2. Intentar enviar el mensaje WhatsApp (best-effort: si falla, la atención igual se cierra)
  const base = process.env.N8N_WEBHOOK_BASE
  const key  = process.env.N8N_DASHBOARD_KEY
  if (base && key) {
    try {
      await fetch(`${base}/webhook/barber-dash-responder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telefono, mensaje, cerrar: false, _key: key }),
        cache: 'no-store' as RequestCache,
        signal: AbortSignal.timeout(8000),
      })
    } catch {
      // Silencioso — el cierre ya ocurrió en paso 1
    }
  }

  return NextResponse.json({ ok: true })
}
