'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'

const num = (v: FormDataEntryValue | null) =>
  Number(String(v ?? '').replace(',', '.')) || 0

// Adiciona um insumo à ficha. Como (servico_id, insumo_id) é único,
// usamos upsert: se o insumo já estiver na ficha, atualiza a quantidade.
export async function adicionarFicha(formData: FormData) {
  const supabase = await createClient()
  const servicoId = String(formData.get('servico_id') ?? '')
  const insumoId = String(formData.get('insumo_id') ?? '')

  const { error } = await supabase
    .from('ficha_tecnica')
    .upsert(
      { servico_id: servicoId, insumo_id: insumoId, qtd_consumida: num(formData.get('qtd')) },
      { onConflict: 'servico_id,insumo_id' }
    )

  if (error) redirect(`/servicos/${servicoId}/ficha?erro=${encodeURIComponent(error.message)}`)
  revalidatePath(`/servicos/${servicoId}/ficha`)
}

export async function atualizarFicha(formData: FormData) {
  const supabase = await createClient()
  const servicoId = String(formData.get('servico_id') ?? '')
  const id = String(formData.get('id') ?? '')

  const { error } = await supabase
    .from('ficha_tecnica')
    .update({ qtd_consumida: num(formData.get('qtd')) })
    .eq('id', id)

  if (error) redirect(`/servicos/${servicoId}/ficha?erro=${encodeURIComponent(error.message)}`)
  revalidatePath(`/servicos/${servicoId}/ficha`)
}

export async function removerFicha(formData: FormData) {
  const supabase = await createClient()
  const servicoId = String(formData.get('servico_id') ?? '')
  const id = String(formData.get('id') ?? '')

  await supabase.from('ficha_tecnica').delete().eq('id', id)
  revalidatePath(`/servicos/${servicoId}/ficha`)
}
