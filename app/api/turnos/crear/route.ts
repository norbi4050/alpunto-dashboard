import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

export const dynamic = 'force-dynamic'

const WA_PHONE_ID = process.env.META_PHONE_NUMBER_ID ?? ''
const WA_PHONE_RE = /^549\d{10}$/

export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  let body: Record<string, unknown>
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const { nombre, whatsapp, barbero_id, servicio, fecha_hora } = body as Record<string, string>

  if (!nombre || !whatsapp || !barbero_id || !fecha_hora) {
    return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
  }
  if (!WA_PHONE_RE.test(whatsapp)) {
    return NextResponse.json({ error: 'Teléfono inválido. Formato: 549 + código de área + número (ej: 5493755123456)' }, { status: 400 })
  }

  // 1. Upsert cliente
  const { data: existing } = await supabase
    .from('clientes')
    .select('id')
    .eq('whatsapp', whatsapp)
    .maybeSingle()

  let cliente_id: string
  if (existing) {
    cliente_id = existing.id
    await supabase.from('clientes').update({ nombre }).eq('id', cliente_id)
  } else {
    const { data: nuevo, error } = await supabase
      .from('clientes')
      .insert({ nombre, whatsapp })
      .select('id')
      .single()
    if (error || !nuevo) return NextResponse.json({ error: 'Error al crear cliente' }, { status: 500 })
    cliente_id = nuevo.id
  }

  // 2. Crear turno
  const { data: turno, error: turnoErr } = await supabase
    .from('turnos')
    .insert({ cliente_id, barbero_id, servicio: servicio ?? '', fecha_hora, estado: 'agendado' })
    .select('id')
    .single()

  if (turnoErr || !turno) {
    return NextResponse.json({ error: 'Error al crear turno' }, { status: 500 })
  }

  // 3. WhatsApp de confirmación
  const waToken = process.env.META_WHATSAPP_TOKEN
  if (waToken && WA_PHONE_ID) {
    try {
      const { data: barbero } = await supabase.from('barberos').select('nombre').eq('id', barbero_id).single()
      const dt = new Date(fecha_hora)
      const fecha = format(dt, "EEEE d 'de' MMMM", { locale: es })
      const hora = format(dt, 'HH:mm')

      await fetch(`https://graph.facebook.com/v21.0/${WA_PHONE_ID}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${waToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messaging_product: 'whatsapp', to: whatsapp, type: 'template',
          template: {
            name: 'confirmacion_turno_v1', language: { code: 'es_AR' },
            components: [{ type: 'body', parameters: [
              { type: 'text', text: nombre },
              { type: 'text', text: servicio ?? '' },
              { type: 'text', text: fecha },
              { type: 'text', text: hora },
              { type: 'text', text: barbero?.nombre ?? '' },
            ]}],
          },
        }),
      })
    } catch { /* turno creado, WA falla silenciosamente */ }
  }

  return NextResponse.json({ ok: true, turno_id: turno.id, wa_sent: !!waToken })
}
