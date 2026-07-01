'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { createClient } from '@/utils/supabase/server'

// Descobre a URL pública (https://seu-dominio) a partir dos headers da
// requisição — para montar o link de retorno do e-mail de recuperação.
async function origemPublica() {
  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? ''
  const proto = h.get('x-forwarded-proto') ?? 'https'
  return `${proto}://${host}`
}

// "Esqueci minha senha": envia o e-mail com link de redefinição.
// O link cai em /auth/confirm (que cria a sessão de recuperação) e de
// lá segue para /redefinir-senha.
export async function enviarRecuperacao(formData: FormData) {
  const supabase = await createClient()
  const email = String(formData.get('email') ?? '').trim()

  if (!email) redirect('/recuperar?erro=Informe%20seu%20e-mail')

  const origin = await origemPublica()
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/confirm?next=/redefinir-senha`,
  })

  // Resposta sempre igual (não revela se o e-mail existe ou não).
  redirect('/recuperar?enviado=1')
}

// Define a nova senha (já com a sessão de recuperação ativa).
export async function redefinirSenha(formData: FormData) {
  const supabase = await createClient()
  const senha = String(formData.get('password') ?? '')
  const senha2 = String(formData.get('password2') ?? '')

  if (senha.length < 6) redirect('/redefinir-senha?erro=A%20senha%20precisa%20de%20ao%20menos%206%20caracteres')
  if (senha !== senha2) redirect('/redefinir-senha?erro=As%20senhas%20n%C3%A3o%20conferem')

  const { error } = await supabase.auth.updateUser({ password: senha })
  if (error) redirect(`/redefinir-senha?erro=${encodeURIComponent(error.message)}`)

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}

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
