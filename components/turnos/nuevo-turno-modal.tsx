'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { DateTimePicker } from './date-time-picker'
import type { Barbero, Servicio } from '@/lib/types'

const WA_PHONE_RE = /^549\d{10}$/

function phoneError(val: string): string | null {
  if (!val) return null
  const clean = val.replace(/[\s\-\+]/g, '')
  if (!/^\d+$/.test(clean)) return 'Solo números, sin espacios ni guiones'
  if (!WA_PHONE_RE.test(clean)) return 'Formato: 549 + código de área + número (ej: 5493755123456)'
  return null
}

interface Props {
  onClose: () => void
  defaultFecha?: string
  defaultHora?: string
}

export function NuevoTurnoModal({ onClose, defaultFecha, defaultHora }: Props) {
  const router = useRouter()
  const [form, setForm] = useState({
    nombre: '', whatsapp: '', barbero_id: '', servicio: '',
    fecha_hora: defaultFecha && defaultHora ? `${defaultFecha}T${defaultHora}` : '',
  })
  const [phoneTouched, setPhoneTouched] = useState(false)
  const [barberos, setBarberos] = useState<Barbero[]>([])
  const [servicios, setServicios] = useState<Servicio[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.from('barberos').select('id,slot,nombre,whatsapp,color,activo,es_dueno').eq('activo', true).order('slot')
      .then(({ data }) => { if (data) setBarberos(data as Barbero[]) })
    supabase.from('servicios').select('id,nombre,precio,duracion_min,activo').eq('activo', true).order('nombre')
      .then(({ data }) => { if (data) setServicios(data as Servicio[]) })
  }, [])

  function set(field: keyof typeof form, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function submit() {
    const phoneErr = phoneError(form.whatsapp)
    if (phoneErr) { setPhoneTouched(true); setError(phoneErr); return }
    if (!form.nombre || !form.whatsapp || !form.barbero_id || !form.fecha_hora) {
      setError('Completá nombre, teléfono, barbero y fecha/hora')
      return
    }
    setLoading(true)
    setError(null)
    const res = await fetch('/api/turnos/crear', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, whatsapp: form.whatsapp.replace(/[\s\-\+]/g, '') }),
    })
    if (res.ok) {
      router.refresh()
      onClose()
    } else {
      const data = await res.json().catch(() => ({}))
      setError((data as { error?: string }).error ?? 'Error al crear turno')
      setLoading(false)
    }
  }

  const phoneErr = phoneTouched ? phoneError(form.whatsapp) : null
  const base = "bg-[#0d1117] border rounded-lg px-3 py-2 text-sm text-[#e6edf3] outline-none transition-colors"
  const cls = `${base} border-[#30363d] focus:border-[#58a6ff]`
  const clsErr = `${base} border-red-500 focus:border-red-400`

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-6 w-full max-w-md flex flex-col gap-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-[#f0f6fc]">Nuevo turno</h2>
          <button onClick={onClose} className="text-[#8b949e] hover:text-[#e6edf3]">&#x2715;</button>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-[#8b949e]">Nombre del cliente</label>
          <input type="text" value={form.nombre} onChange={e => set('nombre', e.target.value)}
            placeholder="Juan García" className={cls} />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-[#8b949e]">Teléfono WhatsApp</label>
          <input type="text" value={form.whatsapp}
            onChange={e => set('whatsapp', e.target.value)}
            onBlur={() => setPhoneTouched(true)}
            placeholder="5493755123456"
            className={phoneErr ? clsErr : cls} />
          {phoneErr
            ? <p className="text-[11px] text-red-400">{phoneErr}</p>
            : <p className="text-[11px] text-[#8b949e]">Ej: 5493755123456 (sin espacios)</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-[#8b949e]">Servicio</label>
          <select value={form.servicio} onChange={e => set('servicio', e.target.value)} className={cls}>
            <option value="">Seleccioná servicio</option>
            {servicios.map(s => <option key={s.id} value={s.nombre}>{s.nombre} — ${s.precio.toLocaleString('es-AR')}</option>)}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-[#8b949e]">Barbero</label>
          <select value={form.barbero_id} onChange={e => set('barbero_id', e.target.value)} className={cls}>
            <option value="">Seleccioná barbero</option>
            {barberos.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-[#8b949e]">Fecha y horario</label>
          <div className="bg-[#0d1117] border border-[#30363d] rounded-lg p-3">
            <DateTimePicker barberoId={form.barbero_id} value={form.fecha_hora} onChange={val => set('fecha_hora', val)} />
          </div>
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}
        <button onClick={submit} disabled={loading || !!phoneErr}
          className="bg-[#238636] hover:bg-[#2ea043] text-white rounded-lg py-2 text-sm font-semibold transition-colors disabled:opacity-60">
          {loading ? 'Creando turno…' : '+ Crear turno'}
        </button>
      </div>
    </div>
  )
}
