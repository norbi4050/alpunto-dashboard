// components/analytics/nps-trend-chart.tsx
interface Week { label: string; avg: number; count: number }
interface Props { weeks: Week[] }

export function NpsTrendChart({ weeks }: Props) {
  const max = Math.max(...weeks.map(w => w.avg), 5)
  return (
    <div className="bg-[#161b22] border border-[#21262d] rounded-xl p-5">
      <p className="text-xs font-semibold text-[#8b949e] uppercase tracking-wide mb-4">Score semanal (últimas 8 semanas)</p>
      <div className="flex items-end gap-2 h-24">
        {weeks.map(w => (
          <div key={w.label} className="flex-1 flex flex-col items-center gap-1">
            <span className="text-[9px] text-[#8b949e]">{w.count > 0 ? w.avg.toFixed(1) : ''}</span>
            <div className="w-full rounded-t-sm bg-[#4BA3F5] transition-all"
              style={{ height: w.count > 0 ? `${(w.avg / max) * 80}px` : '2px', opacity: w.count > 0 ? 1 : 0.2 }} />
            <span className="text-[9px] text-[#8b949e] truncate w-full text-center">{w.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
