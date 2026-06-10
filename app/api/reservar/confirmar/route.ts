import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface Body {
  token?: string           // presente si viene de WhatsApp
  nombre: string
  telefono?: string        // requerido si no hay token
  cumpleanos?: string      // YYYY-MM-DD opcional
  barbero_id: string
  barbero_nombre: string
  fecha_hora: string       // ISO con offset -03:00
  servicio_id?: string
  servicio_nombre: string
  servicio_duracion: number
  servicio_precio?: number
}

export async function POST(req: NextRequest) {
  const body: Body = await req.json()
  const supabase = createClient()

  let telefono = body.telefono ?? ''
  let servicioId = body.servicio_id
  let servicioPrecio = body.servicio_precio

  // Si hay token: validar y extraer datos
  if (body.token) {
    const { data: tk } = await supabase
      .from('reserva_tokens').select('*').eq('token', body.token).single()
    if (!tk || tk.usado || new Date(tk.expires_at) < new Date())
      return NextResponse.json({ error: 'Token inválido o expirado' }, { status: 410 })
    telefono = tk.telefono
    servicioId = tk.servicio_id
    servicioPrecio = tk.servicio_precio
  }

  if (!telefono) return NextResponse.json({ error: 'Teléfono requerido' }, { status: 400 })

  // Upsert cliente
  const { data: clientes } = await supabase
    .from('clientes').select('id').eq('whatsapp', telefono).maybeSingle()

  if (clientes) {
    await supabase.from('clientes').update({
      nombre: body.nombre,
      ...(body.cumpleanos ? { fecha_nacimiento: body.cumpleanos } : {}),
      updated_at: new Date().toISOString(),
    }).eq('whatsapp', telefono)
  } else {
    await supabase.from('clientes').insert({
      nombre: body.nombre,
      whatsapp: telefono,
      ...(body.cumpleanos ? { fecha_nacimiento: body.cumpleanos } : {}),
    })
  }

  const { data: clienteRow } = await supabase
    .from('clientes').select('id').eq('whatsapp', telefono).single()

  // Crear turno
  const { data: turnoCreado, error: turnoErr } = await supabase
    .from('turnos').insert({
      cliente_id: clienteRow?.id,
      barbero_id: body.barbero_id,
      servicio: body.servicio_nombre,
      servicio_id: servicioId,
      precio: servicioPrecio,
      fecha_hora: body.fecha_hora,
      telefono,
      estado: 'agendado',
      origen: body.token ? 'bot_web' : 'web_directa',
    }).select('id').single()

  if (turnoErr || !turnoCreado)
    return NextResponse.json({ error: 'Error al crear el turno' }, { status: 500 })

  // Marcar token como usado
  if (body.token) {
    await supabase.from('reserva_tokens')
      .update({ usado: true, turno_id: turnoCreado.id })
      .eq('token', body.token)
    // Actualizar conversación en Supabase para retomar bot
    await supabase.from('conversaciones')
      .update({ estado: 'inicio', contexto: {} })
      .eq('telefono', telefono)
  }

  // Enviar confirmación por WhatsApp
  try {
    await enviarConfirmacionWA(telefono, body.nombre, body.fecha_hora, body.servicio_nombre, body.barbero_nombre)
  } catch { /* no bloquear si WA falla */ }

  // Upsell de productos (no bloqueante)
  try {
    const { data: productos } = await supabase
      .from('productos').select('id,nombre,precio').eq('activo', true).order('orden').limit(3)
    if (productos?.length) {
      await enviarUpsellWA(telefono, turnoCreado.id, productos)
    }
  } catch { /* upsell es opcional */ }

  return NextResponse.json({ ok: true, turno_id: turnoCreado.id })
}

function fmtPrecio(n: number) {
  return '$' + String(Math.round(n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

async function enviarUpsellWA(
  telefono: string, turnoId: string,
  productos: { id: string; nombre: string; precio: number }[]
) {
  const token = process.env.META_SYSTEM_USER_TOKEN
  const phoneId = process.env.META_PHONE_NUMBER_ID
  if (!token || !phoneId) return

  const listado = productos.map(p => `• ${p.nombre} — ${fmtPrecio(p.precio)}`).join('\n')
  const buttons = [
    ...productos.slice(0, 2).map(p => ({
      type: 'reply', reply: { id: `prod_${p.id}`, title: p.nombre.slice(0, 20) }
    })),
    { type: 'reply', reply: { id: 'prod_no', title: '❌ No, gracias' } }
  ]

  await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: telefono.replace(/\D/g, ''),
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: `🧴 *¿Te llevás algo para casa?*\n\n${listado}` },
        action: { buttons }
      }
    }),
  })
}

async function enviarConfirmacionWA(
  telefono: string, nombre: string, fechaHora: string,
  servicio: string, barbero: string
) {
  const token = process.env.META_SYSTEM_USER_TOKEN
  const phoneId = process.env.META_PHONE_NUMBER_ID
  if (!token || !phoneId) return

  const d = new Date(fechaHora)
  const art = new Date(d.getTime() - 3 * 60 * 60 * 1000)
  const dias = ['dom','lun','mar','mié','jue','vie','sáb']
  const meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
  const fechaStr = `${dias[art.getUTCDay()]} ${art.getUTCDate()} ${meses[art.getUTCMonth()]}`
  const horaStr = `${String(art.getUTCHours()).padStart(2,'0')}:${String(art.getUTCMinutes()).padStart(2,'0')}`

  const msg = `✅ ¡Turno confirmado, ${nombre}!\n\n📅 ${fechaStr} a las ${horaStr}\n✂️ ${servicio} con ${barbero}\n\nTe esperamos en AlPunto. ¡Cualquier cambio escribinos! 💈`

  await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: telefono.replace(/\D/g, ''),
      type: 'text',
      text: { body: msg },
    }),
  })
}
