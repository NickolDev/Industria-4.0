import { sair } from '@/app/auth/actions'
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'

export default async function BloqueadoPage() {
  const supabase = await createClient()
  const { data: mt } = await supabase.rpc('meu_tenant')

  // Se na verdade está ativo (ou não tem tenant), não faz sentido ficar aqui.
  if (!mt || mt.status === 'ativo') redirect('/dashboard')

  const cancelado = mt.status === 'cancelado'

  return (
    <main style={s.wrap}>
      <div style={s.card}>
        <div style={s.icone}>{cancelado ? '🔒' : '⏸️'}</div>
        <h1 style={s.titulo}>
          {cancelado ? 'Conta encerrada' : 'Acesso suspenso'}
        </h1>
        <p style={s.texto}>
          {cancelado
            ? 'O acesso desta estética foi encerrado. Para reativar, entre em contato com a administração.'
            : 'O acesso está temporariamente suspenso. Regularize o pagamento com a administração para liberar novamente.'}
        </p>
        <form action={sair}>
          <button type="submit" style={s.botao}>Sair</button>
        </form>
      </div>
    </main>
  )
}

const s: Record<string, React.CSSProperties> = {
  wrap: { minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f1115', padding: 24 },
  card: { width: '100%', maxWidth: 400, background: '#171a21', border: '1px solid #262b36', borderRadius: 14, padding: 32, color: '#e6e8ec', textAlign: 'center' },
  icone: { fontSize: 40, marginBottom: 12 },
  titulo: { fontSize: 22, fontWeight: 600, margin: '0 0 10px' },
  texto: { fontSize: 14, color: '#9aa1ad', margin: '0 0 22px', lineHeight: 1.55 },
  botao: { height: 42, borderRadius: 8, border: '1px solid #2d333f', background: 'transparent', color: '#e6e8ec', fontSize: 14, cursor: 'pointer', padding: '0 22px' },
}
