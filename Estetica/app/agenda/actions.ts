'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'

// App fixado em horário de Brasília (sem horário de verão no Brasil hoje).
// Suporte a múltiplos fusos é evolução futura.
const OFFSET = '-03:00'

export async function criarAgendamento(formData: FormData) {
  const supabase = await createClient()

  const dia = String(formData.get('data') ?? '')
  const hora = String(formData.get('hora') ?? '')
  const duracao = parseInt(String(formData.get('duracao') ?? '60'), 10) || 60
  const veiculoId = String(formData.get('veiculo_id') ?? '')
  const boxId = String(formData.get('box_id') ?? '') || null
  const funcionarioId = String(formData.get('funcionario_id') ?? '') || null

  const volta = (msg: string) =>
    redirect(`/agenda?dia=${dia}&erro=${encodeURIComponent(msg)}`)

  if (!dia || !hora || !veiculoId) return volta('Preencha veículo, data e hora.')

  // Wall-clock de Brasília -> instante exato (timestamptz)
  const inicio = new Date(`${dia}T${hora}:00${OFFSET}`)
  const fim = new Date(inicio.getTime() + duracao * 60000)

  // Cliente vem do veículo escolhido
  const { data: veic } = await supabase
    .from('veiculos')
    .select('cliente_id')
    .eq('id', veiculoId)
    .single()
  if (!veic) return volta('Veículo não encontrado.')

  const { error } = await supabase.from('agendamentos').insert({
    cliente_id: veic.cliente_id,
    veiculo_id: veiculoId,
    box_id: boxId,
    funcionario_id: funcionarioId,
    inicio: inicio.toISOString(),
    fim: fim.toISOString(),
  })

  if (error) {
    // 23P01 = exclusion_violation: a trava de sobreposição de box disparou
    const conflito = error.code === '23P01' || error.message.includes('sem_sobreposicao_box')
    return volta(conflito ? 'Esse box já está ocupado nesse horário.' : error.message)
  }

  revalidatePath('/agenda')
  redirect(`/agenda?dia=${dia}`)
}

export async function setStatusAgendamento(formData: FormData) {
  const supabase = await createClient()
  const id = String(formData.get('id') ?? '')
  const dia = String(formData.get('dia') ?? '')
  const status = String(formData.get('status') ?? '')

  await supabase.from('agendamentos').update({ status }).eq('id', id)
  redirect(`/agenda?dia=${dia}`)
}

export async function criarBox(formData: FormData) {
  const supabase = await createClient()
  const dia = String(formData.get('dia') ?? '')
  const nome = String(formData.get('nome') ?? '').trim()

  if (nome) await supabase.from('boxes').insert({ nome })
  redirect(`/agenda?dia=${dia}`)
}

// Transforma o agendamento numa ordem de serviço de verdade, já ligada
// (ordens_servico.agendamento_id) e com cliente/veículo preenchidos.
export async function abrirOrdemDoAgendamento(formData: FormData) {
  const supabase = await createClient()
  const agId = String(formData.get('id') ?? '')
  const clienteId = String(formData.get('cliente_id') ?? '')
  const veiculoId = String(formData.get('veiculo_id') ?? '')
  const dia = String(formData.get('dia') ?? '')

  const { data: ordem, error } = await supabase
    .from('ordens_servico')
    .insert({ agendamento_id: agId, cliente_id: clienteId, veiculo_id: veiculoId })
    .select('id')
    .single()

  if (error || !ordem) {
    redirect(`/agenda?dia=${dia}&erro=${encodeURIComponent(error?.message ?? 'Erro ao abrir ordem')}`)
  }

  // O horário virou serviço: marca como concluído e libera o box.
  await supabase.from('agendamentos').update({ status: 'concluido' }).eq('id', agId)

  redirect(`/ordens/${ordem.id}`)
}
