// components/analytics/roi-card.tsx
interface Props { roi: number; turnos: number; valorConsulta: number; costoMensual: number }

export function RoiCard({ roi, turnos, valorConsulta, costoMensual }: Props) {
  return (
    <div className="bg-gradient-to-r from-green-950/50 to-blue-950/50 border border-green-800/40 rounded-2xl p-5 flex items-center justify-between gap-4">
      <div className="flex flex-col gap-1">
        <span className="text-[10px] font-bold text-green-400 uppercase tracking-widest">⭐ Métrica principal</span>
        <h3 className="text-sm font-bold text-[#f0f6fc]">Retorno de inversión del sistema</h3>
        <p className="text-xs text-[#8b949e]">
          {turnos} turnos recuperados × ${valorConsulta.toLocaleString('es-AR')} / ${costoMensual.toLocaleString('es-AR')} costo mensual
        </p>
      </div>
      <div className="text-right flex-shrink-0">
        <p className="text-5xl font-black text-green-400 leading-none">
          <span className="text-2xl">x</span>{roi}
        </p>
        <p className="text-[11px] text-[#8b949e] mt-1">
          ${(turnos * valorConsulta).toLocaleString('es-AR')} recuperados
        </p>
      </div>
    </div>
  )
}
