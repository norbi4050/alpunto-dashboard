import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/reservar/slots?barbero_id=X&fecha=YYYY-MM-DD&duracion=N (duracion ignorado, siempre 40)
//
// Regla de negocio: todos los turnos ocupan exactamente SLOT_INTERVAL minutos.
// La grilla es fija: apertura, apertura+40, apertura+80...
// Un slot está ocupado si algún turno empieza en la ventana [m, m+SLOT_INTERVAL).

const SLOT_INTERVAL = 40

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const barberoId = searchParams.get('barbero_id')
  const fecha = searchParams.get('fecha')        // YYYY-MM-DD

  if (!barberoId || !fecha) return NextResponse.json({ slots: [] })

  const supabase = createClient()
  const diaSemana = new Date(fecha + 'T12:00:00Z').getUTCDay()

  const [{ data: horarios }, { data: turnos }, { data: bloqueos }] = await Promise.all([
    supabase.from('horarios_barbero')
      .select('hora_inicio,hora_fin')
      .eq('barbero_id', barberoId)
      .eq('dia_semana', diaSemana)
      .eq('activo', true),
    supabase.from('turnos')
      .select('fecha_hora')
      .eq('barbero_id', barberoId)
      .gte('fecha_hora', `${fecha}T00:00:00-03:00`)
      .lt('fecha_hora', `${fecha}T23:59:59-03:00`)
      .not('estado', 'in', '("cancelado","auto_cancelado","no_show")'),
    supabase.from('bloqueos')
      .select('hora_inicio,hora_fin,dia_completo')
      .eq('barbero_id', barberoId)
      .eq('fecha', fecha),
  ])

  if (!horarios?.length) return NextResponse.json({ slots: [] })
  if (bloqueos?.some(b => b.dia_completo)) return NextResponse.json({ slots: [] })

  function timeToMin(t: string) {
    const [h, m] = t.split(':').map(Number)
    return h * 60 + m
  }
  function minToTime(m: number) {
    return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
  }

  // Minutos ART de cada turno existente (cualquier turno ocupa su slot de 40 min)
  const turnosMin = new Set<number>()
  for (const t of turnos ?? []) {
    const d = new Date(t.fecha_hora)
    const artMin = ((d.getUTCHours() - 3 + 24) % 24) * 60 + d.getUTCMinutes()
    turnosMin.add(artMin)
  }

  // Bloqueos de horas: marcar cada inicio de slot dentro del rango como ocupado
  const rangosBloqueados: { ini: number; fin: number }[] = []
  for (const b of bloqueos ?? []) {
    if (b.hora_inicio && b.hora_fin) {
      rangosBloqueados.push({ ini: timeToMin(b.hora_inicio), fin: timeToMin(b.hora_fin) })
    }
  }

  // Buffer: no mostrar slots < 30 min desde ahora si es hoy
  const hoyArg = new Date(new Date().getTime() - 3 * 60 * 60 * 1000)
  const esHoy = fecha === [
    hoyArg.getUTCFullYear(),
    String(hoyArg.getUTCMonth() + 1).padStart(2, '0'),
    String(hoyArg.getUTCDate()).padStart(2, '0'),
  ].join('-')
  const bufferMin = esHoy ? hoyArg.getUTCHours() * 60 + hoyArg.getUTCMinutes() + 30 : 0

  const slots: { hora: string; fechaHora: string }[] = []

  for (const h of horarios) {
    const openMin  = timeToMin(h.hora_inicio)
    const closeMin = timeToMin(h.hora_fin)

    for (let m = openMin; m + SLOT_INTERVAL <= closeMin; m += SLOT_INTERVAL) {
      if (m < bufferMin) continue

      // Bloqueado por rango de horas?
      const bloqueado = rangosBloqueados.some(r => m >= r.ini && m < r.fin)
      if (bloqueado) continue

      // Algún turno arranca en esta ventana de 40 min?
      const ocupado = Array.from(turnosMin).some(tm => tm >= m && tm < m + SLOT_INTERVAL)
      if (ocupado) continue

      slots.push({
        hora: minToTime(m),
        fechaHora: `${fecha}T${minToTime(m)}:00-03:00`,
      })
    }
  }

  return NextResponse.json({ slots })
}
