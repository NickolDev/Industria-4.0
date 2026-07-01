import { createClient } from '@/utils/supabase/server'
import { criarInsumo, ajustarMinimo, registrarEntrada, removerInsumo } from '@/app/insumos/actions'
import EmptyState from '@/components/EmptyState'
import { redirect } from 'next/navigation'
import Link from 'next/link'

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const qtd = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 3 })

export default async function InsumosPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>
}) {
  const { erro } = await searchParams
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: eu } = await supabase
    .from('funcionarios')
    .select('cargo')
    .eq('auth_user_id', user.id)
    .single()

  const ehAdmin = eu?.cargo === 'dono' || eu?.cargo === 'gerente'
  if (!ehAdmin) {
    return (
      <main style={s.wrap}>
        <div style={s.shell}>
          <h1 style={s.title}>Estoque</h1>
          <p style={s.vazio}>Você não tem permissão para gerenciar o estoque.</p>
        </div>
      </main>
    )
  }

  const [{ data: insumos }, { data: movs }] = await Promise.all([
    supabase
      .from('insumos')
      .select('id, nome, unidade, qtd_estoque, estoque_minimo, custo_unitario')
      .order('nome'),
    supabase
      .from('mov_estoque')
      .select('tipo, quantidade, motivo, criado_em, insumo:insumos(nome, unidade)')
      .order('criado_em', { ascending: false })
      .limit(15),
  ])

  const emAlerta = (insumos ?? []).filter(
    (i: any) => Number(i.estoque_minimo) > 0 && Number(i.qtd_estoque) <= Number(i.estoque_minimo)
  )

  return (
    <main style={s.wrap}>
      <div style={s.shell}>
        <Link href="/dashboard" style={s.voltar}>← Painel</Link>
        <h1 style={s.title}>Estoque e insumos</h1>

        {erro && <p style={s.erro}>{erro}</p>}

        {emAlerta.length > 0 && (
          <div style={s.alerta}>
            {emAlerta.length} insumo(s) no ponto de reposição:{' '}
            {emAlerta.map((i: any) => i.nome).join(', ')}.
          </div>
        )}

        <section style={s.bloco}>
          <p style={s.blocoTitulo}>Novo insumo</p>
          <form action={criarInsumo} style={s.novoForm}>
            <input name="nome" placeholder="Nome (ex: Shampoo)" required style={{ ...s.input, flex: 2 }} />
            <input name="unidade" placeholder="un / l / ml / kg" defaultValue="l" style={s.input} />
            <input name="qtd" placeholder="Qtd inicial" defaultValue="0" style={s.input} inputMode="decimal" />
            <input name="minimo" placeholder="Mínimo" defaultValue="0" style={s.input} inputMode="decimal" />
            <input name="custo" placeholder="Custo unit." defaultValue="0" style={s.input} inputMode="decimal" />
            <button type="submit" style={s.button}>Adicionar</button>
          </form>
        </section>

        <section style={s.grid}>
          {(insumos ?? []).length === 0 ? (
            <EmptyState
              icon="estoque"
              titulo="Estoque vazio"
              descricao="Cadastre seus insumos (shampoo, cera, panos…) para acompanhar consumo e receber alerta quando faltar."
            />
          ) : (
            (insumos as any[]).map((i) => {
              const baixo = Number(i.estoque_minimo) > 0 && Number(i.qtd_estoque) <= Number(i.estoque_minimo)
              return (
                <div key={i.id} style={s.card}>
                  <div style={s.cardHead}>
                    <span style={s.cardNome}>{i.nome}</span>
                    {baixo && <span style={s.badgeRepor}>repor</span>}
                  </div>
                  <p style={s.cardInfo}>
                    Em estoque: <strong>{qtd(Number(i.qtd_estoque))} {i.unidade}</strong>
                    {'  ·  '}Custo médio: {brl.format(Number(i.custo_unitario))}
                  </p>

                  <form action={ajustarMinimo} style={s.miniForm}>
                    <input type="hidden" name="id" value={i.id} />
                    <span style={s.miniLabel}>Mínimo</span>
                    <input name="minimo" defaultValue={Number(i.estoque_minimo)} style={s.inputMini} inputMode="decimal" />
                    <button type="submit" style={s.miniBtn}>Salvar</button>
                  </form>

                  <form action={registrarEntrada} style={s.miniForm}>
                    <input type="hidden" name="id" value={i.id} />
                    <span style={s.miniLabel}>Compra</span>
                    <input name="quantidade" placeholder="qtd" required style={s.inputMini} inputMode="decimal" />
                    <input name="custo" placeholder="custo un." required style={s.inputMini} inputMode="decimal" />
                    <button type="submit" style={{ ...s.miniBtn, ...s.miniBtnAzul }}>Registrar</button>
                  </form>

                  <form action={removerInsumo}>
                    <input type="hidden" name="id" value={i.id} />
                    <button type="submit" style={s.remover}>Remover</button>
                  </form>
                </div>
              )
            })
          )}
        </section>

        <section style={s.bloco}>
          <p style={s.blocoTitulo}>Últimas movimentações</p>
          {(movs?.length ?? 0) === 0 ? (
            <p style={s.vazio}>Sem movimentações ainda.</p>
          ) : (
            <ul style={s.movs}>
              {(movs as any[]).map((m, idx) => {
                const entrada = m.tipo === 'entrada'
                return (
                  <li key={idx} style={s.mov}>
                    <span style={{ ...s.movQtd, color: entrada ? '#86e0ab' : '#f4a7ab' }}>
                      {entrada ? '+' : '−'}{qtd(Number(m.quantidade))} {m.insumo?.unidade}
                    </span>
                    <span style={s.movNome}>{m.insumo?.nome}</span>
                    <span style={s.movMotivo}>{m.motivo}</span>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>
    </main>
  )
}

const s: Record<string, React.CSSProperties> = {
  wrap: { minHeight: '100dvh', background: '#0f1115', padding: 24, color: '#e6e8ec' },
  shell: { maxWidth: 720, margin: '0 auto' },
  voltar: { display: 'inline-block', marginBottom: 12, fontSize: 13, color: '#7aa7ff', textDecoration: 'none' },
  title: { fontSize: 24, fontWeight: 600, margin: '0 0 16px' },
  alerta: { background: '#2a2410', border: '1px solid #5c4d23', color: '#e6cf86', fontSize: 13, padding: '10px 14px', borderRadius: 10, marginBottom: 14 },
  bloco: { background: '#171a21', border: '1px solid #262b36', borderRadius: 12, padding: '16px 18px', marginBottom: 14 },
  blocoTitulo: { fontSize: 13, fontWeight: 600, color: '#c2c7d0', margin: '0 0 14px' },
  novoForm: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  input: { height: 40, borderRadius: 8, border: '1px solid #2d333f', background: '#0f1115', color: '#e6e8ec', padding: '0 12px', fontSize: 14, flex: 1, minWidth: 90 },
  button: { height: 40, borderRadius: 8, border: 'none', background: '#3b82f6', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', padding: '0 18px' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12, marginBottom: 14 },
  card: { background: '#171a21', border: '1px solid #262b36', borderRadius: 12, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 },
  cardHead: { display: 'flex', alignItems: 'center', gap: 8 },
  cardNome: { fontSize: 16, fontWeight: 600 },
  badgeRepor: { fontSize: 11, color: '#e6cf86', background: '#2a2410', border: '1px solid #5c4d23', padding: '1px 7px', borderRadius: 5 },
  cardInfo: { fontSize: 13, color: '#9aa1ad', margin: 0 },
  miniForm: { display: 'flex', alignItems: 'center', gap: 6 },
  miniLabel: { fontSize: 12, color: '#9aa1ad', width: 56 },
  inputMini: { width: 76, height: 32, borderRadius: 6, border: '1px solid #2d333f', background: '#0f1115', color: '#e6e8ec', padding: '0 8px', fontSize: 13 },
  miniBtn: { height: 32, borderRadius: 6, border: '1px solid #2d333f', background: 'transparent', color: '#c2c7d0', fontSize: 12, cursor: 'pointer', padding: '0 10px' },
  miniBtnAzul: { border: '1px solid #2c4a7a', background: '#16233d', color: '#cfe0ff' },
  remover: { alignSelf: 'flex-start', height: 30, borderRadius: 6, border: '1px solid #2d333f', background: 'transparent', color: '#9aa1ad', fontSize: 12, cursor: 'pointer', padding: '0 10px', marginTop: 2 },
  movs: { listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 },
  mov: { display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, padding: '6px 0', borderBottom: '1px solid #1e232c' },
  movQtd: { fontWeight: 600, minWidth: 90 },
  movNome: { flex: 1 },
  movMotivo: { color: '#9aa1ad', fontSize: 12 },
  vazio: { fontSize: 14, color: '#6b7280', margin: 0 },
}
