import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

const statusLabel: Record<string, string> = {
  aberta: 'Aberta',
  em_andamento: 'Em andamento',
  pronto: 'Pronto',
  entregue: 'Entregue',
  cancelada: 'Cancelada',
}

export default async function OrdensPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: ordens } = await supabase
    .from('ordens_servico')
    .select('id, status, valor_total, criado_em, cliente:clientes(nome), veiculo:veiculos(modelo, placa)')
    .order('criado_em', { ascending: false })
    .limit(40)

  return (
    <main style={s.wrap}>
      <div style={s.shell}>
        <header style={s.header}>
          <h1 style={s.title}>Ordens de serviço</h1>
          <Link href="/ordens/nova" style={s.novo}>Nova ordem</Link>
        </header>

        {(ordens?.length ?? 0) === 0 ? (
          <p style={s.vazio}>Nenhuma ordem ainda. Crie a primeira.</p>
        ) : (
          <ul style={s.lista}>
            {(ordens as any[]).map((o) => (
              <li key={o.id}>
                <Link href={`/ordens/${o.id}`} style={s.linha}>
                  <div>
                    <p style={s.cliente}>{o.cliente?.nome ?? 'Sem cliente'}</p>
                    <p style={s.veiculo}>
                      {[o.veiculo?.modelo, o.veiculo?.placa].filter(Boolean).join(' · ') || '—'}
                    </p>
                  </div>
                  <div style={s.dir}>
                    <span style={{ ...s.badge, ...badgeStyle(o.status) }}>
                      {statusLabel[o.status] ?? o.status}
                    </span>
                    <span style={s.valor}>{brl.format(Number(o.valor_total ?? 0))}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}

        <Link href="/dashboard" style={s.voltar}>← Voltar ao painel</Link>
      </div>
    </main>
  )
}

function badgeStyle(status: string): React.CSSProperties {
  if (status === 'pronto' || status === 'entregue')
    return { background: '#13211a', color: '#86e0ab', borderColor: '#245c3e' }
  if (status === 'cancelada')
    return { background: '#2a1416', color: '#f4a7ab', borderColor: '#5c2326' }
  return { background: '#1c2333', color: '#cfe0ff', borderColor: '#2c4a7a' }
}

const s: Record<string, React.CSSProperties> = {
  wrap: { minHeight: '100dvh', background: '#0f1115', padding: 24, color: '#e6e8ec' },
  shell: { maxWidth: 720, margin: '0 auto' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 24, fontWeight: 600, margin: 0 },
  novo: { background: '#3b82f6', color: '#fff', fontSize: 14, fontWeight: 600, textDecoration: 'none', padding: '9px 16px', borderRadius: 8 },
  lista: { listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 },
  linha: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', textDecoration: 'none', color: '#e6e8ec', background: '#171a21', border: '1px solid #262b36', borderRadius: 10, padding: '14px 16px' },
  cliente: { fontSize: 15, fontWeight: 500, margin: 0 },
  veiculo: { fontSize: 13, color: '#9aa1ad', margin: '2px 0 0' },
  dir: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 },
  badge: { fontSize: 11, padding: '2px 8px', borderRadius: 6, border: '1px solid' },
  valor: { fontSize: 15, fontWeight: 600 },
  vazio: { fontSize: 14, color: '#6b7280' },
  voltar: { display: 'inline-block', marginTop: 20, fontSize: 13, color: '#7aa7ff', textDecoration: 'none' },
}
