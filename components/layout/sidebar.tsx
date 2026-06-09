'use client'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { logout } from '@/app/login/actions'
import { createClient } from '@/lib/supabase/client'
import type { UserRole } from '@/lib/types'

const NAV = [
  { href: '/dashboard',                  label: 'Hoy',            icon: '📅', roles: ['dueno','admin'] as UserRole[] },
  { href: '/dashboard/semana',           label: 'Semana',         icon: '📆', roles: ['dueno','admin'] as UserRole[] },
  { href: '/dashboard/atenciones',       label: 'Atenciones',     icon: '🤝', roles: ['dueno','admin'] as UserRole[], badge: 'atenciones' },
  { href: '/dashboard/clientes',         label: 'Clientes',       icon: '👥', roles: ['dueno','admin'] as UserRole[] },
  { href: '/dashboard/conversaciones',   label: 'Conversaciones', icon: '💬', roles: ['dueno','admin'] as UserRole[], badge: 'enlivo' },
  { href: '/dashboard/analytics',        label: 'Reportes',       icon: '📊', roles: ['dueno','admin'] as UserRole[] },
  { href: '/dashboard/configuracion',    label: 'Configuración',  icon: '⚙️', roles: ['dueno','admin'] as UserRole[] },
]

interface Props {
  role: UserRole
  userName: string
  badges?: { atenciones: number; enlivo: number }
}

export function Sidebar({ role, userName, badges }: Props) {
  const pathname = usePathname()
  const pathnameRef = useRef(pathname)
  const lastSeenRef = useRef<string>(
    typeof window !== 'undefined'
      ? (localStorage.getItem('conv_last_seen') ?? new Date(0).toISOString())
      : new Date(0).toISOString()
  )
  const items = NAV.filter(n => n.roles.includes(role))
  const [badgeCounts, setBadgeCounts] = useState(badges ?? { atenciones: 0, enlivo: 0 })

  useEffect(() => { pathnameRef.current = pathname }, [pathname])

  // When user visits conversaciones, mark current moment as "seen"
  useEffect(() => {
    if (pathname.startsWith('/dashboard/conversaciones')) {
      const now = new Date().toISOString()
      lastSeenRef.current = now
      localStorage.setItem('conv_last_seen', now)
      setBadgeCounts(prev => ({ ...prev, enlivo: 0 }))
    }
  }, [pathname])

  useEffect(() => {
    const supabase = createClient()
    const fetchCounts = async () => {
      const [{ count: aten }, { count: enlivo }] = await Promise.all([
        supabase.from('conversaciones').select('*', { count: 'exact', head: true }).eq('handoff_humano', true),
        supabase.from('conversaciones').select('*', { count: 'exact', head: true })
          .neq('estado', 'inicio')
          .gt('updated_at', lastSeenRef.current),
      ])
      if (pathnameRef.current.startsWith('/dashboard/conversaciones')) {
        setBadgeCounts({ atenciones: aten ?? 0, enlivo: 0 })
      } else {
        setBadgeCounts({ atenciones: aten ?? 0, enlivo: enlivo ?? 0 })
      }
    }
    void fetchCounts()
    const channel = supabase.channel('sidebar-badges')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversaciones' }, () => { void fetchCounts() })
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [])

  const roleLabel = role === 'dueno' ? 'Dueño' : 'Admin'

  return (
    <aside className="w-14 md:w-52 bg-surface-deep border-r border-outline-variant flex flex-col flex-shrink-0 h-full transition-all">
      {/* Brand header */}
      <div className="px-3 md:px-4 py-3.5 border-b border-outline-variant flex items-center justify-center md:justify-start gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-nt-navy to-blue-600 flex items-center justify-center flex-shrink-0 shadow-glow-primary">
          <span className="text-sm font-bold text-white">
            {(process.env.NEXT_PUBLIC_BARBERIA_NOMBRE ?? 'C').slice(0, 1)}
          </span>
        </div>
        <div className="min-w-0 hidden md:block">
          <p className="text-[11px] font-bold text-text-p leading-tight truncate">
            {process.env.NEXT_PUBLIC_BARBERIA_NOMBRE ?? 'AlPunto'}
          </p>
          <p className="text-[9px] text-text-m mt-0.5">Panel de Gestión</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 flex flex-col gap-0.5 overflow-y-auto">
        {items.map(item => {
          const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
          const count = active ? 0 : (item.badge ? badgeCounts[item.badge as keyof typeof badgeCounts] ?? 0 : 0)
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              title={item.label}
              className={`relative flex items-center justify-center md:justify-start gap-2 px-2.5 py-2 rounded-lg text-xs transition-all ${
                active
                  ? 'bg-surface-container-high border-l-[3px] border-stitch-primary text-stitch-primary font-semibold'
                  : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface border-l-[3px] border-transparent'
              }`}
            >
              <span className="w-4 text-center text-sm leading-none">{item.icon}</span>
              <span className="flex-1 hidden md:block">{item.label}</span>
              {count > 0 && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full absolute top-0.5 right-0.5 md:static ${
                  item.badge === 'atenciones'
                    ? 'bg-se-bg text-se-text border border-border-error'
                    : 'bg-ss-bg text-ss-text border border-border-success'
                }`}>{count}</span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-outline-variant">
        <div className="px-3 py-3 flex flex-col md:flex-row items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-surface-container-high border border-border-primary flex items-center justify-center text-[11px] font-bold text-stitch-primary flex-shrink-0">
            {userName.slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0 hidden md:block">
            <p className="text-[11px] font-semibold text-text-p truncate">{userName}</p>
            <p className="text-[10px] text-text-m">{roleLabel}</p>
          </div>
          <form action={logout}>
            <button type="submit" title="Cerrar sesión" aria-label="Cerrar sesión" className="text-text-m hover:text-on-surface text-xs transition-colors">⎋</button>
          </form>
        </div>
        <div className="px-4 pb-3 items-center gap-1 hidden md:flex">
          <span className="text-[9px] text-text-m">by <span className="text-nt-sky/60 font-medium">Nexo Terra</span></span>
        </div>
      </div>
    </aside>
  )
}
