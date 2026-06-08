'use server'
// app/login/actions.ts
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function login(_: unknown, formData: FormData): Promise<{ error: string } | never> {
  const email = formData.get('email')
  const password = formData.get('password')
  if (!email || !password) return { error: 'Email y contraseña son requeridos' }
  const supabase = createClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: email as string,
    password: password as string,
  })
  if (error) return { error: 'Email o contraseña incorrectos' }
  redirect('/dashboard')
}

export async function logout() {
  const supabase = createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
