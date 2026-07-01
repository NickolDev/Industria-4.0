'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { enviarTeste } from '@/lib/whatsapp'

export async function salvarConfig(formData: FormData) {
  const supabase = await createClient()

  const tokenNovo = String(formData.get('access_token') ?? '').trim()

  const payload: Record<string, any> = {
    phone_number_id: String(formData.get('phone_number_id') ?? '').trim() || null,
    template_pronto: String(formData.get('template_pronto') ?? '').trim() || 'carro_pronto',
    template_lembrete: String(formData.get('template_lembrete') ?? '').trim() || 'lembrete_agendamento',
    idioma: String(formData.get('idioma') ?? '').trim() || 'pt_BR',
    ativo: String(formData.get('ativo') ?? '') === 'on',
    atualizado_em: new Date().toISOString(),
  }
  // Só sobrescreve o token se um novo foi digitado (mantém o segredo)
  if (tokenNovo) payload.access_token = tokenNovo

  const { data: existe } = await supabase
    .from('whatsapp_config')
    .select('tenant_id')
    .maybeSingle()

  const { error } = existe
    ? await supabase.from('whatsapp_config').update(payload).eq('tenant_id', existe.tenant_id)
    : await supabase.from('whatsapp_config').insert(payload)

  if (error) redirect(`/config/whatsapp?erro=${encodeURIComponent(error.message)}`)
  revalidatePath('/config/whatsapp')
  redirect('/config/whatsapp?ok=1')
}

export async function testarEnvio(formData: FormData) {
  const supabase = await createClient()
  const telefone = String(formData.get('telefone') ?? '').trim()

  const { data: cfg } = await supabase
    .from('whatsapp_config')
    .select('tenant_id')
    .maybeSingle()

  if (!cfg) redirect(`/config/whatsapp?erro=${encodeURIComponent('Configure e salve antes de testar.')}`)

  const r = await enviarTeste(cfg!.tenant_id, telefone)
  redirect(
    `/config/whatsapp?${r.ok ? 'ok=teste' : `erro=${encodeURIComponent('Falha: ' + r.detalhe)}`}`
  )
}
