import { createClient } from '@/utils/supabase/server'
import { atualizarCliente, adicionarVeiculo, removerVeiculo } from '@/app/clientes/actions'
import { abrirOrdemVeiculo } from '@/app/ordens/actions'
import { redirect } from 'next/navigation'
import Link from 'next/link'

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const data = (iso: string) => new Date(iso).toLocaleDateString('pt-BR')

const statusLabel: Record<string, string> = {
  aberta: 'Aberta', em_andamento: 'Em andamento', pronto: 'Pronto', entregue: 'Entregue', cancelada: 'Cancelada',
}

export default async function ClientePage({
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

  const { data: cliente } = await supabase
    .from('clientes')
    .select('id, nome, telefone, email')
    .eq('id', id)
    .single()

  if (!cliente) {
    return (
      <main style={s.wrap}>
        <div style={s.shell}>
          <p style={s.vazio}>Cliente não encontrado.</p>
          <Link href="/clientes" style={s.voltar}>← Clientes</Link>
        </div>
      </main>
    )
  }

  const [{ data: veiculos }, { data: ordens }] = await Promise.all([
    supabase.from('veiculos').select('id, modelo, placa, cor, observacoes').eq('cliente_id', id).order('modelo'),
    supabase
      .from('ordens_servico')
      .select('id, status, valor_total, criado_em, veiculo_id')
      .eq('cliente_id', id)
      .order('criado_em', { ascending: false }),
  ])

  const ordensPorVeiculo = (veiculoId: string) =>
    (ordens ?? []).filter((o: any) => o.veiculo_id === veiculoId)

  return (
    <main style={s.wrap}>
      <div style={s.shell}>
        <Link href="/clientes" style={s.voltar}>← Clientes</Link>
        <h1 style={s.title}>{cliente.nome}</h1>

        {erro && <p style={s.erro}>{erro}</p>}

        {/* Dados do cliente */}
        <section style={s.bloco}>
          <p style={s.blocoTitulo}>Dados</p>
          <form action={atualizarCliente} style={s.dados}>
            <input type="hidden" name="id" value={id} />
            <input name="nome" defaultValue={cliente.nome} placeholder="Nome" style={s.input} />
            <input name="telefone" defaultValue={cliente.telefone ?? ''} placeholder="Telefone" style={s.input} />
            <input name="email" defaultValue={cliente.email ?? ''} placeholder="E-mail" style={s.input} />
            <button type="submit" style={s.salvar}>Salvar</button>
          </form>
        </section>

        {/* Veículos com histórico */}
        <p style={s.secaoTitulo}>Veículos</p>
        {(veiculos?.length ?? 0) === 0 ? (
          <p style={s.vazio}>Nenhum veículo cadastrado.</p>
        ) : (
          (veiculos as any[]).map((v) => {
            const hist = ordensPorVeiculo(v.id)
            const concluidas = hist.filter((o: any) => o.status === 'pronto' || o.status === 'entregue').length
            return (
              <section key={v.id} style={s.bloco}>
                <div style={s.veicHead}>
                  <div>
                    <p style={s.veicNome}>{[v.modelo, v.placa].filter(Boolean).join(' · ') || 'Veículo'}</p>
                    <p style={s.veicSub}>
                      {v.cor || '—'}{concluidas > 0 ? ` · ${concluidas} serviço(s) concluído(s)` : ''}
                    </p>
                    {v.observacoes && <p style={s.obs}>{v.observacoes}</p>}
                  </div>
                  <div style={s.veicAcoes}>
                    <form action={abrirOrdemVeiculo}>
                      <input type="hidden" name="cliente_id" value={id} />
                      <input type="hidden" name="veiculo_id" value={v.id} />
                      <button type="submit" style={s.novaOrdem}>Nova ordem</button>
                    </form>
                    <form action={removerVeiculo}>
                      <input type="hidden" name="cliente_id" value={id} />
                      <input type="hidden" name="veiculo_id" value={v.id} />
                      <button type="submit" style={s.remover} aria-label="Remover veículo">×</button>
                    </form>
                  </div>
                </div>

                {hist.length > 0 && (
                  <ul style={s.hist}>
                    {hist.map((o: any) => (
                      <li key={o.id}>
                        <Link href={`/ordens/${o.id}`} style={s.histLinha}>
                          <span style={s.histData}>{data(o.criado_em)}</span>
                          <span style={s.histStatus}>{statusLabel[o.status] ?? o.status}</span>
                          <span style={s.histValor}>{brl.format(Number(o.valor_total ?? 0))}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )
          })
        )}

        {/* Adicionar veículo */}
        <section style={s.bloco}>
          <p style={s.blocoTitulo}>Adicionar veículo</p>
          <form action={adicionarVeiculo} style={s.veicForm}>
            <input type="hidden" name="cliente_id" value={id} />
            <input name="modelo" placeholder="Modelo" style={s.input} />
            <input name="placa" placeholder="Placa" style={s.input} />
            <input name="cor" placeholder="Cor" style={s.input} />
            <input name="observacoes" placeholder="Observações (ex: risco no para-choque)" style={{ ...s.input, flexBasis: '100%' }} />
            <button type="submit" style={s.button}>Adicionar veículo</button>
          </form>
        </section>
      </div>
    </main>
  )
}

const s: Record<string, React.CSSProperties> = {
  wrap: { minHeight: '100dvh', background: '#0f1115', padding: 24, color: '#e6e8ec' },
  shell: { maxWidth: 600, margin: '0 auto' },
  voltar: { display: 'inline-block', marginBottom: 12, fontSize: 13, color: '#7aa7ff', textDecoration: 'none' },
  title: { fontSize: 24, fontWeight: 600, margin: '0 0 16px' },
  bloco: { background: '#171a21', border: '1px solid #262b36', borderRadius: 12, padding: '16px 18px', marginBottom: 12 },
  blocoTitulo: { fontSize: 13, fontWeight: 600, color: '#c2c7d0', margin: '0 0 12px' },
  secaoTitulo: { fontSize: 13, fontWeight: 600, color: '#c2c7d0', margin: '20px 0 10px' },
  dados: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  input: { height: 40, borderRadius: 8, border: '1px solid #2d333f', background: '#0f1115', color: '#e6e8ec', padding: '0 12px', fontSize: 14, flex: 1, minWidth: 120 },
  salvar: { height: 40, borderRadius: 8, border: '1px solid #2c4a7a', background: '#16233d', color: '#cfe0ff', fontSize: 13, cursor: 'pointer', padding: '0 14px' },
  veicHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
  veicNome: { fontSize: 15, fontWeight: 600, margin: 0 },
  veicSub: { fontSize: 13, color: '#9aa1ad', margin: '3px 0 0' },
  obs: { fontSize: 12, color: '#e6cf86', margin: '6px 0 0' },
  veicAcoes: { display: 'flex', alignItems: 'center', gap: 6 },
  novaOrdem: { height: 36, borderRadius: 8, border: 'none', background: '#3b82f6', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: '0 14px' },
  remover: { width: 30, height: 36, borderRadius: 8, border: '1px solid #2d333f', background: 'transparent', color: '#9aa1ad', fontSize: 16, cursor: 'pointer' },
  hist: { listStyle: 'none', padding: 0, margin: '12px 0 0', display: 'flex', flexDirection: 'column', gap: 2, borderTop: '1px solid #1e232c', paddingTop: 8 },
  histLinha: { display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none', color: '#c2c7d0', fontSize: 13, padding: '6px 0' },
  histData: { color: '#9aa1ad', minWidth: 80 },
  histStatus: { flex: 1 },
  histValor: { fontWeight: 600, color: '#e6e8ec' },
  veicForm: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  button: { height: 40, borderRadius: 8, border: 'none', background: '#3b82f6', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', padding: '0 18px' },
  erro: { background: '#2a1416', border: '1px solid #5c2326', color: '#f4a7ab', fontSize: 13, padding: '8px 12px', borderRadius: 8, margin: '0 0 14px' },
  vazio: { fontSize: 14, color: '#6b7280' },
}
