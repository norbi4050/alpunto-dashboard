// components/layout/topbar.tsx
'use client'
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
    <header className="h-14 md:h-16 flex-shrink-0 border-b border-outline-variant bg-surface-container-low flex items-center px-3 md:px-6 gap-3">
      {/* Hamburger — solo mobile */}
      <button
        className="md:hidden flex items-center justify-center w-9 h-9 rounded-lg text-text-m hover:bg-surface-container transition-colors flex-shrink-0"
        onClick={() => window.dispatchEvent(new CustomEvent('barber:open-menu'))}
        aria-label="Menú"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <rect y="2" width="18" height="2" rx="1" fill="currentColor"/>
          <rect y="8" width="18" height="2" rx="1" fill="currentColor"/>
          <rect y="14" width="18" height="2" rx="1" fill="currentColor"/>
        </svg>
      </button>

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
