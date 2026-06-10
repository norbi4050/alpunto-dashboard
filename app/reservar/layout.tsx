'use client'
import { useEffect } from 'react'

// Fuerza modo claro en /reservar — no hereda el dark del dashboard
export default function ReservarLayout({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const html = document.documentElement
    const prev = html.className
    html.classList.remove('dark')
    html.classList.add('light')
    document.body.style.background = '#f7f6f2'
    return () => {
      html.className = prev
      document.body.style.background = ''
    }
  }, [])

  return <>{children}</>
}
