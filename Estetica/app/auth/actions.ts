'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'

// Cadastro de uma NOVA estética. O nome da estética e do dono vão nos
// metadados (options.data) — o gatilho handle_nova_estetica no banco
// lê esses dados e cria o tenant + funcionário dono atomicamente.
export async function cadastrarEstetica(formData: FormData) {
  const supabase = await createClient()

  const nomeEstetica = String(formData.get('nome_estetica') ?? '').trim()
  const nomeDono = String(formData.get('nome_dono') ?? '').trim()
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { nome_estetica: nomeEstetica, nome_dono: nomeDono },
    },
  })

  if (error) {
    redirect(`/cadastro?erro=${encodeURIComponent(error.message)}`)
  }

  // Se a confirmação de e-mail estiver ligada, ainda não há sessão.
  if (!data.session) {
    redirect('/login?aviso=confirme-seu-email')
  }

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}

export async function entrar(formData: FormData) {
  const supabase = await createClient()

  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    redirect(`/login?erro=${encodeURIComponent(error.message)}`)
  }

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}

export async function sair() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
