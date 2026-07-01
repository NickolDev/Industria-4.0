'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { exigirAdmin } from '@/lib/auth'

// Admin cria um convite. tenant_id é preenchido pelo DEFAULT da tabela
// (current_tenant_id) e validado pelo RLS — o cliente nunca o informa.
// Dupla verificação: exigirAdmin confirma sessão + tenant ativo + cargo.
export async function criarConvite(formData: FormData) {
  const { supabase } = await exigirAdmin()

  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const cargo = String(formData.get('cargo') ?? 'operador')

  // Validação de entrada extra (o banco também valida o cargo).
  const emailValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  if (!emailValido) redirect(`/equipe?erro=${encodeURIComponent('E-mail inválido.')}`)
  if (!['gerente', 'operador'].includes(cargo))
    redirect(`/equipe?erro=${encodeURIComponent('Cargo inválido.')}`)

  const { error } = await supabase.from('convites').insert({ email, cargo })

  if (error) {
    redirect(`/equipe?erro=${encodeURIComponent(error.message)}`)
  }

  revalidatePath('/equipe')
  redirect('/equipe?ok=convite-criado')
}

// Convidado aceita: cria o login (sem nome_estetica, então NÃO cria
// estética nova) e chama aceitar_convite, que faz o vínculo ao tenant.
export async function aceitarConvite(formData: FormData) {
  const supabase = await createClient()

  const token = String(formData.get('token') ?? '')
  const email = String(formData.get('email') ?? '').trim()
  const nome = String(formData.get('nome') ?? '').trim()
  const password = String(formData.get('password') ?? '')

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { nome } },
  })

  if (error) {
    redirect(`/aceitar-convite?token=${token}&erro=${encodeURIComponent(error.message)}`)
  }

  // Com confirmação de e-mail ligada não há sessão ainda; o aceite
  // precisaria acontecer após a confirmação (ver nota no chat).
  if (!data.session) {
    redirect('/login?aviso=confirme-seu-email')
  }

  const { error: erroAceite } = await supabase.rpc('aceitar_convite', {
    p_token: token,
    p_nome: nome,
  })

  if (erroAceite) {
    redirect(`/aceitar-convite?token=${token}&erro=${encodeURIComponent(erroAceite.message)}`)
  }

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}
