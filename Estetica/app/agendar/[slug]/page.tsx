import { createClient } from '@/utils/supabase/server'
import AgendarCliente from './AgendarCliente'

export default async function AgendarPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const supabase = await createClient()

  // Função pública (SECURITY DEFINER): devolve só nome, funcionamento e
  // serviços ativos — ou null se o slug não existe / agendamento desligado.
  const { data } = await supabase.rpc('agenda_publica_estetica', { p_slug: slug })

  if (!data) {
    return (
      <main style={wrap}>
        <div style={card}>
          <h1 style={{ fontSize: 20, fontWeight: 600, margin: '0 0 8px' }}>
            Agendamento indisponível
          </h1>
          <p style={{ fontSize: 14, color: '#9aa1ad', margin: 0, lineHeight: 1.5 }}>
            Este link não está ativo. Confira o endereço com a estética.
          </p>
        </div>
      </main>
    )
  }

  return <AgendarCliente slug={slug} dados={data} />
}

const wrap: React.CSSProperties = {
  minHeight: '100dvh',
  background: '#0f1115',
  color: '#e6e8ec',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 24,
}
const card: React.CSSProperties = {
  background: '#171a21',
  border: '1px solid #262b36',
  borderRadius: 12,
  padding: 28,
  maxWidth: 420,
  textAlign: 'center',
}
