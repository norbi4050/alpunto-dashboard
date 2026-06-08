// components/analytics/bar-chart.tsx
interface Bar { label: string; value: number; maxValue?: number; color: string }
interface Props { title: string; bars: Bar[]; reference?: { label: string; pct: number } }

export function BarChart({ title, bars, reference }: Props) {
  const maxVal = Math.max(...bars.map(b => b.maxValue ?? b.value), reference?.pct ?? 0, 1)

  return (
    <div className="bg-[#161b22] border border-[#21262d] rounded-xl p-5 flex flex-col gap-4">
      <p className="text-xs font-bold text-[#e6edf3]">{title}</p>
      <div className="flex flex-col gap-3">
        {bars.map(b => (
          <div key={b.label} className="flex items-center gap-3">
            <span className="text-[11px] text-[#8b949e] w-24 text-right flex-shrink-0">{b.label}</span>
            <div className="flex-1 h-2.5 bg-[#21262d] rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${b.color}`}
                style={{ width: `${Math.min((b.value / maxVal) * 100, 100)}%` }} />
            </div>
            <span className={`text-[11px] font-bold w-10 ${b.color.replace('bg-', 'text-')}`}>{b.value}</span>
          </div>
        ))}
        {reference && (
          <div className="flex items-center gap-3 opacity-50">
            <span className="text-[11px] text-[#8b949e] w-24 text-right flex-shrink-0">{reference.label}</span>
            <div className="flex-1 h-2.5 bg-[#21262d] rounded-full overflow-hidden">
              <div className="h-full rounded-full bg-red-600" style={{ width: `${(reference.pct / maxVal) * 100}%` }} />
            </div>
            <span className="text-[11px] font-bold text-red-500 w-10">{reference.pct}%</span>
          </div>
        )}
      </div>
    </div>
  )
}
