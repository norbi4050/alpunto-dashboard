'use client'
import Image from 'next/image'
import { useState, useEffect } from 'react'
import { addDays, format } from 'date-fns'
import { es } from 'date-fns/locale'
import { DayPicker } from 'react-day-picker'
import 'react-day-picker/style.css'

interface Barbero { id: string; nombre: string; color: string }
interface Servicio { id: string; nombre: string; precio: number; duracion_min: number }
interface Slot { hora: string; fechaHora: string }

type Step = 'loading' | 'error' | 'para_quien' | 'servicio' | 'datos' | 'horario' | 'confirmado'

const DIAS_SHORT = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']

function fmtPrecio(n: number | null) {
  if (!n) return ''
  return `$${n.toLocaleString('es-AR')}`
}

// Auto-formatea a DD/MM/AAAA mientras el usuario tipea
function autoFormatFecha(val: string) {
  const d = val.replace(/\D/g, '')
  if (d.length <= 2) return d
  if (d.length <= 4) return `${d.slice(0,2)}/${d.slice(2)}`
  return `${d.slice(0,2)}/${d.slice(2,4)}/${d.slice(4,8)}`
}

// Convierte DD/MM/AAAA → AAAA-MM-DD para Supabase
function fechaToISO(val: string) {
  const p = val.split('/')
  if (p.length !== 3 || p[2].length !== 4) return ''
  return `${p[2]}-${p[1]}-${p[0]}`
}

export function ReservarFlow({ token }: { token?: string }) {
  const [step, setStep]             = useState<Step>('loading')
  const [errorMsg, setErrorMsg]     = useState('')
  const [tipo, setTipo]             = useState<'token'|'directo'>('directo')

  const [servicios, setServicios]   = useState<Servicio[]>([])
  const [servicio, setServicio]     = useState<{ id?: string; nombre: string; duracion: number; precio?: number } | null>(null)

  const [barberos, setBarberos]     = useState<Barbero[]>([])

  // Datos del cliente original (token holder)
  const [nombre, setNombre]         = useState('')
  const [cumpleanos, setCumpleanos] = useState('')       // DD/MM/AAAA
  const [cumpleDate, setCumpleDate] = useState<Date | undefined>()
  const [showCumplePicker, setShowCumplePicker] = useState(false)
  const [nombrePrefill, setNombrePrefill] = useState(false)
  const [telefonoDirecto, setTelefonoDirecto] = useState('') // solo flujo directo (sin token)

  // "Para alguien más"
  const [paraOtro, setParaOtro]         = useState(false)
  const [nombreOtro, setNombreOtro]     = useState('')
  const [telefonoOtro, setTelefonoOtro] = useState('')

  const [barberoIdx, setBarberoIdx] = useState(0)
  const [fechas, setFechas]         = useState<Date[]>([])
  const [fechaIdx, setFechaIdx]     = useState(0)
  const [slots, setSlots]           = useState<Slot[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [slotSel, setSlotSel]       = useState<Slot | null>(null)

  const [submitting, setSubmitting] = useState(false)

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
            if (d.clienteExistente.fecha_nacimiento) {
              // fecha_nacimiento llega como AAAA-MM-DD desde Supabase
              const p = d.clienteExistente.fecha_nacimiento.split('-')
              if (p.length === 3) {
                const date = new Date(parseInt(p[0]), parseInt(p[1]) - 1, parseInt(p[2]))
                setCumpleDate(date)
                setCumpleanos(`${p[2]}/${p[1]}/${p[0]}`)
              }
            }
          }
        } else {
          setServicios(d.servicios ?? [])
        }

        // Ambos flujos pasan por "para quién"
        setStep('para_quien')

        const arr: Date[] = []
        for (let i = 0; arr.length < 7; i++) {
          const d2 = addDays(new Date(), i)
          if (d2.getDay() !== 0) arr.push(d2)
        }
        setFechas(arr)
      })
      .catch(() => { setErrorMsg('No se pudo cargar la página. Intentá más tarde.'); setStep('error') })
  }, [token])

  // Cargar slots cuando cambia barbero o fecha
  useEffect(() => {
    if (step !== 'horario' || !barberos[barberoIdx] || !fechas[fechaIdx] || !servicio) return
    setLoadingSlots(true)
    setSlotSel(null)
    const fecha = format(fechas[fechaIdx], 'yyyy-MM-dd')
    fetch(`/api/reservar/slots?barbero_id=${barberos[barberoIdx].id}&fecha=${fecha}`)
      .then(r => r.json())
      .then(d => { setSlots(d.slots ?? []); setLoadingSlots(false) })
      .catch(() => setLoadingSlots(false))
  }, [step, barberoIdx, fechaIdx, barberos, fechas, servicio])

  // Confirmar turno
  async function confirmar() {
    if (!slotSel || !servicio || !barberos[barberoIdx]) return
    setSubmitting(true)
    setErrorMsg('')

    const nombreFinal   = paraOtro ? nombreOtro.trim() : nombre
    // Teléfono para la notificación WA:
    // - directo + para mí: el que ingresó
    // - directo + para otro con tel: tel del otro
    // - token + para otro con tel: tel del otro
    // - token + para otro sin tel: null (el backend usa el del token)
    let telefonoBody: string | undefined
    if (tipo === 'directo') {
      telefonoBody = paraOtro
        ? (telefonoOtro.trim() ? telefonoOtro.replace(/\D/g, '') : telefonoDirecto.replace(/\D/g, ''))
        : telefonoDirecto.replace(/\D/g, '')
    } else {
      telefonoBody = paraOtro && telefonoOtro.trim()
        ? telefonoOtro.replace(/\D/g, '')
        : undefined
    }

    const res = await fetch('/api/reservar/confirmar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        nombre: nombreFinal,
        telefono: telefonoBody,
        cumpleanos: !paraOtro && cumpleanos ? fechaToISO(cumpleanos) : undefined,
        para_otro: paraOtro,
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

  // Helpers de validación
  const datosOtroValidos = nombreOtro.trim().length > 0
  const datosDirectosValidos = nombre.trim() && telefonoDirecto.trim()

  return (
    <div className="min-h-screen bg-[#f7f6f2] flex flex-col" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-5 flex flex-col items-center">
        <Image
          src="/logo-alpunto.jpeg"
          alt="AlPunto Barbería"
          width={96}
          height={96}
          className="rounded-full mb-2"
          priority
        />
        <p className="text-xs text-gray-400 tracking-widest uppercase font-medium">Reservá tu turno</p>
      </header>

      <div className="flex-1 px-4 py-6 max-w-lg mx-auto w-full">

        {/* LOADING */}
        {step === 'loading' && (
          <div className="flex justify-center pt-16">
            <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-800 rounded-full animate-spin" />
          </div>
        )}

        {/* ERROR */}
        {step === 'error' && (
          <div className="text-center pt-12">
            <p className="text-4xl mb-4">⏳</p>
            <p className="font-semibold text-gray-700">{errorMsg}</p>
            <p className="text-sm text-gray-400 mt-2">Escribinos por WhatsApp para sacar un nuevo turno.</p>
          </div>
        )}

        {/* PASO: ¿PARA QUIÉN ES EL TURNO? */}
        {step === 'para_quien' && (
          <div>
            <h1 className="text-xl font-bold text-gray-900 mb-1">¿Para quién es el turno?</h1>
            <p className="text-gray-400 text-sm mb-6">Elegí una opción para continuar.</p>
            <div className="space-y-3">
              <button
                onClick={() => {
                  setParaOtro(false)
                  if (tipo === 'token') {
                    // Si ya lo conocemos → saltar directo al horario
                    if (nombrePrefill) {
                      setStep(tipo === 'token' ? 'horario' : 'datos')
                    } else {
                      setStep('datos')
                    }
                  } else {
                    // Flujo directo: necesitamos sus datos
                    setStep(servicios.length > 0 && !servicio ? 'servicio' : 'datos')
                  }
                }}
                className="w-full bg-white hover:bg-gray-50 border border-gray-300 hover:border-gray-500 rounded-2xl px-5 py-4 text-left flex items-center gap-4 transition-all shadow-sm"
              >
                <span className="text-2xl flex-shrink-0">👤</span>
                <div>
                  <p className="font-semibold text-gray-900 text-sm">Para mí</p>
                  {nombrePrefill
                    ? <p className="text-gray-400 text-xs mt-0.5">Hola {nombre} — te llevamos directo al horario ✓</p>
                    : <p className="text-gray-400 text-xs mt-0.5">Reserva a tu nombre</p>
                  }
                </div>
              </button>

              <button
                onClick={() => {
                  setParaOtro(true)
                  if (tipo === 'directo' && !servicio) setStep('servicio')
                  else setStep('datos')
                }}
                className="w-full bg-white hover:bg-gray-50 border border-gray-300 hover:border-gray-500 rounded-2xl px-5 py-4 text-left flex items-center gap-4 transition-all shadow-sm"
              >
                <span className="text-2xl flex-shrink-0">👥</span>
                <div>
                  <p className="font-semibold text-gray-900 text-sm">Para alguien más</p>
                  <p className="text-gray-400 text-xs mt-0.5">Indicá el nombre y número de quien va</p>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* SELECCIÓN DE SERVICIO (flujo directo) */}
        {step === 'servicio' && (
          <div>
            <h1 className="text-xl font-bold text-gray-900 mb-1">¿Qué servicio querés?</h1>
            <p className="text-gray-400 text-sm mb-5">Elegí el servicio para ver la disponibilidad.</p>
            <div className="space-y-2.5">
              {servicios.map(s => (
                <button
                  key={s.id}
                  onClick={() => {
                    setServicio({ id: s.id, nombre: s.nombre, duracion: s.duracion_min, precio: s.precio })
                    setStep(paraOtro ? 'datos' : 'datos')
                  }}
                  className="w-full bg-white hover:bg-gray-50 border border-gray-300 hover:border-gray-500 rounded-2xl px-4 py-4 text-left flex items-center justify-between transition-all shadow-sm"
                >
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{s.nombre}</p>
                    <p className="text-gray-400 text-xs mt-0.5">40 min</p>
                  </div>
                  <span className="text-[#c9a84c] font-bold text-sm">{fmtPrecio(s.precio)}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* DATOS */}
        {step === 'datos' && (
          <div>
            <h1 className="text-xl font-bold text-gray-900 mb-1">
              {paraOtro ? 'Datos de quien va' : 'Tus datos'}
            </h1>
            <p className="text-gray-400 text-sm mb-5">
              {paraOtro
                ? 'Completá los datos de la persona que va al turno.'
                : (nombrePrefill ? 'Confirmá tu nombre para continuar.' : 'Completá tus datos para reservar.')}
            </p>

            {paraOtro ? (
              /* ── Datos de OTRA persona ── */
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1.5">Nombre completo *</label>
                  <input
                    type="text"
                    value={nombreOtro}
                    onChange={e => setNombreOtro(e.target.value)}
                    placeholder="Nombre de quien va"
                    autoFocus
                    className="w-full bg-white border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 outline-none focus:border-gray-900 transition-colors placeholder:text-gray-300 shadow-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1">
                    WhatsApp <span className="text-gray-300 font-normal">(opcional)</span>
                  </label>
                  <p className="text-[11px] text-gray-400 mb-1.5">Si no lo tenés, te mandamos la confirmación a vos</p>
                  <input
                    type="tel"
                    value={telefonoOtro}
                    onChange={e => setTelefonoOtro(e.target.value)}
                    placeholder="Ej: 3755 123456"
                    className="w-full bg-white border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 outline-none focus:border-gray-900 transition-colors placeholder:text-gray-300 shadow-sm"
                  />
                </div>
                <div className="flex gap-3 mt-2">
                  <button
                    onClick={() => setStep('para_quien')}
                    className="px-4 py-3 rounded-xl border border-gray-300 text-gray-500 text-sm font-medium hover:bg-gray-50 transition-colors"
                  >
                    ← Volver
                  </button>
                  <button
                    onClick={() => { if (datosOtroValidos) setStep('horario') }}
                    disabled={!datosOtroValidos}
                    className="flex-1 bg-gray-900 hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed text-white font-bold rounded-xl py-3 text-sm transition-colors"
                  >
                    Elegir horario →
                  </button>
                </div>
              </div>
            ) : (
              /* ── Datos propios ── */
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1.5">Nombre completo *</label>
                  <input
                    type="text"
                    value={nombre}
                    onChange={e => setNombre(e.target.value)}
                    placeholder="Ej: Juan García"
                    className="w-full bg-white border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 outline-none focus:border-gray-900 transition-colors placeholder:text-gray-300 shadow-sm"
                  />
                </div>
                {tipo === 'directo' && (
                  <div>
                    <label className="text-xs font-semibold text-gray-500 block mb-1.5">WhatsApp *</label>
                    <input
                      type="tel"
                      value={telefonoDirecto}
                      onChange={e => setTelefonoDirecto(e.target.value)}
                      placeholder="Ej: 3755 123456"
                      className="w-full bg-white border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 outline-none focus:border-gray-900 transition-colors placeholder:text-gray-300 shadow-sm"
                    />
                  </div>
                )}
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1">
                    Fecha de cumpleaños <span className="text-gray-300 font-normal">(opcional)</span>
                  </label>
                  <p className="text-[11px] text-[#c9a84c] font-medium mb-1.5">🎁 En tu cumpleaños te regalamos un corte gratis</p>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowCumplePicker(v => !v)}
                      className="w-full bg-white border border-gray-300 rounded-xl px-4 py-3 text-sm text-left flex items-center justify-between shadow-sm hover:border-gray-500 transition-colors"
                    >
                      <span className={cumpleanos ? 'text-gray-700' : 'text-gray-300'}>
                        {cumpleanos || 'DD/MM/AAAA'}
                      </span>
                      <span className="text-gray-400 text-base">📅</span>
                    </button>
                    {showCumplePicker && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setShowCumplePicker(false)} />
                        <div className="absolute z-50 top-full mt-2 left-0 right-0 bg-white border border-gray-200 rounded-2xl shadow-xl overflow-hidden">
                          <DayPicker
                            mode="single"
                            captionLayout="dropdown"
                            startMonth={new Date(1940, 0)}
                            endMonth={new Date()}
                            defaultMonth={cumpleDate ?? new Date(2000, 0)}
                            selected={cumpleDate}
                            locale={es}
                            onSelect={(date) => {
                              if (!date) return
                              setCumpleDate(date)
                              setCumpleanos(format(date, 'dd/MM/yyyy'))
                              setShowCumplePicker(false)
                            }}
                          />
                        </div>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex gap-3 mt-2">
                  <button
                    onClick={() => setStep('para_quien')}
                    className="px-4 py-3 rounded-xl border border-gray-300 text-gray-500 text-sm font-medium hover:bg-gray-50 transition-colors"
                  >
                    ← Volver
                  </button>
                  <button
                    onClick={() => { if (nombre.trim() && (tipo === 'token' || telefonoDirecto.trim())) setStep('horario') }}
                    disabled={!nombre.trim() || (tipo === 'directo' && !telefonoDirecto.trim())}
                    className="flex-1 bg-gray-900 hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed text-white font-bold rounded-xl py-3 text-sm transition-colors"
                  >
                    Elegir horario →
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* SELECCIÓN DE HORARIO */}
        {step === 'horario' && servicio && (
          <div>
            {/* Servicio seleccionado */}
            <div className="bg-white border border-gray-200 rounded-2xl px-4 py-3 mb-5 flex items-center justify-between shadow-sm">
              <div>
                <p className="font-semibold text-gray-900 text-sm">✂️ {servicio.nombre}</p>
                <p className="text-gray-400 text-xs mt-0.5">
                  40 min{servicio.precio ? ` · ${fmtPrecio(servicio.precio)}` : ''}
                </p>
              </div>
              {tipo === 'directo' && (
                <button
                  onClick={() => { setStep('servicio'); setSlotSel(null) }}
                  className="text-xs text-gray-400 hover:text-gray-700 transition-colors border border-gray-200 rounded-lg px-2.5 py-1"
                >
                  cambiar
                </button>
              )}
            </div>

            {/* Para quién es */}
            {paraOtro && (
              <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-2.5 mb-4 flex items-center gap-2">
                <span className="text-sm">👥</span>
                <p className="text-xs text-blue-700 font-medium">Turno para <strong>{nombreOtro}</strong></p>
              </div>
            )}

            {/* Tabs de barbero */}
            <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
              {barberos.map((b, i) => (
                <button
                  key={b.id}
                  onClick={() => { setBarberoIdx(i); setSlotSel(null) }}
                  className={`flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold border transition-all shadow-sm
                    ${barberoIdx === i
                      ? 'border-gray-900 bg-gray-900 text-white'
                      : 'border-gray-300 bg-white text-gray-500 hover:border-gray-600'}`}
                >
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: b.color }} />
                  {b.nombre}
                </button>
              ))}
            </div>

            {/* Selector de fechas */}
            <div className="flex gap-2 overflow-x-auto pb-1 mb-5">
              {fechas.map((d, i) => (
                <button
                  key={i}
                  onClick={() => { setFechaIdx(i); setSlotSel(null) }}
                  className={`flex-shrink-0 flex flex-col items-center px-3 py-2.5 rounded-xl border text-xs transition-all shadow-sm
                    ${fechaIdx === i
                      ? 'border-gray-900 bg-gray-900 text-white'
                      : 'border-gray-300 bg-white text-gray-500 hover:border-gray-600'}`}
                >
                  <span className="font-semibold text-[10px] uppercase opacity-70">{DIAS_SHORT[d.getDay()]}</span>
                  <span className="font-black text-lg leading-tight">{d.getDate()}</span>
                  <span className="text-[10px] opacity-70">{format(d, 'MMM', { locale: es })}</span>
                </button>
              ))}
            </div>

            {/* Slots */}
            {loadingSlots ? (
              <div className="flex justify-center py-8">
                <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-800 rounded-full animate-spin" />
              </div>
            ) : slots.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-8">Sin disponibilidad este día. Probá otro día o barbero.</p>
            ) : (
              <div className="space-y-4">
                {manana.length > 0 && (
                  <div>
                    <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">☀️ Mañana</p>
                    <div className="grid grid-cols-3 gap-2">
                      {manana.map(s => (
                        <button key={s.hora} onClick={() => setSlotSel(s)}
                          className={`py-2.5 rounded-xl text-sm font-bold border transition-all shadow-sm
                            ${slotSel?.hora === s.hora
                              ? 'border-gray-900 bg-gray-900 text-white'
                              : 'border-gray-300 bg-white text-gray-700 hover:border-gray-600'}`}>
                          {s.hora}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {tarde.length > 0 && (
                  <div>
                    <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">🌆 Tarde</p>
                    <div className="grid grid-cols-3 gap-2">
                      {tarde.map(s => (
                        <button key={s.hora} onClick={() => setSlotSel(s)}
                          className={`py-2.5 rounded-xl text-sm font-bold border transition-all shadow-sm
                            ${slotSel?.hora === s.hora
                              ? 'border-gray-900 bg-gray-900 text-white'
                              : 'border-gray-300 bg-white text-gray-700 hover:border-gray-600'}`}>
                          {s.hora}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Confirmar */}
            {slotSel && (
              <div className="mt-6 sticky bottom-4">
                {errorMsg && <p className="text-red-500 text-xs text-center mb-2">{errorMsg}</p>}
                <button onClick={confirmar} disabled={submitting}
                  className="w-full bg-gray-900 hover:bg-gray-800 disabled:opacity-60 text-white font-black rounded-xl py-4 text-sm transition-colors shadow-lg">
                  {submitting ? 'Confirmando…' : `Confirmar — ${slotSel.hora} con ${barberos[barberoIdx]?.nombre}`}
                </button>
              </div>
            )}
          </div>
        )}

        {/* CONFIRMADO */}
        {step === 'confirmado' && slotSel && servicio && (
          <div className="text-center pt-8">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">✅</div>
            <h1 className="text-2xl font-black text-gray-900 mb-2">¡Turno confirmado!</h1>
            <p className="text-gray-400 text-sm mb-6">
              {paraOtro
                ? `Confirmación enviada${telefonoOtro.trim() ? ` al WhatsApp de ${nombreOtro}` : ' a tu WhatsApp'}.`
                : 'Te mandamos la confirmación por WhatsApp.'}
            </p>
            <div className="bg-white border border-gray-200 rounded-2xl px-5 py-5 text-left space-y-3.5 shadow-sm">
              {paraOtro && (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Para</span>
                    <span className="font-semibold text-gray-900">👥 {nombreOtro}</span>
                  </div>
                  <div className="h-px bg-gray-100" />
                </>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Servicio</span>
                <span className="font-semibold text-gray-900">✂️ {servicio.nombre}</span>
              </div>
              <div className="h-px bg-gray-100" />
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Barbero</span>
                <span className="font-semibold text-gray-900">{barberos[barberoIdx]?.nombre}</span>
              </div>
              <div className="h-px bg-gray-100" />
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Fecha</span>
                <span className="font-semibold text-gray-900 capitalize">
                  {format(fechas[fechaIdx], "EEEE d 'de' MMMM", { locale: es })}
                </span>
              </div>
              <div className="h-px bg-gray-100" />
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Hora</span>
                <span className="font-black text-gray-900 text-base">{slotSel.hora}</span>
              </div>
            </div>
            <p className="text-gray-300 text-xs mt-6">Si necesitás cambiar o cancelar, escribinos por WhatsApp. ¡Nos vemos! 💈</p>
          </div>
        )}

      </div>

      <div className="text-center py-4 pb-6">
        <p className="text-[10px] text-gray-300">by <span className="font-medium">Nexo Terra</span></p>
      </div>
    </div>
  )
}
