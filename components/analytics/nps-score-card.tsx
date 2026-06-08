// components/analytics/nps-score-card.tsx
interface Props {
  score: number
  count: number
  tendencia: number
}

export function NpsScoreCard({ score, count, tendencia }: Props) {
  const diff = score - tendencia
  const hasData = count > 0
  return (
    <div className="bg-[#161b22] border border-[#21262d] rounded-xl p-5 flex items-center gap-5">
      <div className="flex flex-col items-center justify-center w-20 h-20 rounded-full bg-[#0d1117] border-2 border-[#30363d] flex-shrink-0">
        <span className="text-3xl font-bold text-[#f0f6fc]">{hasData ? score.toFixed(1) : '—'}</span>
        <span className="text-[10px] text-[#8b949e]">/ 5</span>
      </div>
      <div className="flex-1">
        <p className="text-sm font-semibold text-[#f0f6fc]">Satisfacción de pacientes</p>
        <p className="text-xs text-[#8b949e] mt-0.5">{count} respuesta{count !== 1 ? 's' : ''} este mes</p>
        {hasData && tendencia > 0 && (
          <p className={`text-xs mt-1 font-medium ${diff >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {diff >= 0 ? '↑' : '↓'} {Math.abs(diff).toFixed(1)} vs. mes anterior
          </p>
        )}
      </div>
    </div>
  )
}
