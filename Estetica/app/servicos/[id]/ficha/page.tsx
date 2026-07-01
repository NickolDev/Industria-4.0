import { createClient } from '@/utils/supabase/server'
import { adicionarFicha, atualizarFicha, removerFicha } from '@/app/servicos/ficha'
import { redirect } from 'next/navigation'
import Link from 'next/link'

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const qtd = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 3 })

export default async function FichaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ erro?: string }>
}) {
  const { id } = await params
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
          <p style={s.vazio}>Você não tem permissão para editar fichas técnicas.</p>
        </div>
      </main>
    )
  }

  const { data: servico } = await supabase
    .from('servicos')
    .select('id, nome, preco_base')
    .eq('id', id)
    .single()

  if (!servico) {
    return (
      <main style={s.wrap}>
        <div style={s.shell}>
          <p style={s.vazio}>Serviço não encontrado.</p>
          <Link href="/servicos" style={s.voltar}>← Catálogo</Link>
        </div>
      </main>
    )
  }

  const [{ data: linhas }, { data: insumos }] = await Promise.all([
    supabase
      .from('ficha_tecnica')
      .select('id, qtd_consumida, insumo:insumos(id, nome, unidade, custo_unitario)')
      .eq('servico_id', id),
    supabase.from('insumos').select('id, nome, unidade').order('nome'),
  ])

  const custo = (linhas ?? []).reduce((acc: number, l: any) => {
    return acc + Number(l.qtd_consumida) * Number(l.insumo?.custo_unitario ?? 0)
  }, 0)
  const preco = Number(servico.preco_base)
  const margem = preco - custo

  return (
    <main style={s.wrap}>
      <div style={s.shell}>
        <Link href="/servicos" style={s.voltar}>← Catálogo</Link>
        <h1 style={s.title}>Ficha técnica</h1>
        <p style={s.sub}>{servico.nome}</p>

        {erro && <p style={s.erro}>{erro}</p>}

        <section style={s.resumo}>
          <div style={s.kpi}><span style={s.kpiR}>Preço</span><span style={s.kpiV}>{brl.format(preco)}</span></div>
          <div style={s.kpi}><span style={s.kpiR}>Custo de insumos</span><span style={s.kpiV}>{brl.format(custo)}</span></div>
          <div style={s.kpi}><span style={s.kpiR}>Margem (sem comissão)</span><span style={{ ...s.kpiV, color: margem >= 0 ? '#86e0ab' : '#f4a7ab' }}>{brl.format(margem)}</span></div>
        </section>

        <section style={s.bloco}>
          <p style={s.blocoTitulo}>Insumos consumidos</p>
          {(linhas?.length ?? 0) === 0 ? (
            <p style={s.vazio}>Nenhum insumo na ficha. O custo deste serviço está em zero.</p>
          ) : (
            <ul style={s.lista}>
              {(linhas as any[]).map((l) => (
                <li key={l.id} style={s.row}>
                  <span style={s.rowNome}>{l.insumo?.nome}</span>
                  <form action={atualizarFicha} style={s.rowForm}>
                    <input type="hidden" name="servico_id" value={id} />
                    <input type="hidden" name="id" value={l.id} />
                    <input name="qtd" defaultValue={Number(l.qtd_consumida)} style={s.inputMini} inputMode="decimal" />
                    <span style={s.unid}>{l.insumo?.unidade}</span>
                    <button type="submit" style={s.salvar}>Salvar</button>
                  </form>
                  <span style={s.custoLinha}>
                    {brl.format(Number(l.qtd_consumida) * Number(l.insumo?.custo_unitario ?? 0))}
                  </span>
                  <form action={removerFicha}>
                    <input type="hidden" name="servico_id" value={id} />
                    <input type="hidden" name="id" value={l.id} />
                    <button type="submit" style={s.remover} aria-label="Remover">×</button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section style={s.bloco}>
          <p style={s.blocoTitulo}>Adicionar insumo</p>
          {(insumos?.length ?? 0) === 0 ? (
            <p style={s.vazio}>
              Cadastre insumos primeiro em <Link href="/insumos" style={s.link}>Estoque</Link>.
            </p>
          ) : (
            <form action={adicionarFicha} style={s.addForm}>
              <input type="hidden" name="servico_id" value={id} />
              <select name="insumo_id" required defaultValue="" style={s.input}>
                <option value="" disabled>Escolha o insumo…</option>
                {(insumos as any[]).map((i) => (
                  <option key={i.id} value={i.id}>{i.nome} ({i.unidade})</option>
                ))}
              </select>
              <input name="qtd" placeholder="Qtd por serviço" required style={s.input} inputMode="decimal" />
              <button type="submit" style={s.button}>Adicionar</button>
            </form>
          )}
        </section>
      </div>
    </main>
  )
}

const s: Record<string, React.CSSProperties> = {
  wrap: { minHeight: '100dvh', background: '#0f1115', padding: 24, color: '#e6e8ec' },
  shell: { maxWidth: 560, margin: '0 auto' },
  voltar: { display: 'inline-block', marginBottom: 12, fontSize: 13, color: '#7aa7ff', textDecoration: 'none' },
  title: { fontSize: 24, fontWeight: 600, margin: 0 },
  sub: { fontSize: 14, color: '#9aa1ad', margin: '4px 0 18px' },
  resumo: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 14 },
  kpi: { background: '#171a21', border: '1px solid #262b36', borderRadius: 10, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 4 },
  kpiR: { fontSize: 11, color: '#9aa1ad' },
  kpiV: { fontSize: 17, fontWeight: 600 },
  bloco: { background: '#171a21', border: '1px solid #262b36', borderRadius: 12, padding: '16px 18px', marginBottom: 14 },
  blocoTitulo: { fontSize: 13, fontWeight: 600, color: '#c2c7d0', margin: '0 0 14px' },
  lista: { listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 },
  row: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '8px 0', borderBottom: '1px solid #1e232c' },
  rowNome: { fontSize: 14, fontWeight: 500, flex: 1, minWidth: 100 },
  rowForm: { display: 'flex', alignItems: 'center', gap: 6 },
  inputMini: { width: 80, height: 32, borderRadius: 6, border: '1px solid #2d333f', background: '#0f1115', color: '#e6e8ec', padding: '0 8px', fontSize: 13 },
  unid: { fontSize: 12, color: '#9aa1ad' },
  salvar: { height: 32, borderRadius: 6, border: '1px solid #2c4a7a', background: '#16233d', color: '#cfe0ff', fontSize: 12, cursor: 'pointer', padding: '0 10px' },
  custoLinha: { fontSize: 13, color: '#c2c7d0', minWidth: 70, textAlign: 'right' },
  remover: { width: 30, height: 32, borderRadius: 6, border: '1px solid #2d333f', background: 'transparent', color: '#9aa1ad', fontSize: 16, cursor: 'pointer' },
  addForm: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  input: { height: 40, borderRadius: 8, border: '1px solid #2d333f', background: '#0f1115', color: '#e6e8ec', padding: '0 12px', fontSize: 14, flex: 1, minWidth: 120 },
  button: { height: 40, borderRadius: 8, border: 'none', background: '#3b82f6', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', padding: '0 18px' },
  erro: { background: '#2a1416', border: '1px solid #5c2326', color: '#f4a7ab', fontSize: 13, padding: '8px 12px', borderRadius: 8, margin: '0 0 14px' },
  vazio: { fontSize: 14, color: '#6b7280', margin: 0 },
  link: { color: '#7aa7ff', textDecoration: 'none' },
}
