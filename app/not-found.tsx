import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-surface-deep px-6 text-center">
      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-nt-navy to-blue-600 flex items-center justify-center shadow-glow-primary">
        <span className="text-2xl">✂️</span>
      </div>
      <h1 className="text-2xl font-bold text-text-p">Página no encontrada</h1>
      <p className="text-sm text-text-m max-w-sm">
        La página que buscás no existe o fue movida.
      </p>
      <Link href="/dashboard"
        className="mt-2 bg-gradient-to-r from-nt-navy to-blue-600 hover:brightness-110 text-white rounded-lg px-5 py-2.5 text-sm font-semibold transition-all">
        Volver al panel
      </Link>
    </div>
  )
}
