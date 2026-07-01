import { createClient } from '@/utils/supabase/server'
import { sair } from '@/app/auth/actions'
import { redirect } from 'next/navigation'
import Link from 'next/link'

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

// Define o intervalo [inicio, fim) a partir do filtro escolhido
function periodo(range: string) {
  const hoje = new Date()
  const y = hoje.getFullYear()
  const m = hoje.getMonth()
  if (range === '7dias') {
    const fim = new Date(y, m, hoje.getDate() + 1)
    const inicio = new Date(y, m, hoje.getDate() - 6)
    return { inicio, fim, label: 'Últimos 7 dias' }
  }
  if (range === 'mes-passado') {
    return { inicio: new Date(y, m - 1, 1), fim: new Date(y, m, 1), label: 'Mês passado' }
  }
  return { inicio: new Date(y, m, 1), fim: new Date(y, m + 1, 1), label: 'Este mês' }
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>
}) {
  const { range = 'mes' } = await searchParams
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: funcionario } = await supabase
    .from('funcionarios')
    .select('nome, cargo, tenant:tenants(nome)')
    .eq('auth_user_id', user.id)
    .single()

  const nomeEstetica =
    (funcionario?.tenant as { nome?: string } | null)?.nome ?? '—'
  const ehAdmin = funcionario?.cargo === 'dono' || funcionario?.cargo === 'gerente'

  const { inicio, fim, label } = periodo(range)
  const p_inicio = inicio.toISOString()
  const p_fim = fim.toISOString()

  const [{ data: resumoData }, { data: serie }, { data: top }] = await Promise.all([
    supabase.rpc('dashboard_resumo', { p_inicio, p_fim }),
    supabase.rpc('dashboard_serie_diaria', { p_inicio, p_fim }),
    supabase.rpc('dashboard_top_servicos', { p_inicio, p_fim, p_limite: 5 }),
  ])

  const r = (resumoData?.[0] ?? {}) as Record<string, number>
  const n = (v: unknown) => Number(v ?? 0)

  const dias = (serie ?? []) as { dia: string; faturamento: number }[]
  const maxDia = Math.max(1, ...dias.map((d) => n(d.faturamento)))

  const cards = [
    { rotulo: 'Faturamento', valor: brl.format(n(r.faturamento)), destaque: true },
    { rotulo: 'Lucro bruto', valor: brl.format(n(r.lucro_bruto)) },
    { rotulo: 'Custo de insumos', valor: brl.format(n(r.custo_insumos)) },
    { rotulo: 'Comissões', valor: brl.format(n(r.total_comissoes)) },
    { rotulo: 'Ordens concluídas', valor: String(n(r.num_ordens)) },
    { rotulo: 'Ticket médio', valor: brl.format(n(r.ticket_medio)) },
  ]

  return (
    <main style={s.wrap}>
      <div style={s.shell}>
        <header style={s.header}>
          <div>
            <p style={s.eyebrow}>{nomeEstetica}</p>
            <h1 style={s.title}>Faturamento</h1>
          </div>
          <form action={sair}>
            <button type="submit" style={s.sair}>Sair</button>
          </form>
        </header>

        <nav style={s.nav}>
          {[
            { k: 'mes', t: 'Este mês' },
            { k: 'mes-passado', t: 'Mês passado' },
            { k: '7dias', t: '7 dias' },
          ].map((o) => (
            <Link
              key={o.k}
              href={`/dashboard?range=${o.k}`}
              style={{ ...s.chip, ...(range === o.k ? s.chipAtivo : {}) }}
            >
              {o.t}
            </Link>
          ))}
          <Link href="/ordens" style={{ ...s.chip, marginLeft: 'auto' }}>
            Ordens
          </Link>
          <Link href="/clientes" style={s.chip}>
            Clientes
          </Link>
          <Link href="/agenda" style={s.chip}>
            Agenda
          </Link>
          {ehAdmin && (
            <Link href="/servicos" style={s.chip}>
              Serviços
            </Link>
          )}
          {ehAdmin && (
            <Link href="/insumos" style={s.chip}>
              Estoque
            </Link>
          )}
          {ehAdmin && (
            <Link href="/config/whatsapp" style={s.chip}>
              WhatsApp
            </Link>
          )}
          {ehAdmin && (
            <Link href="/equipe" style={s.chip}>
              Equipe
            </Link>
          )}
        </nav>

        <section style={s.grid}>
          {cards.map((c) => (
            <div key={c.rotulo} style={{ ...s.card, ...(c.destaque ? s.cardDestaque : {}) }}>
              <p style={s.cardRotulo}>{c.rotulo}</p>
              <p style={s.cardValor}>{c.valor}</p>
            </div>
          ))}
        </section>

        <section style={s.bloco}>
          <p style={s.blocoTitulo}>Faturamento por dia · {label}</p>
          {dias.length === 0 ? (
            <p style={s.vazio}>Nenhuma ordem concluída neste período ainda.</p>
          ) : (
            <div style={s.chart}>
              {dias.map((d) => (
                <div key={d.dia} style={s.barWrap} title={`${d.dia}: ${brl.format(n(d.faturamento))}`}>
                  <div style={{ ...s.bar, height: `${(n(d.faturamento) / maxDia) * 100}%` }} />
                  <span style={s.barLabel}>{d.dia.slice(8, 10)}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section style={s.bloco}>
          <p style={s.blocoTitulo}>Serviços mais vendidos</p>
          {(top?.length ?? 0) === 0 ? (
            <p style={s.vazio}>Sem dados no período.</p>
          ) : (
            <ul style={s.lista}>
              {(top as { servico: string; qtd: number; faturamento: number }[]).map((t) => (
                <li key={t.servico} style={s.linha}>
                  <span>{t.servico}</span>
                  <span style={s.linhaDir}>
                    <span style={s.qtd}>{n(t.qtd)}x</span>
                    {brl.format(n(t.faturamento))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  )
}

const s: Record<string, React.CSSProperties> = {
  wrap: { minHeight: '100dvh', background: '#0f1115', padding: 24, color: '#e6e8ec' },
  shell: { maxWidth: 880, margin: '0 auto' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  eyebrow: { fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', color: '#7aa7ff', margin: '0 0 2px' },
  title: { fontSize: 26, fontWeight: 600, margin: 0 },
  sair: { height: 36, borderRadius: 8, border: '1px solid #2d333f', background: 'transparent', color: '#e6e8ec', fontSize: 13, cursor: 'pointer', padding: '0 14px' },
  nav: { display: 'flex', gap: 8, marginBottom: 20, alignItems: 'center' },
  chip: { fontSize: 13, color: '#c2c7d0', textDecoration: 'none', padding: '6px 12px', borderRadius: 8, border: '1px solid #262b36' },
  chipAtivo: { background: '#16233d', borderColor: '#2c4a7a', color: '#cfe0ff' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 22 },
  card: { background: '#171a21', border: '1px solid #262b36', borderRadius: 12, padding: '14px 16px' },
  cardDestaque: { borderColor: '#2c4a7a', background: '#141b29' },
  cardRotulo: { fontSize: 12, color: '#9aa1ad', margin: '0 0 6px' },
  cardValor: { fontSize: 22, fontWeight: 600, margin: 0 },
  bloco: { background: '#171a21', border: '1px solid #262b36', borderRadius: 12, padding: '18px 20px', marginBottom: 16 },
  blocoTitulo: { fontSize: 13, fontWeight: 600, color: '#c2c7d0', margin: '0 0 16px' },
  chart: { display: 'flex', alignItems: 'flex-end', gap: 6, height: 160 },
  barWrap: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' },
  bar: { width: '100%', maxWidth: 28, background: '#3b82f6', borderRadius: '4px 4px 0 0', minHeight: 2 },
  barLabel: { fontSize: 11, color: '#6b7280', marginTop: 6 },
  vazio: { fontSize: 14, color: '#6b7280', margin: 0 },
  lista: { listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 },
  linha: { display: 'flex', justifyContent: 'space-between', fontSize: 14, padding: '8px 0', borderBottom: '1px solid #1e232c' },
  linhaDir: { display: 'flex', gap: 12, alignItems: 'center' },
  qtd: { fontSize: 12, color: '#7aa7ff' },
}
