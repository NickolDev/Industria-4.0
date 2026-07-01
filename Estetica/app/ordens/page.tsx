import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import EmptyState from '@/components/EmptyState'

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

const statusLabel: Record<string, string> = {
  aberta: 'Aberta',
  em_andamento: 'Em andamento',
  pronto: 'Pronto',
  entregue: 'Entregue',
  cancelada: 'Cancelada',
}

export default async function OrdensPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q } = await searchParams
  const termo = (q ?? '').trim().toLowerCase()

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: ordensRaw } = await supabase
    .from('ordens_servico')
    .select('id, status, valor_total, criado_em, cliente:clientes(nome), veiculo:veiculos(modelo, placa)')
    .order('criado_em', { ascending: false })
    .limit(120)

  const todas = (ordensRaw as any[]) ?? []

  // Filtro por cliente, modelo ou placa (em memória — escopo do tenant
  // já é garantido pelo RLS).
  const ordens = termo
    ? todas.filter((o) => {
        const alvo = [
          o.cliente?.nome,
          o.veiculo?.modelo,
          o.veiculo?.placa,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        return alvo.includes(termo)
      })
    : todas

  const semNenhuma = todas.length === 0

  return (
    <main style={s.wrap}>
      <div style={s.shell}>
        <header style={s.header}>
          <h1 style={s.title}>Ordens de serviço</h1>
          <Link href="/ordens/nova" style={s.novo}>Nova ordem</Link>
        </header>

        {!semNenhuma && (
          <form style={s.busca} method="GET">
            <input
              name="q"
              defaultValue={q ?? ''}
              placeholder="Buscar por cliente, modelo ou placa…"
              style={s.buscaInput}
            />
            <button type="submit" style={s.buscaBtn}>Buscar</button>
            {termo && (
              <Link href="/ordens" style={s.limpar}>limpar</Link>
            )}
          </form>
        )}

        {semNenhuma ? (
          <EmptyState
            icon="ordens"
            titulo="Nenhuma ordem ainda"
            descricao="Abra a primeira ordem de serviço para começar a registrar os carros que entram na sua estética."
            acaoHref="/ordens/nova"
            acaoLabel="Abrir primeira ordem"
          />
        ) : ordens.length === 0 ? (
          <EmptyState
            icon="busca"
            titulo="Nada encontrado"
            descricao={`Nenhuma ordem corresponde a "${q}". Tente outro nome, modelo ou placa.`}
          />
        ) : (
          <ul style={s.lista}>
            {ordens.map((o) => (
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
  busca: { display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16 },
  buscaInput: { flex: 1, height: 40, borderRadius: 8, border: '1px solid #2d333f', background: '#171a21', color: '#e6e8ec', padding: '0 12px', fontSize: 14 },
  buscaBtn: { height: 40, padding: '0 16px', borderRadius: 8, border: '1px solid #2d333f', background: '#171a21', color: '#e6e8ec', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  limpar: { fontSize: 13, color: '#7aa7ff', textDecoration: 'none' },
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
