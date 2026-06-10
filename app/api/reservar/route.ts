import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/reservar?token=X  — valida token y devuelve contexto
// GET /api/reservar           — devuelve barberos + servicios para flujo directo
export async function GET(req: NextRequest) {
  const supabase = createClient()
  const token = req.nextUrl.searchParams.get('token')

  // Flujo directo (sin token): devolver barberos y servicios
  if (!token) {
    const [{ data: barberos }, { data: servicios }] = await Promise.all([
      supabase.from('barberos').select('id,nombre,color').eq('activo', true).order('nombre'),
      supabase.from('servicios').select('id,nombre,precio,duracion_min').eq('activo', true).order('nombre'),
    ])
    return NextResponse.json({ tipo: 'directo', barberos: barberos ?? [], servicios: servicios ?? [] })
  }

  // Flujo con token
  const { data: tk } = await supabase
    .from('reserva_tokens')
    .select('*')
    .eq('token', token)
    .single()

  if (!tk) return NextResponse.json({ error: 'Token inválido' }, { status: 404 })
  if (tk.usado) return NextResponse.json({ error: 'Este link ya fue usado' }, { status: 410 })
  if (new Date(tk.expires_at) < new Date())
    return NextResponse.json({ error: 'Este link expiró. Escribinos para obtener uno nuevo.' }, { status: 410 })

  const [{ data: barberos }, { data: cliente }] = await Promise.all([
    supabase.from('barberos').select('id,nombre,color').eq('activo', true).order('nombre'),
    supabase.from('clientes').select('nombre,fecha_nacimiento').eq('whatsapp', tk.telefono).maybeSingle(),
  ])

  return NextResponse.json({
    tipo: 'token',
    token,
    servicio: {
      id: tk.servicio_id,
      nombre: tk.servicio_nombre,
      duracion: tk.servicio_duracion,
      precio: tk.servicio_precio,
    },
    barberos: barberos ?? [],
    clienteExistente: cliente ?? null,
  })
}
