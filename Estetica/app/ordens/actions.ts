'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { notificarOrdemPronta } from '@/lib/whatsapp'

// Cria cliente + veículo + ordem em sequência e abre a ordem nova.
// (Escolher um cliente já existente entra quando montarmos a tela de
//  clientes; por ora, cadastro rápido.)
export async function criarOrdem(formData: FormData) {
  const supabase = await createClient()

  const clienteNome = String(formData.get('cliente_nome') ?? '').trim()
  const clienteTel = String(formData.get('cliente_telefone') ?? '').trim()
  const veicModelo = String(formData.get('veiculo_modelo') ?? '').trim()
  const veicPlaca = String(formData.get('veiculo_placa') ?? '').trim()
  const veicCor = String(formData.get('veiculo_cor') ?? '').trim()

  const falhar = (msg: string) =>
    redirect(`/ordens/nova?erro=${encodeURIComponent(msg)}`)

  const { data: cliente, error: e1 } = await supabase
    .from('clientes')
    .insert({ nome: clienteNome, telefone: clienteTel || null })
    .select('id')
    .single()
  if (e1 || !cliente) return falhar(e1?.message ?? 'Erro ao criar cliente')

  const { data: veiculo, error: e2 } = await supabase
    .from('veiculos')
    .insert({
      cliente_id: cliente.id,
      modelo: veicModelo || null,
      placa: veicPlaca || null,
      cor: veicCor || null,
    })
    .select('id')
    .single()
  if (e2 || !veiculo) return falhar(e2?.message ?? 'Erro ao criar veículo')

  const { data: ordem, error: e3 } = await supabase
    .from('ordens_servico')
    .insert({ cliente_id: cliente.id, veiculo_id: veiculo.id })
    .select('id')
    .single()
  if (e3 || !ordem) return falhar(e3?.message ?? 'Erro ao abrir ordem')

  redirect(`/ordens/${ordem.id}`)
}

// Adiciona um serviço/adicional à ordem. Se o preço for deixado em
// branco, usa o preço-base do serviço. O total da ordem e a comissão
// do item são recalculados pelos gatilhos do banco.
export async function adicionarItem(formData: FormData) {
  const supabase = await createClient()

  const osId = String(formData.get('os_id') ?? '')
  const servicoId = String(formData.get('servico_id') ?? '')
  const funcionarioId = String(formData.get('funcionario_id') ?? '') || null
  const precoRaw = String(formData.get('preco') ?? '').trim()

  let preco: number
  if (precoRaw) {
    preco = Number(precoRaw.replace(',', '.'))
  } else {
    const { data: serv } = await supabase
      .from('servicos')
      .select('preco_base')
      .eq('id', servicoId)
      .single()
    preco = Number(serv?.preco_base ?? 0)
  }

  await supabase.from('os_itens').insert({
    os_id: osId,
    servico_id: servicoId,
    funcionario_id: funcionarioId,
    preco_cobrado: preco,
  })

  revalidatePath(`/ordens/${osId}`)
}

export async function removerItem(formData: FormData) {
  const supabase = await createClient()
  const osId = String(formData.get('os_id') ?? '')
  const itemId = String(formData.get('item_id') ?? '')

  await supabase.from('os_itens').delete().eq('id', itemId)
  revalidatePath(`/ordens/${osId}`)
}

// Fecha a ordem: marca como 'pronto'. Dispara, no banco, o carimbo de
// conclusão e a baixa de estoque. A partir daqui ela conta no dashboard.
export async function fecharOrdem(formData: FormData) {
  const supabase = await createClient()
  const osId = String(formData.get('os_id') ?? '')

  await supabase
    .from('ordens_servico')
    .update({ status: 'pronto' })
    .eq('id', osId)

  // "Carro pronto" no WhatsApp — best-effort: se falhar, não trava nada.
  try {
    await notificarOrdemPronta(osId)
  } catch {
    // falha de notificação não deve impedir o fechamento da ordem
  }

  revalidatePath(`/ordens/${osId}`)
  revalidatePath('/dashboard')
}

// Abre uma ordem para um cliente/veículo JÁ existentes (a partir da
// ficha do cliente). Evita recadastrar quem é cliente recorrente.
export async function abrirOrdemVeiculo(formData: FormData) {
  const supabase = await createClient()
  const clienteId = String(formData.get('cliente_id') ?? '')
  const veiculoId = String(formData.get('veiculo_id') ?? '')

  const { data: ordem, error } = await supabase
    .from('ordens_servico')
    .insert({ cliente_id: clienteId, veiculo_id: veiculoId })
    .select('id')
    .single()

  if (error || !ordem) {
    redirect(`/clientes/${clienteId}?erro=${encodeURIComponent(error?.message ?? 'Erro ao abrir ordem')}`)
  }
  redirect(`/ordens/${ordem.id}`)
}
