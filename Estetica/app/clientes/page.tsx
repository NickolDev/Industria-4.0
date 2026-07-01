import { createClient } from '@/utils/supabase/server'
import { criarCliente } from '@/app/clientes/actions'
import EmptyState from '@/components/EmptyState'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; erro?: string }>
}) {
  const { q, erro } = await searchParams
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  let query = supabase
    .from('clientes')
    .select('id, nome, telefone, veiculos(id, modelo, placa)')
    .order('nome')
    .limit(100)
  if (q && q.trim()) query = query.ilike('nome', `%${q.trim()}%`)
  const { data: clientes } = await query

  return (
    <main style={s.wrap}>
      <div style={s.shell}>
        <Link href="/dashboard" style={s.voltar}>← Painel</Link>
        <h1 style={s.title}>Clientes</h1>

        {erro && <p style={s.erro}>{erro}</p>}

        <form style={s.busca}>
          <input name="q" defaultValue={q ?? ''} placeholder="Buscar por nome…" style={s.input} />
          <button type="submit" style={s.buscaBtn}>Buscar</button>
        </form>

        <section style={s.bloco}>
          <p style={s.blocoTitulo}>Novo cliente</p>
          <form action={criarCliente} style={s.novoForm}>
            <input name="nome" placeholder="Nome" required style={{ ...s.input, flex: 2 }} />
            <input name="telefone" placeholder="Telefone" style={s.input} />
            <input name="veiculo_modelo" placeholder="Veículo (opcional)" style={s.input} />
            <input name="veiculo_placa" placeholder="Placa (opcional)" style={s.input} />
            <button type="submit" style={s.button}>Cadastrar</button>
          </form>
        </section>

        {(clientes?.length ?? 0) === 0 ? (
          q ? (
            <p style={s.vazio}>Nenhum cliente encontrado.</p>
          ) : (
            <EmptyState
              icon="clientes"
              titulo="Nenhum cliente ainda"
              descricao="Seus clientes aparecem aqui conforme você cadastra ou conforme eles agendam pelo link online. Cadastre o primeiro acima."
            />
          )
        ) : (
          <ul style={s.lista}>
            {(clientes as any[]).map((c) => (
              <li key={c.id}>
                <Link href={`/clientes/${c.id}`} style={s.row}>
                  <div>
                    <p style={s.nome}>{c.nome}</p>
                    <p style={s.sub}>{c.telefone || 'Sem telefone'}</p>
                  </div>
                  <span style={s.contagem}>
                    {(c.veiculos?.length ?? 0)} veículo{(c.veiculos?.length ?? 0) === 1 ? '' : 's'}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  )
}

const s: Record<string, React.CSSProperties> = {
  wrap: { minHeight: '100dvh', background: '#0f1115', padding: 24, color: '#e6e8ec' },
  shell: { maxWidth: 640, margin: '0 auto' },
  voltar: { display: 'inline-block', marginBottom: 12, fontSize: 13, color: '#7aa7ff', textDecoration: 'none' },
  title: { fontSize: 24, fontWeight: 600, margin: '0 0 16px' },
  busca: { display: 'flex', gap: 8, marginBottom: 14 },
  buscaBtn: { height: 40, borderRadius: 8, border: '1px solid #2d333f', background: 'transparent', color: '#c2c7d0', fontSize: 14, cursor: 'pointer', padding: '0 16px' },
  bloco: { background: '#171a21', border: '1px solid #262b36', borderRadius: 12, padding: '16px 18px', marginBottom: 16 },
  blocoTitulo: { fontSize: 13, fontWeight: 600, color: '#c2c7d0', margin: '0 0 14px' },
  novoForm: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  input: { height: 40, borderRadius: 8, border: '1px solid #2d333f', background: '#0f1115', color: '#e6e8ec', padding: '0 12px', fontSize: 14, flex: 1, minWidth: 110 },
  button: { height: 40, borderRadius: 8, border: 'none', background: '#3b82f6', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', padding: '0 18px' },
  lista: { listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 },
  row: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', textDecoration: 'none', color: '#e6e8ec', background: '#171a21', border: '1px solid #262b36', borderRadius: 10, padding: '14px 16px' },
  nome: { fontSize: 15, fontWeight: 500, margin: 0 },
  sub: { fontSize: 13, color: '#9aa1ad', margin: '2px 0 0' },
  contagem: { fontSize: 12, color: '#7aa7ff', background: '#16233d', padding: '3px 10px', borderRadius: 6 },
  erro: { background: '#2a1416', border: '1px solid #5c2326', color: '#f4a7ab', fontSize: 13, padding: '8px 12px', borderRadius: 8, margin: '0 0 14px' },
  vazio: { fontSize: 14, color: '#6b7280' },
}
