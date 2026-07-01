'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'

const numero = (v: FormDataEntryValue | null) =>
  Number(String(v ?? '').replace(',', '.')) || 0

export async function criarServico(formData: FormData) {
  const supabase = await createClient()

  const nome = String(formData.get('nome') ?? '').trim()
  const tipo = String(formData.get('tipo') ?? 'principal')
  const preco = numero(formData.get('preco'))
  const duracao = parseInt(String(formData.get('duracao') ?? '30'), 10) || 30

  const { error } = await supabase.from('servicos').insert({
    nome,
    tipo,
    preco_base: preco,
    duracao_min: duracao,
  })

  if (error) redirect(`/servicos?erro=${encodeURIComponent(error.message)}`)
  revalidatePath('/servicos')
}

export async function salvarServico(formData: FormData) {
  const supabase = await createClient()
  const id = String(formData.get('id') ?? '')

  const { error } = await supabase
    .from('servicos')
    .update({
      preco_base: numero(formData.get('preco')),
      duracao_min: parseInt(String(formData.get('duracao') ?? '30'), 10) || 30,
    })
    .eq('id', id)

  if (error) redirect(`/servicos?erro=${encodeURIComponent(error.message)}`)
  revalidatePath('/servicos')
}

export async function setAtivo(formData: FormData) {
  const supabase = await createClient()
  const id = String(formData.get('id') ?? '')
  const ativo = String(formData.get('ativo') ?? 'true') === 'true'

  await supabase.from('servicos').update({ ativo }).eq('id', id)
  revalidatePath('/servicos')
}

export async function removerServico(formData: FormData) {
  const supabase = await createClient()
  const id = String(formData.get('id') ?? '')

  const { error } = await supabase.from('servicos').delete().eq('id', id)

  // Serviço já usado em ordens não pode ser apagado (preserva o histórico).
  // Nesse caso, oriente a desativar em vez de remover.
  if (error) {
    redirect(
      `/servicos?erro=${encodeURIComponent(
        'Este serviço já foi usado em ordens. Desative em vez de remover.'
      )}`
    )
  }
  revalidatePath('/servicos')
}
