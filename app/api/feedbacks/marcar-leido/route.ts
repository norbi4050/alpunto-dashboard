import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const { id } = await req.json() as { id: string }
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

  const supabase = createClient()
  const { error } = await supabase.from('feedbacks').update({ leido: true }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
