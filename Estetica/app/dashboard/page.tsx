import { createClient } from '@/utils/supabase/server'
import { sair } from '@/app/auth/actions'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import styles from './dashboard.module.css'

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

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

  const { inicio, fim, label } = periodo(range)
  const p_inicio = inicio.toISOString()
  const p_fim = fim.toISOString()

  const [
    { data: funcionario },
    ,
    { data: ehPlataforma },
    { data: resumoData },
    { data: serie },
    { data: top },
  ] = await Promise.all([
    supabase.from('funcionarios').select('nome, cargo, tenant:tenants(nome)').eq('auth_user_id', user.id).single(),
    supabase.rpc('registrar_acesso'),
    supabase.rpc('is_plataforma_admin'),
    supabase.rpc('dashboard_resumo', { p_inicio, p_fim }),
    supabase.rpc('dashboard_serie_diaria', { p_inicio, p_fim }),
    supabase.rpc('dashboard_top_servicos', { p_inicio, p_fim, p_limite: 5 }),
  ])

  const nomeEstetica =
    (funcionario?.tenant as { nome?: string } | null)?.nome ?? 'Estética'
  const ehAdmin = funcionario?.cargo === 'dono' || funcionario?.cargo === 'gerente'

  const r = (resumoData?.[0] ?? {}) as Record<string, number>
  const n = (v: unknown) => Number(v ?? 0)

  const dias = (serie ?? []) as { dia: string; faturamento: number }[]
  const maxDia = Math.max(1, ...dias.map((d) => n(d.faturamento)))

  const topServicos = (top ?? []) as { servico: string; qtd: number; faturamento: number }[]
  const maxServ = Math.max(1, ...topServicos.map((t) => n(t.faturamento)))

  const numOrdens = n(r.num_ordens)
  const periodos = [
    { k: 'mes', t: 'Este mês' },
    { k: 'mes-passado', t: 'Mês passado' },
    { k: '7dias', t: '7 dias' },
  ]
  const secundarios = [
    { rotulo: 'Lucro bruto', valor: brl.format(n(r.lucro_bruto)) },
    { rotulo: 'Custo de insumos', valor: brl.format(n(r.custo_insumos)) },
    { rotulo: 'Comissões', valor: brl.format(n(r.total_comissoes)) },
  ]

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.top}>
          <div>
            <p className={styles.brand}>{nomeEstetica}</p>
            <h1 className={styles.h1}>Visão geral</h1>
          </div>
          <form action={sair}>
            <button type="submit" className={styles.logout}>Sair</button>
          </form>
        </header>

        <nav className={styles.nav}>
          <Link href="/dashboard" className={`${styles.navlink} ${styles.navactive}`}>Visão geral</Link>
          <Link href="/ordens" className={styles.navlink}>Ordens</Link>
          <Link href="/clientes" className={styles.navlink}>Clientes</Link>
          <Link href="/agenda" className={styles.navlink}>Agenda</Link>
          {ehAdmin && <span className={styles.navdiv} />}
          {ehAdmin && <Link href="/servicos" className={styles.navlink}>Serviços</Link>}
          {ehAdmin && <Link href="/insumos" className={styles.navlink}>Estoque</Link>}
          {ehAdmin && <Link href="/equipe" className={styles.navlink}>Equipe</Link>}
          {ehAdmin && <Link href="/config/whatsapp" className={styles.navlink}>WhatsApp</Link>}
          {ehAdmin && <Link href="/config/agendamento" className={styles.navlink}>Agendar online</Link>}
          {ehPlataforma && <Link href="/admin" className={`${styles.navlink} ${styles.navplat}`}>Plataforma</Link>}
        </nav>

        <section className={styles.hero}>
          <div className={styles.heroHead}>
            <p className={styles.heroLabel}>Faturamento · {label}</p>
            <div className={styles.seg}>
              {periodos.map((o) => (
                <Link
                  key={o.k}
                  href={`/dashboard?range=${o.k}`}
                  className={`${styles.segbtn} ${range === o.k ? styles.segon : ''}`}
                >
                  {o.t}
                </Link>
              ))}
            </div>
          </div>
          <p className={styles.heroValue}>{brl.format(n(r.faturamento))}</p>
          <p className={styles.heroSub}>
            <strong>{numOrdens}</strong> {numOrdens === 1 ? 'ordem concluída' : 'ordens concluídas'}
            <span className={styles.dot}>·</span>
            ticket médio <strong>{brl.format(n(r.ticket_medio))}</strong>
          </p>
        </section>

        <section className={styles.kpis}>
          {secundarios.map((c) => (
            <div key={c.rotulo} className={styles.kpi}>
              <p className={styles.kpiLabel}>{c.rotulo}</p>
              <p className={styles.kpiValue}>{c.valor}</p>
            </div>
          ))}
        </section>

        <section className={styles.card}>
          <p className={styles.cardTitle}>Faturamento por dia</p>
          {dias.length === 0 ? (
            <div className={styles.empty}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 3v18h18" /><path d="M7 14l3-3 3 3 4-5" />
              </svg>
              <span>Nenhuma ordem concluída neste período. Conclua uma ordem para ver o faturamento aqui.</span>
            </div>
          ) : (
            <div className={styles.chart}>
              <div className={styles.bars}>
                {dias.map((d) => (
                  <div
                    key={d.dia}
                    className={styles.barWrap}
                    title={`Dia ${d.dia.slice(8, 10)} · ${brl.format(n(d.faturamento))}`}
                  >
                    <div className={styles.bar} style={{ height: `${Math.max(3, (n(d.faturamento) / maxDia) * 100)}%` }} />
                    <span className={styles.barDay}>{d.dia.slice(8, 10)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className={styles.card}>
          <p className={styles.cardTitle}>Serviços mais vendidos</p>
          {topServicos.length === 0 ? (
            <div className={styles.empty}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
              </svg>
              <span>Nenhum serviço concluído neste período ainda.</span>
            </div>
          ) : (
            <ul className={styles.svcList}>
              {topServicos.map((t, i) => (
                <li key={t.servico} className={styles.svcRow}>
                  <span className={styles.rank}>{String(i + 1).padStart(2, '0')}</span>
                  <span className={styles.svcName}>{t.servico}</span>
                  <span className={styles.svcBarTrack}>
                    <span className={styles.svcBarFill} style={{ width: `${(n(t.faturamento) / maxServ) * 100}%` }} />
                  </span>
                  <span className={styles.svcQtd}>{n(t.qtd)}x</span>
                  <span className={styles.svcVal}>{brl.format(n(t.faturamento))}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  )
}
