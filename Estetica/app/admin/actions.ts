'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/utils/supabase/admin'
import { exigirPlataforma } from '@/lib/auth'

function parseValor(v: string) {
  const n = parseFloat(String(v).replace(',', '.'))
  return isNaN(n) ? null : n
}

// --- Criar uma nova estética (cadastro fechado: só a plataforma faz) ---
export async function criarEstetica(formData: FormData) {
  await exigirPlataforma()

  const nome_estetica = String(formData.get('nome_estetica') ?? '').trim()
  const nome_dono = String(formData.get('nome_dono') ?? '').trim() || 'Dono'
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const senha = String(formData.get('senha') ?? '')
  const plano = String(formData.get('plano') ?? '').trim() || null
  const valor_mensal = parseValor(String(formData.get('valor_mensal') ?? ''))
  const vencimento = String(formData.get('vencimento') ?? '') || null

  const volta = (m: string) => redirect(`/admin?erro=${encodeURIComponent(m)}`)

  // Validações de entrada (dupla verificação — o banco também valida,
  // mas erramos cedo com mensagem clara).
  const emailValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  if (!nome_estetica || nome_estetica.length < 2)
    return volta('Informe o nome da estética (mín. 2 caracteres).')
  if (!emailValido) return volta('E-mail inválido.')
  if (senha.length < 6)
    return volta('A senha precisa ter ao menos 6 caracteres.')

  const admin = createAdminClient()

  // Cria o usuário dono; o trigger handle_nova_estetica cria a estética.
  const { data: criado, error } = await admin.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
    user_metadata: { nome_estetica, nome_dono },
  })
  if (error || !criado?.user) return volta(error?.message ?? 'Falha ao criar usuário.')

  // Acha a estética recém-criada e aplica os dados de cobrança.
  const { data: f } = await admin
    .from('funcionarios')
    .select('tenant_id')
    .eq('auth_user_id', criado.user.id)
    .single()

  // Se o trigger não criou a estética (algo deu errado), NÃO deixa um
  // usuário órfão no Auth — desfaz a criação e avisa. Antes isso deixaria
  // um login sem estética, difícil de rastrear depois.
  if (!f?.tenant_id) {
    await admin.auth.admin.deleteUser(criado.user.id).catch(() => {})
    return volta('Falha ao criar a estética. Nada foi salvo — tente de novo.')
  }

  await admin
    .from('tenants')
    .update({ plano, valor_mensal, vencimento, status: 'ativo' })
    .eq('id', f.tenant_id)

  revalidatePath('/admin')
  redirect('/admin?ok=criada')
}

// --- Ativar / suspender / cancelar ---
export async function mudarStatus(formData: FormData) {
  const { supabase } = await exigirPlataforma()
  const id = String(formData.get('id') ?? '')
  const status = String(formData.get('status') ?? '')
  if (!['ativo', 'suspenso', 'cancelado'].includes(status)) redirect('/admin')

  await supabase.from('tenants').update({ status }).eq('id', id)
  revalidatePath('/admin')
  redirect('/admin?ok=status')
}

// --- Editar dados de cobrança ---
export async function editarCobranca(formData: FormData) {
  const { supabase } = await exigirPlataforma()
  const id = String(formData.get('id') ?? '')

  await supabase
    .from('tenants')
    .update({
      plano: String(formData.get('plano') ?? '').trim() || null,
      valor_mensal: parseValor(String(formData.get('valor_mensal') ?? '')),
      vencimento: String(formData.get('vencimento') ?? '') || null,
      obs: String(formData.get('obs') ?? '').trim() || null,
    })
    .eq('id', id)

  revalidatePath('/admin')
  redirect('/admin?ok=cobranca')
}
