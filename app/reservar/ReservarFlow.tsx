'use client'
import { useState, useEffect } from 'react'
import { addDays, format } from 'date-fns'
import { es } from 'date-fns/locale'

interface Barbero { id: string; nombre: string; color: string }
interface Servicio { id: string; nombre: string; precio: number; duracion_min: number }
interface Slot { hora: string; fechaHora: string }

type Step = 'loading' | 'error' | 'servicio' | 'datos' | 'horario' | 'confirmado'

const DIAS_SHORT = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']

function fmtPrecio(n: number | null) {
  if (!n) return ''
  return `$${n.toLocaleString('es-AR')}`
}

export function ReservarFlow({ token }: { token?: string }) {
  const [step, setStep]             = useState<Step>('loading')
  const [errorMsg, setErrorMsg]     = useState('')
  const [tipo, setTipo]             = useState<'token'|'directo'>('directo')

  // Datos del servicio (token lo trae resuelto; directo lo elige el usuario)
  const [servicios, setServicios]   = useState<Servicio[]>([])
  const [servicio, setServicio]     = useState<{ id?: string; nombre: string; duracion: number; precio?: number } | null>(null)

  // Barberos
  const [barberos, setBarberos]     = useState<Barbero[]>([])

  // Formulario de datos personales
  const [nombre, setNombre]         = useState('')
  const [telefono, setTelefono]     = useState('')
  const [cumpleanos, setCumpleanos] = useState('')
  const [nombrePrefill, setNombrePrefill] = useState(false)

  // Selección de horario
  const [barberoIdx, setBarberoIdx] = useState(0)
  const [fechas, setFechas]         = useState<Date[]>([])
  const [fechaIdx, setFechaIdx]     = useState(0)
  const [slots, setSlots]           = useState<Slot[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [slotSel, setSlotSel]       = useState<Slot | null>(null)

  const [submitting, setSubmitting] = useState(false)

  // ── Inicialización ──────────────────────────────────────────────────────────
  useEffect(() => {
    fetch(`/api/reservar${token ? `?token=${token}` : ''}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { setErrorMsg(d.error); setStep('error'); return }
        setTipo(d.tipo)
        setBarberos(d.barberos ?? [])
        if (d.tipo === 'token') {
          setServicio(d.servicio)
          if (d.clienteExistente?.nombre) {
            setNombre(d.clienteExistente.nombre)
            setNombrePrefill(true)
            if (d.clienteExistente.fecha_nacimiento)
              setCumpleanos(d.clienteExistente.fecha_nacimiento)
          }
          setStep('datos')
        } else {
          setServicios(d.servicios ?? [])
          setStep('servicio')
        }
        // Preparar fechas (próximos 7 días hábiles)
        const arr: Date[] = []
        for (let i = 0; arr.length < 7; i++) {
          const d2 = addDays(new Date(), i)
          if (d2.getDay() !== 0) arr.push(d2) // sin domingos
        }
        setFechas(arr)
      })
      .catch(() => { setErrorMsg('No se pudo cargar la página. Intentá más tarde.'); setStep('error') })
  }, [token])

  // ── Cargar slots cuando cambia barbero o fecha ──────────────────────────────
  useEffect(() => {
    if (step !== 'horario' || !barberos[barberoIdx] || !fechas[fechaIdx] || !servicio) return
    setLoadingSlots(true)
    setSlotSel(null)
    const fecha = format(fechas[fechaIdx], 'yyyy-MM-dd')
    fetch(`/api/reservar/slots?barbero_id=${barberos[barberoIdx].id}&fecha=${fecha}&duracion=${servicio.duracion}`)
      .then(r => r.json())
      .then(d => { setSlots(d.slots ?? []); setLoadingSlots(false) })
      .catch(() => setLoadingSlots(false))
  }, [step, barberoIdx, fechaIdx, barberos, fechas, servicio])

  // ── Confirmar turno ─────────────────────────────────────────────────────────
  async function confirmar() {
    if (!slotSel || !servicio || !barberos[barberoIdx]) return
    setSubmitting(true)
    const res = await fetch('/api/reservar/confirmar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        nombre,
        telefono: tipo === 'directo' ? telefono.replace(/\D/g, '') : undefined,
        cumpleanos: cumpleanos || undefined,
        barbero_id: barberos[barberoIdx].id,
        barbero_nombre: barberos[barberoIdx].nombre,
        fecha_hora: slotSel.fechaHora,
        servicio_id: servicio.id,
        servicio_nombre: servicio.nombre,
        servicio_duracion: servicio.duracion,
        servicio_precio: servicio.precio,
      }),
    })
    const data = await res.json()
    setSubmitting(false)
    if (data.ok) setStep('confirmado')
    else setErrorMsg(data.error ?? 'Error al confirmar. Intentá de nuevo.')
  }

  const manana = slots.filter(s => parseInt(s.hora.split(':')[0]) < 13)
  const tarde  = slots.filter(s => parseInt(s.hora.split(':')[0]) >= 13)

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-white flex flex-col">
      {/* Header */}
      <div className="bg-[#1a1a1a] border-b border-white/10 px-4 py-4 flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-[#c9a84c] flex items-center justify-center text-black font-black text-sm">AP</div>
        <div>
          <p className="font-bold text-sm leading-tight">AlPunto Barbería</p>
          <p className="text-[11px] text-white/50">Reservá tu turno online</p>
        </div>
      </div>

      <div className="flex-1 px-4 py-6 max-w-lg mx-auto w-full">

        {/* LOADING */}
        {step === 'loading' && (
          <div className="flex justify-center pt-16">
            <div className="w-6 h-6 border-2 border-[#c9a84c] border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* ERROR */}
        {step === 'error' && (
          <div className="text-center pt-16">
            <p className="text-4xl mb-4">⏳</p>
            <p className="font-semibold text-white/80">{errorMsg}</p>
            <p className="text-sm text-white/40 mt-2">Escribinos por WhatsApp para sacar un nuevo turno.</p>
          </div>
        )}

        {/* SELECCIÓN DE SERVICIO (flujo directo) */}
        {step === 'servicio' && (
          <div>
            <h1 className="text-xl font-bold mb-1">¿Qué servicio querés?</h1>
            <p className="text-white/50 text-sm mb-5">Elegí el servicio para ver la disponibilidad.</p>
            <div className="space-y-2">
              {servicios.map(s => (
                <button key={s.id} onClick={() => { setServicio({ id: s.id, nombre: s.nombre, duracion: s.duracion_min, precio: s.precio }); setStep('datos') }}
                  className="w-full bg-[#1a1a1a] hover:bg-[#242424] border border-white/10 rounded-xl px-4 py-3.5 text-left flex items-center justify-between transition-colors">
                  <div>
                    <p className="font-semibold text-sm">{s.nombre}</p>
                    <p className="text-white/40 text-xs mt-0.5">{s.duracion_min} min</p>
                  </div>
                  <span className="text-[#c9a84c] font-bold text-sm">{fmtPrecio(s.precio)}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* DATOS PERSONALES */}
        {step === 'datos' && (
          <div>
            <h1 className="text-xl font-bold mb-1">Tus datos</h1>
            <p className="text-white/50 text-sm mb-5">
              {nombrePrefill ? 'Confirmá tu nombre para continuar.' : 'Completá tus datos para reservar.'}
            </p>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-white/60 block mb-1.5">Nombre completo *</label>
                <input
                  type="text" value={nombre} onChange={e => setNombre(e.target.value)}
                  placeholder="Ej: Juan García"
                  className="w-full bg-[#1a1a1a] border border-white/15 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#c9a84c] transition-colors placeholder:text-white/25"
                />
              </div>
              {tipo === 'directo' && (
                <div>
                  <label className="text-xs font-semibold text-white/60 block mb-1.5">WhatsApp *</label>
                  <input
                    type="tel" value={telefono} onChange={e => setTelefono(e.target.value)}
                    placeholder="Ej: 3755 123456"
                    className="w-full bg-[#1a1a1a] border border-white/15 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#c9a84c] transition-colors placeholder:text-white/25"
                  />
                </div>
              )}
              <div>
                <label className="text-xs font-semibold text-white/60 block mb-1">
                  Fecha de cumpleaños <span className="text-white/30 font-normal">(opcional)</span>
                </label>
                <p className="text-[11px] text-[#c9a84c] mb-1.5">🎁 En tu cumpleaños te regalamos un corte gratis</p>
                <input
                  type="date" value={cumpleanos} onChange={e => setCumpleanos(e.target.value)}
                  className="w-full bg-[#1a1a1a] border border-white/15 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#c9a84c] transition-colors text-white/80"
                />
              </div>
              <button
                onClick={() => { if (nombre.trim() && (tipo === 'token' || telefono.trim())) setStep('horario') }}
                disabled={!nombre.trim() || (tipo === 'directo' && !telefono.trim())}
                className="w-full bg-[#c9a84c] hover:bg-[#b8962e] disabled:opacity-40 disabled:cursor-not-allowed text-black font-bold rounded-xl py-3.5 text-sm transition-colors mt-2">
                Elegir horario →
              </button>
            </div>
          </div>
        )}

        {/* SELECCIÓN DE HORARIO */}
        {step === 'horario' && servicio && (
          <div>
            {/* Servicio seleccionado */}
            <div className="bg-[#1a1a1a] rounded-xl px-4 py-3 mb-5 flex items-center justify-between">
              <div>
                <p className="font-semibold text-sm">✂️ {servicio.nombre}</p>
                <p className="text-white/40 text-xs">{servicio.duracion} min{servicio.precio ? ` · ${fmtPrecio(servicio.precio)}` : ''}</p>
              </div>
              {tipo === 'directo' && (
                <button onClick={() => { setStep('servicio'); setSlotSel(null) }}
                  className="text-[11px] text-white/40 hover:text-white/70 transition-colors">cambiar</button>
              )}
            </div>

            {/* Tabs de barbero */}
            <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
              {barberos.map((b, i) => (
                <button key={b.id} onClick={() => { setBarberoIdx(i); setSlotSel(null) }}
                  className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-colors
                    ${barberoIdx === i
                      ? 'border-[#c9a84c] bg-[#c9a84c]/10 text-[#c9a84c]'
                      : 'border-white/10 bg-[#1a1a1a] text-white/50 hover:text-white/80'}`}>
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: b.color }} />
                  {b.nombre}
                </button>
              ))}
            </div>

            {/* Selector de fechas */}
            <div className="flex gap-2 overflow-x-auto pb-1 mb-5">
              {fechas.map((d, i) => (
                <button key={i} onClick={() => { setFechaIdx(i); setSlotSel(null) }}
                  className={`flex-shrink-0 flex flex-col items-center px-3 py-2.5 rounded-xl border text-xs transition-colors
                    ${fechaIdx === i
                      ? 'border-[#c9a84c] bg-[#c9a84c]/10 text-[#c9a84c]'
                      : 'border-white/10 bg-[#1a1a1a] text-white/50 hover:text-white/80'}`}>
                  <span className="font-semibold text-[10px] uppercase">{DIAS_SHORT[d.getDay()]}</span>
                  <span className="font-black text-lg leading-tight">{d.getDate()}</span>
                  <span className="text-[10px]">{format(d, 'MMM', { locale: es })}</span>
                </button>
              ))}
            </div>

            {/* Slots */}
            {loadingSlots ? (
              <div className="flex justify-center py-8">
                <div className="w-5 h-5 border-2 border-[#c9a84c] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : slots.length === 0 ? (
              <p className="text-white/40 text-sm text-center py-8">Sin disponibilidad este día. Probá otro día o barbero.</p>
            ) : (
              <div className="space-y-4">
                {manana.length > 0 && (
                  <div>
                    <p className="text-[11px] font-semibold text-white/40 uppercase tracking-wider mb-2">☀️ Mañana</p>
                    <div className="grid grid-cols-3 gap-2">
                      {manana.map(s => (
                        <button key={s.hora} onClick={() => setSlotSel(s)}
                          className={`py-2.5 rounded-xl text-sm font-bold border transition-colors
                            ${slotSel?.hora === s.hora
                              ? 'border-[#c9a84c] bg-[#c9a84c]/15 text-[#c9a84c]'
                              : 'border-white/10 bg-[#1a1a1a] text-white/70 hover:border-white/30'}`}>
                          {s.hora}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {tarde.length > 0 && (
                  <div>
                    <p className="text-[11px] font-semibold text-white/40 uppercase tracking-wider mb-2">🌆 Tarde</p>
                    <div className="grid grid-cols-3 gap-2">
                      {tarde.map(s => (
                        <button key={s.hora} onClick={() => setSlotSel(s)}
                          className={`py-2.5 rounded-xl text-sm font-bold border transition-colors
                            ${slotSel?.hora === s.hora
                              ? 'border-[#c9a84c] bg-[#c9a84c]/15 text-[#c9a84c]'
                              : 'border-white/10 bg-[#1a1a1a] text-white/70 hover:border-white/30'}`}>
                          {s.hora}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Botón confirmar */}
            {slotSel && (
              <div className="mt-6 sticky bottom-4">
                {errorMsg && <p className="text-red-400 text-xs text-center mb-2">{errorMsg}</p>}
                <button onClick={confirmar} disabled={submitting}
                  className="w-full bg-[#c9a84c] hover:bg-[#b8962e] disabled:opacity-60 text-black font-black rounded-xl py-4 text-sm transition-colors shadow-lg shadow-[#c9a84c]/20">
                  {submitting ? 'Confirmando…' : `Confirmar — ${slotSel.hora} con ${barberos[barberoIdx]?.nombre}`}
                </button>
              </div>
            )}
          </div>
        )}

        {/* CONFIRMADO */}
        {step === 'confirmado' && slotSel && servicio && (
          <div className="text-center pt-10">
            <div className="text-5xl mb-4">✅</div>
            <h1 className="text-2xl font-black mb-2">¡Turno confirmado!</h1>
            <p className="text-white/60 text-sm mb-6">Te mandamos la confirmación por WhatsApp.</p>
            <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl px-5 py-5 text-left space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-white/40">Servicio</span>
                <span className="font-semibold">✂️ {servicio.nombre}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-white/40">Barbero</span>
                <span className="font-semibold">{barberos[barberoIdx]?.nombre}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-white/40">Fecha</span>
                <span className="font-semibold capitalize">{format(fechas[fechaIdx], "EEEE d 'de' MMMM", { locale: es })}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-white/40">Hora</span>
                <span className="font-semibold text-[#c9a84c] text-base">{slotSel.hora}</span>
              </div>
            </div>
            <p className="text-white/30 text-xs mt-6">Si necesitás cambiar o cancelar, escribinos por WhatsApp. ¡Nos vemos! 💈</p>
          </div>
        )}

      </div>
    </div>
  )
}
