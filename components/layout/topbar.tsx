// components/layout/topbar.tsx
import { ThemeToggle } from './theme-toggle'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

interface Props {
  title: string
  subtitle?: string
  children?: React.ReactNode
}

export function Topbar({ title, subtitle, children }: Props) {
  const defaultSub = format(new Date(), "EEEE d 'de' MMMM", { locale: es })
  const sub = subtitle ?? defaultSub

  return (
    <header className="h-16 flex-shrink-0 border-b border-outline-variant bg-surface-container-low flex items-center px-6 gap-4">
      <div className="flex-1 min-w-0">
        <h1 className="text-sm font-bold text-text-p leading-tight truncate">{title}</h1>
        <p className="text-[11px] text-text-m mt-0.5 truncate" suppressHydrationWarning>{sub}</p>
      </div>
      {children && (
        <div className="flex items-center gap-2 flex-shrink-0">
          {children}
        </div>
      )}
      <ThemeToggle />
    </header>
  )
}
