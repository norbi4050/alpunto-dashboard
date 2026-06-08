// components/analytics/feedback-urgente.tsx
interface UrgentItem {
  id: string
  calificacion: number
  comentario: string | null
  created_at: string
}

interface Props { items: UrgentItem[] }

export function FeedbackUrgente({ items }: Props) {
  if (!items.length) return null
  return (
    <div className="bg-[#161b22] border border-red-900/40 rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-red-900/40 bg-red-950/20 flex items-center gap-2">
        <span className="text-red-400 text-sm">⚠</span>
        <p className="text-xs font-semibold text-red-400 uppercase tracking-wide">Feedback urgente — últimos 7 días</p>
      </div>
      <div className="divide-y divide-[#21262d]">
        {items.map(item => (
          <div key={item.id} className="px-5 py-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-red-400 font-bold text-sm">{'★'.repeat(item.calificacion)}{'☆'.repeat(5 - item.calificacion)}</span>
              <span className="text-[11px] text-[#8b949e]">{new Date(item.created_at).toLocaleDateString('es-AR')}</span>
            </div>
            {item.comentario && <p className="text-sm text-[#e6edf3] leading-relaxed">{item.comentario}</p>}
          </div>
        ))}
      </div>
    </div>
  )
}
