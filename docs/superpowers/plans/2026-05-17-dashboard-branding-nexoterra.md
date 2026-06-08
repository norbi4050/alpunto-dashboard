# Dashboard Branding Nexo Terra — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aplicar identidad visual de Nexo Terra al dashboard: logo en login, sidebar footer y topbar; actualizar colores de marca; favicon.

**Architecture:** Cambios puramente de presentación en 5 archivos. Se usa `next/image` para servir el logo PNG desde `public/`. Los tokens de color se centralizan en `tailwind.config.ts`.

**Tech Stack:** Next.js 14 App Router, Tailwind CSS, `next/image`

---

### Task 1: Tokens de color en Tailwind

**Files:**
- Modify: `tailwind.config.ts`

- [ ] **Step 1: Agregar tokens Nexo Terra y actualizar dash-accent**

Reemplazar en `tailwind.config.ts` la sección de colores custom (líneas 47-58) con:

```ts
// Colores custom del dashboard dark theme
bg: '#0f1117',
surface: '#161b22',
'surface-border': '#21262d',
'border-strong': '#30363d',
'text-muted': '#8b949e',
text: '#e6edf3',
'text-strong': '#f0f6fc',
'dash-accent': '#4BA3F5',   // actualizado: era #58a6ff
success: '#3fb950',
warning: '#d29922',
danger: '#f85149',
// Nexo Terra brand
'nt-navy': '#1B3D8F',
'nt-sky': '#4BA3F5',
```

- [ ] **Step 2: Verificar que el build compila**

```bash
cd C:/Users/noyag/Norberto-Documentos/AlPunto-kit/dashboard
npm run build 2>&1 | tail -20
```

Expected: sin errores de TypeScript.

- [ ] **Step 3: Commit**

```bash
git add tailwind.config.ts
git commit -m "feat(branding): agregar tokens nt-navy y nt-sky, actualizar dash-accent a brand color"
```

---

### Task 2: Branding en Login page

**Files:**
- Modify: `app/login/page.tsx`

**Contexto:** La página de login tiene un div de presentación con emoji 🏥 y el nombre del AlPunto. Se reemplaza el emoji por el logo real de Nexo Terra. El botón de submit cambia de verde a navy.

- [ ] **Step 1: Reemplazar el icono y actualizar el botón en `app/login/page.tsx`**

El archivo completo queda así:

```tsx
'use client'
// app/login/page.tsx
import Image from 'next/image'
import { useFormState, useFormStatus } from 'react-dom'
import { login } from './actions'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending}
      className="w-full bg-[#1B3D8F] hover:bg-[#2251c5] text-white rounded-lg py-2.5 text-sm font-semibold transition-colors disabled:opacity-60">
      {pending ? 'Ingresando…' : 'Ingresar al panel →'}
    </button>
  )
}

export default function LoginPage() {
  const [state, action] = useFormState(login, null)
  return (
    <div className="min-h-screen bg-[#0f1117] flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-[#161b22] border border-[#30363d] rounded-2xl p-8 flex flex-col gap-5">
        <div className="text-center">
          <div className="flex justify-center mb-3">
            <Image src="/nexo-terra-logo.png" alt="Nexo Terra" width={52} height={52} className="object-contain" />
          </div>
          <h1 className="text-lg font-bold text-[#f0f6fc]">
            {process.env.NEXT_PUBLIC_BARBERIA_NOMBRE ?? 'AlPunto'}
          </h1>
          <p className="text-xs text-[#8b949e] mt-1">Panel de Gestión · Acceso restringido</p>
        </div>
        <hr className="border-[#21262d]" />
        <form action={action} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-[#8b949e]">Email</label>
            <input name="email" type="email" required
              className="bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2.5 text-sm text-[#e6edf3] outline-none focus:border-[#4BA3F5] transition-colors"
              placeholder="secretaria@AlPunto.com" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-[#8b949e]">Contraseña</label>
            <input name="password" type="password" required
              className="bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2.5 text-sm text-[#e6edf3] outline-none focus:border-[#4BA3F5] transition-colors" />
          </div>
          {state?.error && <p className="text-xs text-red-400 bg-red-950/30 border border-red-900/40 rounded-lg px-3 py-2">{state.error}</p>}
          <SubmitButton />
        </form>
        <div className="flex items-center justify-center gap-1.5 pt-1">
          <Image src="/nexo-terra-logo.png" alt="" width={10} height={10} className="object-contain brightness-0 invert opacity-25" />
          <span className="text-[9px] text-[#3d444d]">by <span className="text-[#4BA3F5]">Nexo Terra</span></span>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verificar visual — iniciar dev server y abrir `/login`**

```bash
npm run dev
```

Abrir `http://localhost:3000/login` y verificar:
- Se ve el logo PNG de Nexo Terra (no roto)
- Nombre del AlPunto debajo del logo
- Botón azul navy, no verde
- Pequeño "by Nexo Terra" al pie del card

- [ ] **Step 3: Commit**

```bash
git add app/login/page.tsx
git commit -m "feat(branding): logo Nexo Terra en login, botón navy"
```

---

### Task 3: Sidebar header refinado + fila "by Nexo Terra" en footer

**Files:**
- Modify: `components/layout/sidebar.tsx`

**Contexto:** El sidebar tiene un header con el nombre del cliente y un footer con el usuario/logout. Se agrega un logo pequeño al header del cliente y una segunda fila de "by Nexo Terra" debajo del footer existente.

- [ ] **Step 1: Reescribir `components/layout/sidebar.tsx`**

El archivo completo queda así:

```tsx
'use client'
// components/layout/sidebar.tsx
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { logout } from '@/app/login/actions'
import type { UserRole } from '@/lib/types'

const NAV = [
  { href: '/dashboard', label: 'Hoy', icon: '📅', roles: ['dueno','secretaria','medico'] as UserRole[] },
  { href: '/dashboard/semana', label: 'Semana', icon: '📆', roles: ['dueno','secretaria','medico'] as UserRole[] },
  { href: '/dashboard/atenciones', label: 'Atenciones', icon: '🤝', roles: ['dueno','secretaria'] as UserRole[], badge: 'atenciones' },
  { href: '/dashboard/pacientes', label: 'Pacientes', icon: '👥', roles: ['dueno','secretaria'] as UserRole[] },
  { href: '/dashboard/en-vivo', label: 'En vivo', icon: '💬', roles: ['dueno'] as UserRole[], badge: 'enlivo' },
  { href: '/dashboard/analytics', label: 'Analytics', icon: '📊', roles: ['dueno'] as UserRole[] },
]

interface Props {
  role: UserRole
  userName: string
  badges?: { atenciones: number; enlivo: number }
}

export function Sidebar({ role, userName, badges }: Props) {
  const pathname = usePathname()
  const items = NAV.filter(n => n.roles.includes(role))

  return (
    <aside className="w-52 bg-[#161b22] border-r border-[#21262d] flex flex-col flex-shrink-0 h-full">
      {/* Client header */}
      <div className="px-4 py-4 border-b border-[#21262d] flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#1B3D8F] to-[#2563eb] flex items-center justify-content-center flex-shrink-0 flex items-center justify-center">
          <span className="text-sm font-bold text-white">
            {(process.env.NEXT_PUBLIC_BARBERIA_NOMBRE ?? 'C').slice(0, 1)}
          </span>
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-bold text-[#f0f6fc] leading-tight truncate">{process.env.NEXT_PUBLIC_BARBERIA_NOMBRE ?? 'AlPunto'}</p>
          <p className="text-[9px] text-[#8b949e] mt-0.5">Panel de Gestión</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 flex flex-col gap-0.5">
        {items.map(item => {
          const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
          const count = item.badge ? badges?.[item.badge as 'atenciones' | 'enlivo'] ?? 0 : 0
          return (
            <Link key={item.href} href={item.href}
              className={`flex items-center gap-2 px-2 py-2 rounded-lg text-xs transition-colors ${
                active ? 'bg-[#172554] text-[#4BA3F5] font-semibold' : 'text-[#8b949e] hover:bg-[#21262d] hover:text-[#e6edf3]'
              }`}>
              <span className="w-5 text-center text-sm">{item.icon}</span>
              <span className="flex-1">{item.label}</span>
              {count > 0 && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                  item.badge === 'atenciones' ? 'bg-red-600 text-white' : 'bg-[#2ea043] text-white'
                }`}>{count}</span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-[#21262d]">
        {/* User row */}
        <div className="px-4 py-3 flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-[#172554] flex items-center justify-center text-[11px] font-bold text-[#4BA3F5] flex-shrink-0">
            {userName.slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold text-[#e6edf3] truncate">{userName}</p>
            <p className="text-[10px] text-[#8b949e] capitalize">{role === 'dueno' ? 'Dueño' : role === 'secretaria' ? 'Secretaria' : 'Médico'}</p>
          </div>
          <form action={logout}>
            <button type="submit" className="text-[#8b949e] hover:text-[#e6edf3] text-xs transition-colors" title="Cerrar sesión">⎋</button>
          </form>
        </div>
        {/* Nexo Terra brand */}
        <div className="px-4 pb-3 flex items-center gap-1.5">
          <Image src="/nexo-terra-logo.png" alt="" width={13} height={13} className="object-contain brightness-0 invert opacity-25 flex-shrink-0" />
          <span className="text-[9px] text-[#3d444d]">by <span className="text-[#4BA3F5] opacity-60 font-medium">Nexo Terra</span></span>
        </div>
      </div>
    </aside>
  )
}
```

- [ ] **Step 2: Verificar visual**

Con el dev server corriendo, abrir cualquier página del dashboard y verificar:
- Header del sidebar: initial del AlPunto en box navy + nombre cliente
- Nav activo: azul `#4BA3F5` sobre fondo `#172554`
- Footer: usuario arriba, "by Nexo Terra" con logo pequeño abajo

- [ ] **Step 3: Commit**

```bash
git add components/layout/sidebar.tsx
git commit -m "feat(branding): sidebar header con initial box navy + footer by Nexo Terra"
```

---

### Task 4: Logomark Nexo Terra en Topbar

**Files:**
- Modify: `components/layout/topbar.tsx`

**Contexto:** El topbar muestra título y subtitle. Se agrega el logomark de Nexo Terra (pequeño, semi-transparente) en el lado derecho, antes de los `children` de acciones que pasan las páginas.

- [ ] **Step 1: Reescribir `components/layout/topbar.tsx`**

```tsx
// components/layout/topbar.tsx
import Image from 'next/image'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

interface Props {
  title: string
  subtitle?: string
  children?: React.ReactNode
}

export function Topbar({ title, subtitle, children }: Props) {
  const hoy = format(new Date(), "EEEE d 'de' MMMM", { locale: es })
  return (
    <div className="px-6 py-4 border-b border-[#21262d] flex items-center justify-between flex-shrink-0 bg-[#0d1117]">
      <div>
        <h1 className="text-base font-bold text-[#f0f6fc]">{title}</h1>
        <p className="text-xs text-[#8b949e] mt-0.5" suppressHydrationWarning>{subtitle ?? hoy}</p>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5 opacity-40">
          <Image src="/nexo-terra-logo.png" alt="Nexo Terra" width={18} height={18} className="object-contain brightness-0 invert" />
          <span className="text-[10px] text-[#8b949e] font-medium">Nexo Terra</span>
        </div>
        {children && <div className="flex items-center gap-2">{children}</div>}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verificar visual**

Abrir cualquier página del dashboard y confirmar que el topbar muestra el logomark pequeño a la derecha, semi-transparente, sin interferir con los botones de acción de las páginas.

- [ ] **Step 3: Commit**

```bash
git add components/layout/topbar.tsx
git commit -m "feat(branding): logomark Nexo Terra en topbar"
```

---

### Task 5: Favicon en metadata del root layout

**Files:**
- Modify: `app/layout.tsx`

- [ ] **Step 1: Agregar `icons` a metadata**

```tsx
// app/layout.tsx
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: process.env.NEXT_PUBLIC_BARBERIA_NOMBRE ?? 'Panel de Gestión',
  icons: { icon: '/favicon.ico' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="dark">
      <body className={`${inter.className} bg-[#0f1117] text-[#e6edf3]`}>{children}</body>
    </html>
  )
}
```

- [ ] **Step 2: Verificar**

Recargar el browser y confirmar que el favicon de la pestaña es el logo de Nexo Terra (no el genérico de Next.js).

- [ ] **Step 3: Commit final**

```bash
git add app/layout.tsx
git commit -m "feat(branding): favicon Nexo Terra en metadata root layout"
```
