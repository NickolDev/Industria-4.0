import { createClient } from '@supabase/supabase-js'

// Cliente com SERVICE ROLE — ignora o RLS. Use SOMENTE no servidor,
// para ações de sistema (ex.: enviar notificações), e sempre filtrando
// por tenant_id na mão. NUNCA exponha a chave ao navegador.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}
