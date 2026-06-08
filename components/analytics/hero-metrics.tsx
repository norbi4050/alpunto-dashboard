// components/analytics/hero-metrics.tsx
interface HeroMetric { label: string; value: string | number; sub: string; color: string; borderColor: string }
interface Props { metrics: HeroMetric[] }

export function HeroMetrics({ metrics }: Props) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {metrics.map(m => (
        <div key={m.label} className={`bg-dp-bg-card border ${m.borderColor} rounded-xl p-5 flex flex-col gap-2`}>
          <p className="text-[11px] font-semibold text-dp-text-muted uppercase tracking-wider">{m.label}</p>
          <p className={`text-4xl font-black leading-none ${m.color}`}>{m.value}</p>
          <p className="text-xs text-[#8b949e]">{m.sub}</p>
        </div>
      ))}
    </div>
  )
}
