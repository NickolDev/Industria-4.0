'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { exigirAdmin } from '@/lib/auth'

// Transforma "Brilho Total!" em "brilho-total" (seguro para URL)
function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')   // tira acentos
    .replace(/[^a-z0-9]+/g, '-')       // não-alfanumérico vira hífen
    .replace(/^-+|-+$/g, '')           // tira hífens das pontas
    .slice(0, 40)
}

export async function salvarConfigAgendamento(formData: FormData) {
  const { supabase } = await exigirAdmin()

  const slug = slugify(String(formData.get('slug') ?? '')) || null
  const online = String(formData.get('agendamento_online') ?? '') === 'on'
  const confirma = String(formData.get('confirma_auto') ?? '') === 'on'

  const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))
  const abertura = clamp(parseInt(String(formData.get('hora_abertura') ?? '8'), 10) || 8, 0, 23)
  const fechamento = clamp(parseInt(String(formData.get('hora_fechamento') ?? '18'), 10) || 18, 1, 24)
  const intervalo = clamp(parseInt(String(formData.get('intervalo_min') ?? '30'), 10) || 30, 5, 240)

  const volta = (msg: string) =>
    redirect(`/config/agendamento?erro=${encodeURIComponent(msg)}`)

  if (fechamento <= abertura) return volta('O horário de fechamento deve ser depois do de abertura.')
  if (online && !slug) return volta('Defina um link (slug) antes de ativar o agendamento online.')

  const { data: t } = await supabase.from('tenants').select('id').single()
  if (!t) return volta('Estética não encontrada.')

  const { error } = await supabase
    .from('tenants')
    .update({
      slug,
      agendamento_online: online,
      hora_abertura: abertura,
      hora_fechamento: fechamento,
      intervalo_min: intervalo,
      confirma_auto: confirma,
    })
    .eq('id', t.id)

  if (error) {
    // 23505 = unique_violation: o slug já é usado por outra estética
    if (error.code === '23505') return volta('Esse link já está em uso. Escolha outro.')
    return volta(error.message)
  }

  revalidatePath('/config/agendamento')
  redirect('/config/agendamento?ok=1')
}
