'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'

export async function criarCliente(formData: FormData) {
  const supabase = await createClient()

  const nome = String(formData.get('nome') ?? '').trim()
  const telefone = String(formData.get('telefone') ?? '').trim()
  const email = String(formData.get('email') ?? '').trim()

  const { data: cliente, error } = await supabase
    .from('clientes')
    .insert({ nome, telefone: telefone || null, email: email || null })
    .select('id')
    .single()

  if (error || !cliente) {
    redirect(`/clientes?erro=${encodeURIComponent(error?.message ?? 'Erro ao criar cliente')}`)
  }

  // Veículo é opcional no cadastro do cliente
  const modelo = String(formData.get('veiculo_modelo') ?? '').trim()
  const placa = String(formData.get('veiculo_placa') ?? '').trim()
  if (modelo || placa) {
    await supabase.from('veiculos').insert({
      cliente_id: cliente.id,
      modelo: modelo || null,
      placa: placa || null,
    })
  }

  redirect(`/clientes/${cliente.id}`)
}

export async function atualizarCliente(formData: FormData) {
  const supabase = await createClient()
  const id = String(formData.get('id') ?? '')

  const { error } = await supabase
    .from('clientes')
    .update({
      nome: String(formData.get('nome') ?? '').trim(),
      telefone: String(formData.get('telefone') ?? '').trim() || null,
      email: String(formData.get('email') ?? '').trim() || null,
    })
    .eq('id', id)

  if (error) redirect(`/clientes/${id}?erro=${encodeURIComponent(error.message)}`)
  revalidatePath(`/clientes/${id}`)
}

export async function adicionarVeiculo(formData: FormData) {
  const supabase = await createClient()
  const clienteId = String(formData.get('cliente_id') ?? '')

  const { error } = await supabase.from('veiculos').insert({
    cliente_id: clienteId,
    modelo: String(formData.get('modelo') ?? '').trim() || null,
    placa: String(formData.get('placa') ?? '').trim() || null,
    cor: String(formData.get('cor') ?? '').trim() || null,
    observacoes: String(formData.get('observacoes') ?? '').trim() || null,
  })

  if (error) redirect(`/clientes/${clienteId}?erro=${encodeURIComponent(error.message)}`)
  revalidatePath(`/clientes/${clienteId}`)
}

export async function removerVeiculo(formData: FormData) {
  const supabase = await createClient()
  const clienteId = String(formData.get('cliente_id') ?? '')
  const veiculoId = String(formData.get('veiculo_id') ?? '')

  const { error } = await supabase.from('veiculos').delete().eq('id', veiculoId)

  // Veículo com ordens no histórico não pode ser apagado (preserva o passado)
  if (error) {
    redirect(
      `/clientes/${clienteId}?erro=${encodeURIComponent(
        'Este veículo já tem ordens no histórico e não pode ser removido.'
      )}`
    )
  }
  revalidatePath(`/clientes/${clienteId}`)
}
