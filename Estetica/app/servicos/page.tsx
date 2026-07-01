import { createClient } from '@/utils/supabase/server'
import { criarServico, salvarServico, setAtivo, removerServico } from '@/app/servicos/actions'
import { redirect } from 'next/navigation'
import Link from 'next/link'

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

export default async function ServicosPage({
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
          <h1 style={s.title}>Serviços</h1>
          <p style={s.vazio}>Você não tem permissão para gerenciar o catálogo.</p>
        </div>
      </main>
    )
  }

  const { data: servicos } = await supabase
    .from('servicos')
    .select('id, nome, tipo, preco_base, duracao_min, ativo')
    .order('tipo')
    .order('nome')

  const principais = (servicos ?? []).filter((x: any) => x.tipo === 'principal')
  const adicionais = (servicos ?? []).filter((x: any) => x.tipo === 'adicional')

  const Linha = ({ x }: { x: any }) => (
    <li style={{ ...s.row, opacity: x.ativo ? 1 : 0.5 }}>
      <span style={s.rowNome}>{x.nome}</span>
      <form action={salvarServico} style={s.rowForm}>
        <input type="hidden" name="id" value={x.id} />
        <span style={s.prefix}>R$</span>
        <input name="preco" defaultValue={Number(x.preco_base).toFixed(2)} style={s.inputMini} inputMode="decimal" />
        <input name="duracao" defaultValue={x.duracao_min} style={s.inputMini} inputMode="numeric" />
        <span style={s.unid}>min</span>
        <button type="submit" style={s.salvar}>Salvar</button>
      </form>
      <div style={s.rowAcoes}>
        <Link href={`/servicos/${x.id}/ficha`} style={s.toggle}>Ficha</Link>
        <form action={setAtivo}>
          <input type="hidden" name="id" value={x.id} />
          <input type="hidden" name="ativo" value={(!x.ativo).toString()} />
          <button type="submit" style={s.toggle}>{x.ativo ? 'Desativar' : 'Ativar'}</button>
        </form>
        <form action={removerServico}>
          <input type="hidden" name="id" value={x.id} />
          <button type="submit" style={s.remover} aria-label="Remover">×</button>
        </form>
      </div>
    </li>
  )

  return (
    <main style={s.wrap}>
      <div style={s.shell}>
        <Link href="/dashboard" style={s.voltar}>← Painel</Link>
        <h1 style={s.title}>Catálogo de serviços</h1>

        {erro && <p style={s.erro}>{erro}</p>}

        <section style={s.bloco}>
          <p style={s.blocoTitulo}>Novo serviço</p>
          <form action={criarServico} style={s.novoForm}>
            <input name="nome" placeholder="Nome (ex: Lavagem completa)" required style={s.input} />
            <select name="tipo" defaultValue="principal" style={s.input}>
              <option value="principal">Lavagem (principal)</option>
              <option value="adicional">Adicional</option>
            </select>
            <input name="preco" placeholder="Preço" required style={s.input} inputMode="decimal" />
            <input name="duracao" placeholder="Duração (min)" defaultValue="30" style={s.input} inputMode="numeric" />
            <button type="submit" style={s.button}>Adicionar</button>
          </form>
        </section>

        <section style={s.bloco}>
          <p style={s.blocoTitulo}>Lavagens</p>
          {principais.length === 0 ? <p style={s.vazio}>Nenhuma lavagem cadastrada.</p> : (
            <ul style={s.lista}>{principais.map((x: any) => <Linha key={x.id} x={x} />)}</ul>
          )}
        </section>

        <section style={s.bloco}>
          <p style={s.blocoTitulo}>Adicionais</p>
          {adicionais.length === 0 ? <p style={s.vazio}>Nenhum adicional cadastrado.</p> : (
            <ul style={s.lista}>{adicionais.map((x: any) => <Linha key={x.id} x={x} />)}</ul>
          )}
        </section>
      </div>
    </main>
  )
}

const s: Record<string, React.CSSProperties> = {
  wrap: { minHeight: '100dvh', background: '#0f1115', padding: 24, color: '#e6e8ec' },
  shell: { maxWidth: 640, margin: '0 auto' },
  voltar: { display: 'inline-block', marginBottom: 12, fontSize: 13, color: '#7aa7ff', textDecoration: 'none' },
  title: { fontSize: 24, fontWeight: 600, margin: '0 0 16px' },
  bloco: { background: '#171a21', border: '1px solid #262b36', borderRadius: 12, padding: '16px 18px', marginBottom: 14 },
  blocoTitulo: { fontSize: 13, fontWeight: 600, color: '#c2c7d0', margin: '0 0 14px' },
  novoForm: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  input: { height: 40, borderRadius: 8, border: '1px solid #2d333f', background: '#0f1115', color: '#e6e8ec', padding: '0 12px', fontSize: 14, flex: 1, minWidth: 120 },
  button: { height: 40, borderRadius: 8, border: 'none', background: '#3b82f6', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', padding: '0 18px' },
  lista: { listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 },
  row: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '8px 0', borderBottom: '1px solid #1e232c' },
  rowNome: { fontSize: 14, fontWeight: 500, flex: 1, minWidth: 120 },
  rowForm: { display: 'flex', alignItems: 'center', gap: 6 },
  prefix: { fontSize: 13, color: '#9aa1ad' },
  inputMini: { width: 64, height: 34, borderRadius: 6, border: '1px solid #2d333f', background: '#0f1115', color: '#e6e8ec', padding: '0 8px', fontSize: 13 },
  unid: { fontSize: 12, color: '#9aa1ad' },
  salvar: { height: 34, borderRadius: 6, border: '1px solid #2c4a7a', background: '#16233d', color: '#cfe0ff', fontSize: 12, cursor: 'pointer', padding: '0 10px' },
  rowAcoes: { display: 'flex', alignItems: 'center', gap: 6 },
  toggle: { height: 34, borderRadius: 6, border: '1px solid #2d333f', background: 'transparent', color: '#9aa1ad', fontSize: 12, cursor: 'pointer', padding: '0 10px' },
  remover: { width: 30, height: 34, borderRadius: 6, border: '1px solid #2d333f', background: 'transparent', color: '#9aa1ad', fontSize: 16, cursor: 'pointer' },
  erro: { background: '#2a1416', border: '1px solid #5c2326', color: '#f4a7ab', fontSize: 13, padding: '8px 12px', borderRadius: 8, margin: '0 0 14px' },
  vazio: { fontSize: 14, color: '#6b7280', margin: 0 },
}
