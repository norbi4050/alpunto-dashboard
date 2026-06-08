// lib/n8n.ts
const BASE = process.env.N8N_WEBHOOK_BASE!
const KEY = process.env.N8N_DASHBOARD_KEY!
const headers = { 'Content-Type': 'application/json', 'X-Dashboard-Key': KEY }

export async function cancelarTurno(turnoId: string) {
  const res = await fetch(`${BASE}/webhook/dashboard-cancelar`, {
    method: 'POST', headers,
    body: JSON.stringify({ turno_id: turnoId }),
    cache: 'no-store' as RequestCache,
  })
  if (!res.ok) throw new Error('Error al cancelar turno')
  return res.json()
}

export async function crearTurno(data: {
  nombre: string; whatsapp: string
  barbero_id: string; servicio: string; fecha_hora: string
}) {
  const res = await fetch(`${BASE}/webhook/dashboard-crear-turno`, {
    method: 'POST', headers,
    body: JSON.stringify(data),
    cache: 'no-store' as RequestCache,
  })
  if (!res.ok) throw new Error('Error al crear turno')
  return res.json()
}

export async function responderHandoff(data: { telefono: string; mensaje: string; cerrar?: boolean }) {
  const res = await fetch(`${BASE}/webhook/dashboard-responder`, {
    method: 'POST', headers,
    body: JSON.stringify(data),
    cache: 'no-store' as RequestCache,
  })
  if (!res.ok) throw new Error('Error al responder')
  return res.json()
}
