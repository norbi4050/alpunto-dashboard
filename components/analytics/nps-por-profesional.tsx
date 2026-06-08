// components/analytics/nps-por-profesional.tsx
interface ProfRow { nombre: string; especialidad: string; avg: number; count: number }
interface Props { rows: ProfRow[] }

export function NpsPorProfesional({ rows }: Props) {
  if (!rows.length) return null
  return (
    <div className="bg-[#161b22] border border-[#21262d] rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-[#21262d]">
        <p className="text-xs font-semibold text-[#8b949e] uppercase tracking-wide">NPS por profesional</p>
      </div>
      <table className="w-full">
        <thead>
          <tr className="bg-[#0d1117] text-[11px] text-[#8b949e] uppercase tracking-wide">
            <th className="text-left px-5 py-2">Profesional</th>
            <th className="text-right px-5 py-2">Score</th>
            <th className="text-right px-5 py-2">Respuestas</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.nombre} className="border-t border-[#21262d]">
              <td className="px-5 py-2.5">
                <p className="text-sm text-[#e6edf3] font-medium">{r.nombre}</p>
                <p className="text-[11px] text-[#8b949e]">{r.especialidad}</p>
              </td>
              <td className="px-5 py-2.5 text-right">
                <span className={`text-sm font-bold ${r.avg >= 4 ? 'text-green-400' : r.avg >= 3 ? 'text-yellow-400' : 'text-red-400'}`}>
                  {r.avg.toFixed(1)}
                </span>
              </td>
              <td className="px-5 py-2.5 text-right text-sm text-[#8b949e]">{r.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
