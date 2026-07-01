'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'

const num = (v: FormDataEntryValue | null) =>
  Number(String(v ?? '').replace(',', '.')) || 0

// Atualiza cargo e percentual de comissão. Só admin chega aqui (RLS +
// tela protegida). A comissão passa a valer nas PRÓXIMAS ordens — itens
// já fechados mantêm a comissão congelada do momento da venda.
export async function atualizarFuncionario(formData: FormData) {
  const supabase = await createClient()
  const id = String(formData.get('id') ?? '')

  const { error } = await supabase
    .from('funcionarios')
    .update({
      cargo: String(formData.get('cargo') ?? 'operador'),
      comissao_pct: num(formData.get('comissao')),
    })
    .eq('id', id)

  if (error) redirect(`/equipe?erro=${encodeURIComponent(error.message)}`)
  revalidatePath('/equipe')
}

export async function setFuncionarioAtivo(formData: FormData) {
  const supabase = await createClient()
  const id = String(formData.get('id') ?? '')
  const ativo = String(formData.get('ativo') ?? 'true') === 'true'

  await supabase.from('funcionarios').update({ ativo }).eq('id', id)
  revalidatePath('/equipe')
}
