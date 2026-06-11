import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface Body {
  token?: string            // presente si viene de WhatsApp
  nombre: string            // nombre del que va (propio o el de otro)
  telefono?: string         // teléfono del que va (propio o el de otro)
  cumpleanos?: string       // YYYY-MM-DD — solo si es para sí mismo
  para_otro?: boolean       // true cuando reserva para otra persona
  barbero_id: string
  barbero_nombre: string
  fecha_hora: string        // ISO con offset -03:00
  servicio_id?: string
  servicio_nombre: string
  servicio_duracion: number
  servicio_precio?: number
}

// Normaliza teléfono argentino al formato internacional que usa WhatsApp (549XXXXXXXXXX)
// Cubre los casos más comunes de entrada manual:
//   3755414064   → 5493755414064  (10 dígitos, interior)
//   03755414064  → 5493755414064  (con 0 local)
//   9113755414064→ 549...         (ya con 549)
function normalizarTelAR(tel: string): string {
  const d = tel.replace(/\D/g, '')
  if (!d) return d
  if (d.startsWith('549')) return d                              // ya completo
  if (d.startsWith('54'))  return `549${d.slice(2)}`            // falta el 9 móvil
  if (d.startsWith('0'))   return `549${d.slice(1)}`            // 0XXXXXXXXXX
  if (d.length === 10)     return `549${d}`                     // área + número
  return d
}

export async function POST(req: NextRequest) {
  const body: Body = await req.json()
  const supabase = createClient()

  let telefonoToken = ''   // teléfono del solicitante original (token holder)
  let servicioId = body.servicio_id
  let servicioPrecio = body.servicio_precio

  // Si hay token: validar y extraer teléfono del holder
  if (body.token) {
    // Bypass para testing local — no toca Supabase ni envía WA
    if (body.token === 'DEV_TEST') {
      return NextResponse.json({ ok: true, turno_id: 'dev-test-turno-id' })
    }

    const { data: tk } = await supabase
      .from('reserva_tokens').select('*').eq('token', body.token).single()
    if (!tk || tk.usado || new Date(tk.expires_at) < new Date())
      return NextResponse.json({ error: 'Token inválido o expirado' }, { status: 410 })
    telefonoToken = tk.telefono
    servicioId = tk.servicio_id
    servicioPrecio = tk.servicio_precio
  }

  // Teléfono para el turno y para enviar el WA:
  // - "para mí" con token       → teléfono del token
  // - "para mí" directo         → body.telefono normalizado al formato WA (549XXXXXXXXXX)
  // - "para otro" con teléfono  → body.telefono normalizado
  // - "para otro" sin teléfono  → teléfono del token (notificamos al solicitante)
  const telefonoNorm = body.telefono ? normalizarTelAR(body.telefono) : undefined
  const telefonoTurno = telefonoNorm ?? telefonoToken
  const telefonoNotif = telefonoNorm ?? telefonoToken   // a quien mandamos WA

  if (!telefonoTurno)
    return NextResponse.json({ error: 'Teléfono requerido' }, { status: 400 })

  // Upsert del cliente que va a cortarse
  const { data: clienteExistente } = await supabase
    .from('clientes').select('id').eq('whatsapp', telefonoTurno).maybeSingle()

  if (clienteExistente) {
    // Solo actualizar nombre si es para sí mismo (evita pisar datos del titular)
    if (!body.para_otro) {
      await supabase.from('clientes').update({
        nombre: body.nombre,
        ...(body.cumpleanos ? { fecha_nacimiento: body.cumpleanos } : {}),
        updated_at: new Date().toISOString(),
      }).eq('whatsapp', telefonoTurno)
    }
    // Si es para otro: actualizar su nombre con el que ingresó
    else if (body.telefono) {
      await supabase.from('clientes').update({
        nombre: body.nombre,
        updated_at: new Date().toISOString(),
      }).eq('whatsapp', telefonoTurno)
    }
  } else {
    // Cliente nuevo (el "otro" si tiene teléfono, o el directo)
    await supabase.from('clientes').insert({
      nombre: body.nombre,
      whatsapp: telefonoTurno,
      ...(body.cumpleanos && !body.para_otro ? { fecha_nacimiento: body.cumpleanos } : {}),
    })
  }

  const { data: clienteRow } = await supabase
    .from('clientes').select('id').eq('whatsapp', telefonoTurno).single()

  // Crear turno
  const { data: turnoCreado, error: turnoErr } = await supabase
    .from('turnos').insert({
      cliente_id: clienteRow?.id,
      barbero_id: body.barbero_id,
      servicio: body.servicio_nombre,
      duracion_min: body.servicio_duracion,
      precio: servicioPrecio,
      fecha_hora: body.fecha_hora,
      telefono: telefonoTurno,
      estado: 'agendado',
      canal: body.token ? 'whatsapp' : 'web',
      origen: body.token ? 'bot_web' : 'web_directa',
    }).select('id').single()

  if (turnoErr || !turnoCreado)
    return NextResponse.json({ error: 'Error al crear el turno' }, { status: 500 })

  // Marcar token como usado y resetear conversación del holder
  if (body.token) {
    await supabase.from('reserva_tokens')
      .update({ usado: true, turno_id: turnoCreado.id })
      .eq('token', body.token)
    await supabase.from('conversaciones')
      .update({ estado: 'inicio', contexto: {} })
      .eq('telefono', telefonoToken)
  }

  // Enviar confirmación WA al número de notificación
  try {
    await enviarConfirmacionWA(
      telefonoNotif, body.nombre, body.fecha_hora,
      body.servicio_nombre, body.barbero_nombre, body.para_otro ?? false
    )
  } catch { /* no bloquear si WA falla */ }

  // Upsell de productos al que hizo la reserva (si tiene teléfono propio)
  const telefonoUpsell = body.para_otro ? (telefonoToken || body.telefono) : telefonoTurno
  if (telefonoUpsell) {
    try {
      const { data: productos } = await supabase
        .from('productos').select('id,nombre,precio').eq('activo', true).order('orden').limit(3)
      if (productos?.length) {
        await enviarUpsellWA(telefonoUpsell, turnoCreado.id, productos)
      }
    } catch { /* upsell es opcional */ }
  }

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
  servicio: string, barbero: string, paraOtro: boolean
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

  const msg = paraOtro
    ? `✅ ¡Turno confirmado para ${nombre}!\n\n📅 ${fechaStr} a las ${horaStr}\n✂️ ${servicio} con ${barbero}\n\nTe esperamos en AlPunto. ¡Cualquier cambio escribinos! 💈`
    : `✅ ¡Turno confirmado, ${nombre}!\n\n📅 ${fechaStr} a las ${horaStr}\n✂️ ${servicio} con ${barbero}\n\nTe esperamos en AlPunto. ¡Cualquier cambio escribinos! 💈`

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
