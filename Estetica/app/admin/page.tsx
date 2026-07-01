import { createClient } from '@/utils/supabase/server'
import { criarEstetica, mudarStatus, editarCobranca } from '@/app/admin/actions'
import { sair } from '@/app/auth/actions'
import { redirect } from 'next/navigation'

const brl = (v: number | null) =>
  v == null ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const dataBR = (d: string | null) => (d ? d.split('-').reverse().join('/') : '—')
function quando(ts: string | null) {
  if (!ts) return 'nunca'
  const dias = Math.floor((Date.now() - new Date(ts).getTime()) / 86400000)
  if (dias <= 0) return 'hoje'
  if (dias === 1) return 'ontem'
  return `há ${dias} dias`
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; erro?: string }>
}) {
  const { ok, erro } = await searchParams
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: ehPlataforma } = await supabase.rpc('is_plataforma_admin')
  if (!ehPlataforma) redirect('/dashboard')

  const { data: esteticas } = await supabase
    .from('tenants')
    .select('id, nome, status, plano, valor_mensal, vencimento, ultimo_acesso, obs')
    .order('nome')

  const lista = (esteticas ?? []) as any[]
  const ativos = lista.filter((t) => t.status === 'ativo').length
  const suspensos = lista.filter((t) => t.status === 'suspenso').length
  const receita = lista
    .filter((t) => t.status === 'ativo')
    .reduce((a, t) => a + Number(t.valor_mensal ?? 0), 0)

  return (
    <main style={s.wrap}>
      <div style={s.shell}>
        <header style={s.top}>
          <h1 style={s.title}>Plataforma</h1>
          <form action={sair}>
            <button type="submit" style={s.sair}>Sair</button>
          </form>
        </header>

        {ok && <p style={s.ok}>Feito.</p>}
        {erro && <p style={s.erro}>{erro}</p>}

        <div style={s.kpis}>
          <div style={s.kpi}><span style={s.kpiN}>{lista.length}</span><span style={s.kpiL}>estéticas</span></div>
          <div style={s.kpi}><span style={s.kpiN}>{ativos}</span><span style={s.kpiL}>ativas</span></div>
          <div style={s.kpi}><span style={s.kpiN}>{suspensos}</span><span style={s.kpiL}>suspensas</span></div>
          <div style={s.kpi}><span style={s.kpiN}>{brl(receita)}</span><span style={s.kpiL}>receita/mês</span></div>
        </div>

        {/* Nova estética */}
        <section style={s.bloco}>
          <p style={s.blocoTitulo}>Nova estética</p>
          <form action={criarEstetica} style={s.formNova}>
            <input name="nome_estetica" placeholder="Nome da estética" style={s.input} />
            <input name="nome_dono" placeholder="Nome do dono" style={s.input} />
            <input name="email" type="email" placeholder="E-mail de acesso" style={s.input} />
            <input name="senha" type="text" placeholder="Senha (mín. 6)" style={s.input} />
            <input name="plano" placeholder="Plano (ex: Mensal)" style={s.input} />
            <input name="valor_mensal" placeholder="Valor (ex: 99,90)" style={s.input} />
            <label style={s.lab}>Vencimento<input name="vencimento" type="date" style={s.input} /></label>
            <button type="submit" style={s.criar}>Criar estética</button>
          </form>
          <p style={s.aviso}>A senha é definida por você e entregue ao dono. Ele pode trocá-la depois.</p>
        </section>

        {/* Lista */}
        <section>
          {lista.length === 0 ? (
            <p style={s.vazio}>Nenhuma estética ainda.</p>
          ) : (
            lista.map((t) => (
              <div key={t.id} style={s.card}>
                <div style={s.cardTop}>
                  <div>
                    <p style={s.nome}>{t.nome}</p>
                    <p style={s.meta}>Último acesso: {quando(t.ultimo_acesso)}</p>
                  </div>
                  <span style={{ ...s.badge, ...badge(t.status) }}>{rotulo(t.status)}</span>
                </div>

                <form action={editarCobranca} style={s.formCob}>
                  <input type="hidden" name="id" value={t.id} />
                  <input name="plano" defaultValue={t.plano ?? ''} placeholder="Plano" style={s.inputSm} />
                  <input name="valor_mensal" defaultValue={t.valor_mensal ?? ''} placeholder="Valor" style={s.inputSm} />
                  <input name="vencimento" type="date" defaultValue={t.vencimento ?? ''} style={s.inputSm} />
                  <input name="obs" defaultValue={t.obs ?? ''} placeholder="Anotações" style={{ ...s.inputSm, flex: 2 }} />
                  <button type="submit" style={s.salvar}>Salvar</button>
                </form>

                <div style={s.acoes}>
                  {t.status !== 'ativo' && (
                    <form action={mudarStatus}>
                      <input type="hidden" name="id" value={t.id} />
                      <input type="hidden" name="status" value="ativo" />
                      <button type="submit" style={{ ...s.acao, ...s.acaoOk }}>Ativar</button>
                    </form>
                  )}
                  {t.status !== 'suspenso' && (
                    <form action={mudarStatus}>
                      <input type="hidden" name="id" value={t.id} />
                      <input type="hidden" name="status" value="suspenso" />
                      <button type="submit" style={{ ...s.acao, ...s.acaoWarn }}>Suspender</button>
                    </form>
                  )}
                  {t.status !== 'cancelado' && (
                    <form action={mudarStatus}>
                      <input type="hidden" name="id" value={t.id} />
                      <input type="hidden" name="status" value="cancelado" />
                      <button type="submit" style={{ ...s.acao, ...s.acaoBad }}>Cancelar</button>
                    </form>
                  )}
                </div>
              </div>
            ))
          )}
        </section>
      </div>
    </main>
  )
}

function rotulo(st: string) {
  return st === 'ativo' ? 'Ativa' : st === 'suspenso' ? 'Suspensa' : 'Cancelada'
}
function badge(st: string): React.CSSProperties {
  if (st === 'ativo') return { background: '#13211a', color: '#86e0ab', borderColor: '#245c3e' }
  if (st === 'suspenso') return { background: '#2a2412', color: '#e6c34a', borderColor: '#5c4f23' }
  return { background: '#2a1416', color: '#f4a7ab', borderColor: '#5c2326' }
}

const s: Record<string, React.CSSProperties> = {
  wrap: { minHeight: '100dvh', background: '#0f1115', color: '#e6e8ec', padding: 24 },
  shell: { maxWidth: 860, margin: '0 auto' },
  top: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  title: { fontSize: 26, fontWeight: 700, margin: 0 },
  sair: { height: 36, borderRadius: 8, border: '1px solid #2d333f', background: 'transparent', color: '#e6e8ec', fontSize: 13, cursor: 'pointer', padding: '0 14px' },
  kpis: { display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 18 },
  kpi: { flex: 1, minWidth: 130, background: '#171a21', border: '1px solid #262b36', borderRadius: 12, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 2 },
  kpiN: { fontSize: 22, fontWeight: 700 },
  kpiL: { fontSize: 12, color: '#9aa1ad' },
  bloco: { background: '#171a21', border: '1px solid #262b36', borderRadius: 12, padding: '16px 18px', marginBottom: 18 },
  blocoTitulo: { fontSize: 13, fontWeight: 600, color: '#c2c7d0', margin: '0 0 12px' },
  formNova: { display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' },
  lab: { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, color: '#9aa1ad' },
  input: { height: 40, borderRadius: 8, border: '1px solid #2d333f', background: '#0f1115', color: '#e6e8ec', padding: '0 12px', fontSize: 14, flex: 1, minWidth: 130 },
  criar: { height: 40, borderRadius: 8, border: 'none', background: '#3b82f6', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', padding: '0 18px' },
  aviso: { fontSize: 12, color: '#6b7280', margin: '10px 0 0' },
  card: { background: '#171a21', border: '1px solid #262b36', borderRadius: 12, padding: '14px 16px', marginBottom: 10 },
  cardTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  nome: { fontSize: 16, fontWeight: 600, margin: 0 },
  meta: { fontSize: 12, color: '#9aa1ad', margin: '2px 0 0' },
  badge: { fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 999, border: '1px solid' },
  formCob: { display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 },
  inputSm: { height: 34, borderRadius: 7, border: '1px solid #2d333f', background: '#0f1115', color: '#e6e8ec', padding: '0 10px', fontSize: 13, flex: 1, minWidth: 90 },
  salvar: { height: 34, borderRadius: 7, border: '1px solid #2d333f', background: '#1f2430', color: '#e6e8ec', fontSize: 13, cursor: 'pointer', padding: '0 14px' },
  acoes: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  acao: { height: 32, borderRadius: 7, border: '1px solid', background: 'transparent', fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: '0 14px' },
  acaoOk: { color: '#86e0ab', borderColor: '#245c3e' },
  acaoWarn: { color: '#e6c34a', borderColor: '#5c4f23' },
  acaoBad: { color: '#f4a7ab', borderColor: '#5c2326' },
  ok: { background: '#13211a', border: '1px solid #245c3e', color: '#86e0ab', fontSize: 13, padding: '8px 12px', borderRadius: 8, margin: '0 0 14px' },
  erro: { background: '#2a1416', border: '1px solid #5c2326', color: '#f4a7ab', fontSize: 13, padding: '8px 12px', borderRadius: 8, margin: '0 0 14px' },
  vazio: { fontSize: 14, color: '#6b7280' },
}
