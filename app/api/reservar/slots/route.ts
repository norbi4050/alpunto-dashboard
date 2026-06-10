import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/reservar/slots?barbero_id=X&fecha=YYYY-MM-DD&duracion=N
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const barberoId = searchParams.get('barbero_id')
  const fecha = searchParams.get('fecha')        // YYYY-MM-DD
  const duracion = parseInt(searchParams.get('duracion') ?? '30')

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
      .select('fecha_hora,servicio')
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

  // Slots ocupados: inicio en minutos
  const ocupados = new Set<number>()
  for (const t of turnos ?? []) {
    const d = new Date(t.fecha_hora)
    const artMin = (d.getUTCHours() - 3 + 24) % 24 * 60 + d.getUTCMinutes()
    // Block out the full duration of each booked service (default 30 if unknown)
    for (let i = 0; i < duracion; i++) ocupados.add(artMin + i)
  }

  // Bloqueos de horas
  for (const b of bloqueos ?? []) {
    if (b.hora_inicio && b.hora_fin) {
      const ini = timeToMin(b.hora_inicio)
      const fin = timeToMin(b.hora_fin)
      for (let i = ini; i < fin; i++) ocupados.add(i)
    }
  }

  // Buffer: no mostrar slots < 30 min desde ahora si es hoy
  const hoyArg = new Date(new Date().getTime() - 3 * 60 * 60 * 1000)
  const esHoy = fecha === `${hoyArg.getUTCFullYear()}-${String(hoyArg.getUTCMonth()+1).padStart(2,'0')}-${String(hoyArg.getUTCDate()).padStart(2,'0')}`
  const ahoraMin = esHoy ? hoyArg.getUTCHours() * 60 + hoyArg.getUTCMinutes() + 30 : 0

  const slots: { hora: string; fechaHora: string }[] = []

  for (const h of horarios) {
    const ini = timeToMin(h.hora_inicio)
    const fin = timeToMin(h.hora_fin)
    for (let m = ini; m + duracion <= fin; m += duracion) {
      if (m < ahoraMin) continue
      // Check that the entire slot range is free
      let libre = true
      for (let i = m; i < m + duracion; i++) {
        if (ocupados.has(i)) { libre = false; break }
      }
      if (libre) {
        slots.push({
          hora: minToTime(m),
          fechaHora: `${fecha}T${minToTime(m)}:00-03:00`,
        })
      }
    }
  }

  return NextResponse.json({ slots })
}
