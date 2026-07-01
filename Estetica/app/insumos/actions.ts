'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'

const num = (v: FormDataEntryValue | null) =>
  Number(String(v ?? '').replace(',', '.')) || 0

export async function criarInsumo(formData: FormData) {
  const supabase = await createClient()

  const { error } = await supabase.from('insumos').insert({
    nome: String(formData.get('nome') ?? '').trim(),
    unidade: String(formData.get('unidade') ?? 'un'),
    qtd_estoque: num(formData.get('qtd')),
    estoque_minimo: num(formData.get('minimo')),
    custo_unitario: num(formData.get('custo')),
  })

  if (error) redirect(`/insumos?erro=${encodeURIComponent(error.message)}`)
  revalidatePath('/insumos')
}

export async function ajustarMinimo(formData: FormData) {
  const supabase = await createClient()
  const id = String(formData.get('id') ?? '')

  const { error } = await supabase
    .from('insumos')
    .update({ estoque_minimo: num(formData.get('minimo')) })
    .eq('id', id)

  if (error) redirect(`/insumos?erro=${encodeURIComponent(error.message)}`)
  revalidatePath('/insumos')
}

// Compra de insumo: chama a função do banco, que registra a entrada no
// histórico e recalcula o custo médio ponderado automaticamente.
export async function registrarEntrada(formData: FormData) {
  const supabase = await createClient()

  const { error } = await supabase.rpc('registrar_entrada', {
    p_insumo_id: String(formData.get('id') ?? ''),
    p_quantidade: num(formData.get('quantidade')),
    p_custo_unitario: num(formData.get('custo')),
    p_motivo: 'Compra de insumo',
  })

  if (error) redirect(`/insumos?erro=${encodeURIComponent(error.message)}`)
  revalidatePath('/insumos')
}

export async function removerInsumo(formData: FormData) {
  const supabase = await createClient()
  const id = String(formData.get('id') ?? '')

  const { error } = await supabase.from('insumos').delete().eq('id', id)

  if (error) {
    redirect(
      `/insumos?erro=${encodeURIComponent(
        'Este insumo já tem histórico ou está ligado a um serviço e não pode ser removido.'
      )}`
    )
  }
  revalidatePath('/insumos')
}
