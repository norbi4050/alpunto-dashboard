'use client'

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-surface-deep px-6 text-center">
      <div className="w-14 h-14 rounded-2xl bg-surface-card border border-border-error flex items-center justify-center">
        <span className="text-2xl">⚠️</span>
      </div>
      <h1 className="text-2xl font-bold text-text-p">Algo salió mal</h1>
      <p className="text-sm text-text-m max-w-sm">
        Ocurrió un error inesperado. Probá de nuevo; si sigue pasando, avisanos.
      </p>
      <button onClick={reset}
        className="mt-2 bg-gradient-to-r from-nt-navy to-blue-600 hover:brightness-110 text-white rounded-lg px-5 py-2.5 text-sm font-semibold transition-all">
        Reintentar
      </button>
    </div>
  )
}
