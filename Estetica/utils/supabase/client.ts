import { createBrowserClient } from '@supabase/ssr'

// Cliente para uso no NAVEGADOR (Client Components).
// A chave pública pode ser a "anon key" (legada) ou a nova
// "publishable key" — ambas funcionam nesta variável durante a transição.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
