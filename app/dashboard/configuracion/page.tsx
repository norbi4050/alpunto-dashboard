'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { format, parseISO } from 'date-fns'
import type { Barbero, Servicio } from '@/lib/types'

const DIAS_HP = [
  { num: 1, label: 'L', nombre: 'Lunes' },
  { num: 2, label: 'M', nombre: 'Martes' },
  { num: 3, label: 'X', nombre: 'Miércoles' },
  { num: 4, label: 'J', nombre: 'Jueves' },
  { num: 5, label: 'V', nombre: 'Viernes' },
  { num: 6, label: 'S', nombre: 'Sábado' },
  { num: 0, label: 'D', nombre: 'Domingo' },
]

const NIVEL_DESC = {
  '1': 'Básico — Solo saluda y da info. Agustín responde todo manualmente.',
  '2': 'Asistente — El bot agenda turnos y responde preguntas frecuentes.',
  '3': 'Completo — Recordatorios, feedback, promos y reactivación activos.',
}

const BARBERO_COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899']

const DIAS_LABEL: Record<string, string> = { '0': 'Domingo', '1': 'Lunes', '2': 'Martes', '3': 'Miércoles', '4': 'Jueves', '5': 'Viernes', '6': 'Sábado' }

interface Bloqueado {
  telefono: string
  motivo: string | null
  bloqueado_por: string | null
  created_at: string
}

export default function ConfiguracionPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [bloqueados, setBloqueados] = useState<Bloqueado[]>([])
  const [desbloqueando, setDesbloqueando] = useState<string | null>(null)
  const [cfg, setCfg] = useState({ bot_nivel: '2', mensaje_bienvenida: '', mensaje_ausencia: '' })
  const [barberos, setBarberos] = useState<Barbero[]>([])
  const [servicios, setServicios] = useState<Servicio[]>([])
  const [selectedBarberoId, setSelectedBarberoId] = useState<string>('')
  const [horarios, setHorarios] = useState<{ id: string; dia_semana: number; hora_inicio: string; hora_fin: string }[]>([])
  const [loadingHorarios, setLoadingHorarios] = useState(false)
  const [savingBarbero, setSavingBarbero] = useState(false)
  const [savingServicio, setSavingServicio] = useState<string | null>(null)
  const [promoActiva, setPromoActiva] = useState(false)
  const [promoDia, setPromoDia] = useState('2')
  const [promoDescuento, setPromoDescuento] = useState('30')

  useEffect(() => {
    Promise.all([fetch('/api/configuracion'), fetch('/api/bloquear')])
      .then(async ([rCfg, rBloq]) => {
        if (rCfg.status === 403) { router.push('/dashboard'); setLoading(false); return }
        const dataCfg: { config: Record<string, string> } = await rCfg.json()
        setCfg(prev => ({
          ...prev,
          bot_nivel: dataCfg.config.bot_nivel ?? '2',
          mensaje_bienvenida: dataCfg.config.mensaje_bienvenida ?? '',
          mensaje_ausencia: dataCfg.config.mensaje_ausencia ?? '',
        }))
        setPromoActiva(dataCfg.config.promo_activa === 'true')
        setPromoDia(dataCfg.config.promo_dia ?? '2')
        setPromoDescuento(dataCfg.config.promo_descuento ?? '30')
        if (rBloq.ok) {
          const dataBloq: { bloqueados: Bloqueado[] } = await rBloq.json()
          setBloqueados(dataBloq.bloqueados)
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [router])

  useEffect(() => {
    const supabase = createClient()
    supabase.from('barberos').select('id, slot, nombre, whatsapp, color, activo, es_dueno').order('slot')
      .then(({ data }) => {
        if (data) { setBarberos(data as Barbero[]); if (data.length) setSelectedBarberoId(data[0].id) }
      })
    supabase.from('servicios').select('id, nombre, precio, duracion_min, activo').order('nombre')
      .then(({ data }) => { if (data) setServicios(data as Servicio[]) })
  }, [])

  useEffect(() => {
    if (!selectedBarberoId) return
    setLoadingHorarios(true)
    fetch(`/api/agenda/horarios?barbero_id=${selectedBarberoId}`)
      .then(r => r.json())
      .then(data => { setHorarios(data.horarios ?? []); setLoadingHorarios(false) })
      .catch(() => setLoadingHorarios(false))
  }, [selectedBarberoId])

  async function guardar() {
    setSaving(true); setSaved(false); setSaveError(null)
    try {
      const res = await fetch('/api/configuracion', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...cfg, promo_activa: String(promoActiva), promo_dia: promoDia, promo_descuento: promoDescuento }),
      })
      if (!res.ok) throw new Error()
      setSaved(true); setTimeout(() => setSaved(false), 3000)
    } catch { setSaveError('Error al guardar. Intentá de nuevo.') }
    finally { setSaving(false) }
  }

  async function desbloquear(telefono: string) {
    setDesbloqueando(telefono)
    const res = await fetch('/api/bloquear', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ telefono }) })
    if (res.ok) setBloqueados(prev => prev.filter(b => b.telefono !== telefono))
    setDesbloqueando(null)
  }

  async function actualizarBarbero(id: string, field: keyof Barbero, value: string | boolean) {
    setSavingBarbero(true)
    await createClient().from('barberos').update({ [field]: value }).eq('id', id)
    setBarberos(prev => prev.map(b => b.id === id ? { ...b, [field]: value } : b))
    setSavingBarbero(false)
  }

  async function actualizarServicio(id: string, field: keyof Servicio, value: string | number | boolean) {
    setSavingServicio(id)
    await createClient().from('servicios').update({ [field]: value }).eq('id', id)
    setServicios(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s))
    setSavingServicio(null)
  }

  function isDiaActivo(num: number) { return horarios.some(h => h.dia_semana === num) }

  async function toggleDiaHorario(num: number) {
    if (isDiaActivo(num)) {
      await Promise.all(horarios.filter(h => h.dia_semana === num).map(h => fetch(`/api/agenda/horarios/${h.id}`, { method: 'DELETE' })))
      setHorarios(prev => prev.filter(h => h.dia_semana !== num))
    } else {
      const res = await fetch('/api/agenda/horarios', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ barbero_id: selectedBarberoId, dia_semana: num, hora_inicio: '09:00', hora_fin: '13:00' }) })
      if (res.ok) { const nuevo = await res.json(); setHorarios(prev => [...prev, nuevo]) }
    }
  }

  async function agregarFranja(diaNum: number) {
    const res = await fetch('/api/agenda/horarios', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ barbero_id: selectedBarberoId, dia_semana: diaNum, hora_inicio: '16:00', hora_fin: '20:00' }) })
    if (res.ok) { const nuevo = await res.json(); setHorarios(prev => [...prev, nuevo]) }
  }

  async function eliminarFranja(id: string) {
    await fetch(`/api/agenda/horarios/${id}`, { method: 'DELETE' })
    setHorarios(prev => prev.filter(h => h.id !== id))
  }

  async function actualizarFranja(id: string, field: 'hora_inicio' | 'hora_fin', value: string) {
    const current = horarios.find(h => h.id === id)
    if (!current) return
    await fetch(`/api/agenda/horarios/${id}`, { method: 'DELETE' })
    const res = await fetch('/api/agenda/horarios', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ barbero_id: selectedBarberoId, dia_semana: current.dia_semana,
        hora_inicio: field === 'hora_inicio' ? value : current.hora_inicio,
        hora_fin: field === 'hora_fin' ? value : current.hora_fin }) })
    if (res.ok) {
      const data = await res.json()
      if (data?.id) setHorarios(prev => prev.map(h => h.id === id ? data : h))
      else setHorarios(prev => prev.filter(h => h.id !== id))
    } else setHorarios(prev => prev.filter(h => h.id !== id))
  }

  if (loading) return <div className="flex items-center justify-center h-full text-text-m text-sm">Cargando...</div>

  return (
    <div className="flex-1 overflow-y-auto bg-surface">
    <div className="max-w-xl mx-auto px-6 py-8">
      <h1 className="text-lg font-bold text-text-p mb-1">Configuración</h1>
      <p className="text-[12px] text-text-m mb-8">Cambios se aplican inmediatamente.</p>

      {/* Nivel del bot */}
      <section className="mb-8">
        <h2 className="text-[10px] font-bold text-text-m uppercase tracking-widest mb-3">Nivel del bot</h2>
        <div className="flex flex-col gap-2">
          {(['1', '2', '3'] as const).map(n => (
            <label key={n} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
              cfg.bot_nivel === n ? 'bg-surface-card border-stitch-primary shadow-glow-primary' : 'bg-surface-card border-outline-variant hover:border-outline'}`}>
              <input type="radio" name="bot_nivel" value={n} checked={cfg.bot_nivel === n}
                onChange={() => setCfg(prev => ({ ...prev, bot_nivel: n }))} className="mt-0.5 flex-shrink-0 accent-stitch-primary" />
              <div>
                <div className="text-[12px] font-semibold text-text-p">Nivel {n}</div>
                <div className="text-[11px] text-text-s mt-0.5">{NIVEL_DESC[n]}</div>
              </div>
            </label>
          ))}
        </div>
      </section>

      {/* Mensajes automáticos */}
      <section className="mb-8">
        <h2 className="text-[10px] font-bold text-text-m uppercase tracking-widest mb-3">Mensajes automáticos</h2>
        <div className="flex flex-col gap-4">
          <div>
            <label className="text-[11px] text-text-m block mb-1.5">Bienvenida (primer contacto)</label>
            <textarea value={cfg.mensaje_bienvenida} onChange={e => setCfg(prev => ({ ...prev, mensaje_bienvenida: e.target.value }))}
              rows={3} className="w-full bg-surface-container border border-outline-variant rounded-lg px-3 py-2 text-[12px] text-on-surface outline-none focus:border-stitch-primary resize-none" />
          </div>
          <div>
            <label className="text-[11px] text-text-m block mb-1.5">Fuera de horario</label>
            <textarea value={cfg.mensaje_ausencia} onChange={e => setCfg(prev => ({ ...prev, mensaje_ausencia: e.target.value }))}
              rows={3} className="w-full bg-surface-container border border-outline-variant rounded-lg px-3 py-2 text-[12px] text-on-surface outline-none focus:border-stitch-primary resize-none" />
          </div>
        </div>
      </section>

      {/* Servicios y precios */}
      <section className="mb-8">
        <h2 className="text-[10px] font-bold text-text-m uppercase tracking-widest mb-3">Servicios y precios</h2>
        <div className="flex flex-col gap-2">
          {servicios.length === 0
            ? <p className="text-[12px] text-text-m">Sin servicios configurados.</p>
            : servicios.map(s => (
              <div key={s.id} className="flex items-center gap-3 p-3 rounded-lg bg-surface-card border border-outline-variant">
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-semibold text-text-p">{s.nombre}</p>
                  <p className="text-[10px] text-text-m mt-0.5">{s.duracion_min} min</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-text-m">$</span>
                  <input type="number" defaultValue={s.precio}
                    onBlur={e => { const v = parseInt(e.target.value); if (!isNaN(v) && v !== s.precio) actualizarServicio(s.id, 'precio', v) }}
                    className="w-24 bg-surface-container border border-outline-variant rounded-lg px-2 py-1.5 text-[12px] text-on-surface outline-none focus:border-stitch-primary [appearance:textfield]" />
                </div>
                <label className="flex items-center gap-1.5 cursor-pointer flex-shrink-0">
                  <input type="checkbox" checked={s.activo} onChange={e => actualizarServicio(s.id, 'activo', e.target.checked)} className="accent-stitch-primary" />
                  <span className="text-[11px] text-text-m">{s.activo ? 'Activo' : 'Inactivo'}</span>
                </label>
                {savingServicio === s.id && <span className="text-[10px] text-text-m">…</span>}
              </div>
            ))}
        </div>
      </section>

      {/* Barberos */}
      <section className="mb-8">
        <h2 className="text-[10px] font-bold text-text-m uppercase tracking-widest mb-3">Barberos</h2>
        <div className="flex flex-col gap-3">
          {barberos.map(b => (
            <div key={b.id} className={`p-3 rounded-lg border ${b.activo ? 'bg-surface-card border-outline-variant' : 'bg-surface-container/30 border-outline-variant/50 opacity-60'}`}>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-6 h-6 rounded-full flex-shrink-0" style={{ background: b.color }} />
                <div className="flex-1">
                  <input type="text" defaultValue={b.nombre} disabled={b.es_dueno}
                    onBlur={e => { if (e.target.value !== b.nombre) actualizarBarbero(b.id, 'nombre', e.target.value) }}
                    className="bg-transparent border-b border-outline-variant focus:border-stitch-primary outline-none text-[12px] font-semibold text-text-p w-full disabled:opacity-60"
                    placeholder={`Barbero ${b.slot}`} />
                </div>
                {b.es_dueno
                  ? <span className="text-[10px] text-stitch-primary border border-border-primary rounded px-1.5 py-0.5">Dueño</span>
                  : (
                    <label className="flex items-center gap-1 cursor-pointer flex-shrink-0">
                      <input type="checkbox" checked={b.activo} onChange={e => actualizarBarbero(b.id, 'activo', e.target.checked)} className="accent-stitch-primary" />
                      <span className="text-[10px] text-text-m">Activo</span>
                    </label>
                  )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-text-m">WA:</span>
                <input type="text" defaultValue={b.whatsapp ?? ''} disabled={b.es_dueno}
                  onBlur={e => { if (e.target.value !== (b.whatsapp ?? '')) actualizarBarbero(b.id, 'whatsapp', e.target.value) }}
                  className="flex-1 bg-surface-container border border-outline-variant rounded px-2 py-1 text-[11px] text-on-surface outline-none focus:border-stitch-primary font-mono disabled:opacity-60"
                  placeholder="+549375XXXXXXX" />
                <div className="flex gap-1">
                  {BARBERO_COLORS.map(c => (
                    <button key={c} onClick={() => actualizarBarbero(b.id, 'color', c)}
                      className={`w-4 h-4 rounded-full transition-transform ${b.color === c ? 'scale-125 ring-2 ring-white/50' : 'hover:scale-110'}`}
                      style={{ background: c }} />
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
        {savingBarbero && <p className="text-[10px] text-text-m mt-2">Guardando…</p>}
      </section>

      {/* Horarios por barbero */}
      <section className="mb-8">
        <h2 className="text-[10px] font-bold text-text-m uppercase tracking-widest mb-3">Horarios por barbero</h2>
        {barberos.length === 0 ? (
          <p className="text-[12px] text-text-m">Sin barberos configurados.</p>
        ) : (
          <>
            <div className="mb-4">
              <label className="text-[11px] text-text-m block mb-1.5">Barbero</label>
              <select value={selectedBarberoId} onChange={e => setSelectedBarberoId(e.target.value)}
                className="bg-surface-container border border-outline-variant rounded-lg px-3 py-2 text-[12px] text-on-surface outline-none focus:border-stitch-primary">
                {barberos.filter(b => b.activo).map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
              </select>
            </div>
            {loadingHorarios ? <p className="text-[12px] text-text-m">Cargando…</p> : (
              <>
                <div className="mb-4">
                  <label className="text-[11px] text-text-m block mb-2">Días que trabaja</label>
                  <div className="flex gap-2">
                    {DIAS_HP.map(({ num, label }) => (
                      <button key={num} onClick={() => toggleDiaHorario(num)}
                        className={`w-8 h-8 rounded-full text-[11px] font-bold transition-colors ${
                          isDiaActivo(num) ? 'bg-gradient-to-br from-nt-navy to-blue-600 text-white shadow-glow-primary' : 'bg-surface-card border border-outline-variant text-text-s hover:border-outline'}`}>{label}</button>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-3">
                  {DIAS_HP.filter(({ num }) => isDiaActivo(num)).map(({ num, nombre }) => {
                    const franjasDelDia = horarios.filter(h => h.dia_semana === num).sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio))
                    return (
                      <div key={num}>
                        <p className="text-[11px] font-semibold text-text-p mb-1.5">{nombre}</p>
                        <div className="flex flex-col gap-1.5">
                          {franjasDelDia.map(franja => (
                            <div key={franja.id} className="flex items-center gap-2">
                              <input type="time" defaultValue={franja.hora_inicio}
                                onBlur={e => { if (e.target.value >= franja.hora_fin) { e.target.value = franja.hora_inicio; return } actualizarFranja(franja.id, 'hora_inicio', e.target.value) }}
                                className="bg-surface-container border border-outline-variant rounded-lg px-2 py-1.5 text-[11px] text-on-surface outline-none focus:border-stitch-primary [color-scheme:dark] w-24" />
                              <span className="text-text-s text-[11px]">→</span>
                              <input type="time" defaultValue={franja.hora_fin}
                                onBlur={e => { if (e.target.value <= franja.hora_inicio) { e.target.value = franja.hora_fin; return } actualizarFranja(franja.id, 'hora_fin', e.target.value) }}
                                className="bg-surface-container border border-outline-variant rounded-lg px-2 py-1.5 text-[11px] text-on-surface outline-none focus:border-stitch-primary [color-scheme:dark] w-24" />
                              <button onClick={() => eliminarFranja(franja.id)} className="text-se-text/60 hover:text-se-text transition-colors text-xs flex-shrink-0">✕</button>
                            </div>
                          ))}
                          <button onClick={() => agregarFranja(num)} className="text-[11px] text-stitch-primary hover:underline text-left">+ Agregar franja</button>
                        </div>
                      </div>
                    )
                  })}
                  {horarios.length === 0 && <p className="text-[12px] text-text-m">Activá los días que trabaja este barbero.</p>}
                </div>
              </>
            )}
          </>
        )}
      </section>

      {/* Promo días lentos */}
      <section className="mb-8">
        <h2 className="text-[10px] font-bold text-text-m uppercase tracking-widest mb-3">Promo días lentos</h2>
        <label className="flex items-center gap-2 mb-3 cursor-pointer">
          <input type="checkbox" checked={promoActiva} onChange={e => setPromoActiva(e.target.checked)} className="accent-stitch-primary" />
          <span className="text-[12px] text-text-s">Activar promo automática</span>
        </label>
        {promoActiva && (
          <div className="flex gap-4 items-end">
            <div>
              <label className="text-[11px] text-text-m block mb-1.5">Día</label>
              <select value={promoDia} onChange={e => setPromoDia(e.target.value)}
                className="bg-surface-container border border-outline-variant rounded-lg px-3 py-2 text-[12px] text-on-surface outline-none focus:border-stitch-primary">
                {Object.entries(DIAS_LABEL).filter(([k]) => k !== '0').map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[11px] text-text-m block mb-1.5">Descuento (%)</label>
              <input type="number" min="1" max="99" value={promoDescuento} onChange={e => setPromoDescuento(e.target.value)}
                className="w-20 bg-surface-container border border-outline-variant rounded-lg px-3 py-2 text-[12px] text-on-surface outline-none focus:border-stitch-primary [appearance:textfield]" />
            </div>
            <p className="text-[11px] text-text-m pb-2">Los {DIAS_LABEL[promoDia]}s → {promoDescuento}% off</p>
          </div>
        )}
      </section>

      {/* Números bloqueados */}
      <section className="mb-8">
        <h2 className="text-[10px] font-bold text-text-m uppercase tracking-widest mb-3">Números bloqueados</h2>
        {bloqueados.length === 0 ? <p className="text-[12px] text-text-m">Sin números bloqueados.</p> : (
          <div className="flex flex-col gap-2">
            {bloqueados.map(b => (
              <div key={b.telefono} className="flex items-center gap-3 p-3 rounded-lg bg-surface-card border border-outline-variant">
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-semibold text-text-p font-mono">{b.telefono}</p>
                  <p className="text-[10px] text-text-m mt-0.5">
                    {format(parseISO(b.created_at), 'dd/MM/yyyy HH:mm')}
                    {b.bloqueado_por ? ` · ${b.bloqueado_por}` : ''}
                  </p>
                </div>
                <button onClick={() => desbloquear(b.telefono)} disabled={desbloqueando === b.telefono}
                  className="text-[11px] bg-surface-container hover:bg-surface-container-high text-text-s hover:text-on-surface border border-outline-variant rounded-md px-3 py-1.5 font-semibold transition-colors disabled:opacity-60 flex-shrink-0">
                  {desbloqueando === b.telefono ? 'Desbloqueando…' : 'Desbloquear'}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {saveError && <p className="text-[10px] text-se-text mb-2">{saveError}</p>}
      <button onClick={guardar} disabled={saving}
        className="w-full bg-gradient-to-r from-nt-navy to-blue-600 hover:brightness-110 disabled:opacity-60 text-white rounded-lg py-2.5 text-sm font-semibold transition-colors">
        {saving ? 'Guardando…' : saved ? '✓ Guardado' : 'Guardar cambios del bot'}
      </button>
    </div>
    </div>
  )
}
