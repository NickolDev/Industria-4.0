import { createClient } from '@/utils/supabase/server'
import { adicionarItem, removerItem, fecharOrdem, entregarOrdem, cancelarOrdem } from '@/app/ordens/actions'
import ConfirmSubmit from '@/components/ConfirmSubmit'
import { redirect } from 'next/navigation'
import Link from 'next/link'

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

export default async function OrdemPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: ordem } = await supabase
    .from('ordens_servico')
    .select('id, status, valor_total, cliente:clientes(nome), veiculo:veiculos(modelo, placa, cor)')
    .eq('id', id)
    .single()

  if (!ordem) {
    return (
      <main style={s.wrap}>
        <div style={s.shell}>
          <p style={s.vazio}>Ordem não encontrada.</p>
          <Link href="/ordens" style={s.voltar}>← Voltar</Link>
        </div>
      </main>
    )
  }

  const [{ data: itens }, { data: servicos }, { data: funcionarios }] = await Promise.all([
    supabase
      .from('os_itens')
      .select('id, preco_cobrado, comissao_valor, servico:servicos(nome, tipo), funcionario:funcionarios(nome)')
      .eq('os_id', id),
    supabase.from('servicos').select('id, nome, tipo, preco_base').eq('ativo', true).order('tipo').order('nome'),
    supabase.from('funcionarios').select('id, nome').eq('ativo', true).order('nome'),
  ])

  const aberta = ordem.status === 'aberta' || ordem.status === 'em_andamento'
  const cliente = (ordem.cliente as { nome?: string } | null)?.nome ?? 'Sem cliente'
  const veic = ordem.veiculo as { modelo?: string; placa?: string; cor?: string } | null
  const principais = (servicos ?? []).filter((x: any) => x.tipo === 'principal')
  const adicionais = (servicos ?? []).filter((x: any) => x.tipo === 'adicional')

  return (
    <main style={s.wrap}>
      <div style={s.shell}>
        <Link href="/ordens" style={s.voltar}>← Ordens</Link>

        <header style={s.header}>
          <div>
            <h1 style={s.title}>{cliente}</h1>
            <p style={s.sub}>
              {[veic?.modelo, veic?.placa, veic?.cor].filter(Boolean).join(' · ') || 'Veículo não informado'}
            </p>
          </div>
          <span style={{ ...s.badge, ...(ordem.status === 'pronto' || ordem.status === 'entregue' ? s.badgeOk : s.badgeAberta) }}>
            {labelStatus(ordem.status)}
          </span>
        </header>

        {/* Itens da ordem */}
        <section style={s.bloco}>
          {(itens?.length ?? 0) === 0 ? (
            <p style={s.vazio}>Nenhum serviço adicionado ainda.</p>
          ) : (
            <ul style={s.itens}>
              {(itens as any[]).map((it) => (
                <li key={it.id} style={s.item}>
                  <div>
                    <span style={s.itemNome}>{it.servico?.nome ?? 'Serviço'}</span>
                    {it.servico?.tipo === 'adicional' && <span style={s.tagAdd}>adicional</span>}
                    <p style={s.itemSub}>
                      {it.funcionario?.nome ? `por ${it.funcionario.nome}` : 'sem responsável'}
                      {Number(it.comissao_valor) > 0 && ` · comissão ${brl.format(Number(it.comissao_valor))}`}
                    </p>
                  </div>
                  <div style={s.itemDir}>
                    <span style={s.itemPreco}>{brl.format(Number(it.preco_cobrado))}</span>
                    {aberta && (
                      <form action={removerItem}>
                        <input type="hidden" name="os_id" value={id} />
                        <input type="hidden" name="item_id" value={it.id} />
                        <ConfirmSubmit
                          label="×"
                          confirmLabel="Remover"
                          pergunta="Remover?"
                          style={s.remover}
                          confirmStyle={s.removerConfirma}
                        />
                      </form>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div style={s.totalLinha}>
            <span style={s.totalRotulo}>Total</span>
            <span style={s.totalValor}>{brl.format(Number(ordem.valor_total ?? 0))}</span>
          </div>
        </section>

        {/* Adicionar serviço */}
        {aberta && (
          <section style={s.bloco}>
            <p style={s.blocoTitulo}>Adicionar serviço</p>
            <form action={adicionarItem} style={s.form}>
              <input type="hidden" name="os_id" value={id} />
              <select name="servico_id" required style={s.input} defaultValue="">
                <option value="" disabled>Escolha o serviço…</option>
                {principais.length > 0 && (
                  <optgroup label="Lavagens">
                    {principais.map((x: any) => (
                      <option key={x.id} value={x.id}>{x.nome} — {brl.format(Number(x.preco_base))}</option>
                    ))}
                  </optgroup>
                )}
                {adicionais.length > 0 && (
                  <optgroup label="Adicionais">
                    {adicionais.map((x: any) => (
                      <option key={x.id} value={x.id}>{x.nome} — {brl.format(Number(x.preco_base))}</option>
                    ))}
                  </optgroup>
                )}
              </select>
              <select name="funcionario_id" style={s.input} defaultValue="">
                <option value="">Responsável (opcional)</option>
                {(funcionarios ?? []).map((f: any) => (
                  <option key={f.id} value={f.id}>{f.nome}</option>
                ))}
              </select>
              <input name="preco" placeholder="Preço (em branco = padrão)" style={s.input} inputMode="decimal" />
              <button type="submit" style={s.button}>Adicionar</button>
            </form>
          </section>
        )}

        {/* Fechar */}
        {aberta && (
          <form action={fecharOrdem}>
            <input type="hidden" name="os_id" value={id} />
            <button type="submit" style={s.fechar} disabled={(itens?.length ?? 0) === 0}>
              Fechar ordem (marcar como pronto)
            </button>
          </form>
        )}

        {/* Pronto: pode marcar como entregue */}
        {ordem.status === 'pronto' && (
          <form action={entregarOrdem} style={{ marginBottom: 10 }}>
            <input type="hidden" name="os_id" value={id} />
            <button type="submit" style={s.entregar}>Marcar como entregue</button>
          </form>
        )}

        {ordem.status === 'entregue' && (
          <p style={s.concluida}>Carro entregue. Serviço concluído. ✓</p>
        )}
        {ordem.status === 'cancelada' && (
          <p style={s.cancelada}>Ordem cancelada.</p>
        )}

        {/* Cancelar: enquanto não estiver entregue/cancelada */}
        {ordem.status !== 'entregue' && ordem.status !== 'cancelada' && (
          <form action={cancelarOrdem} style={s.cancelarLinha}>
            <input type="hidden" name="os_id" value={id} />
            <ConfirmSubmit
              label="Cancelar ordem"
              confirmLabel="Sim, cancelar"
              pergunta="Cancelar esta ordem?"
              style={s.cancelarBtn}
              confirmStyle={s.cancelarConfirma}
            />
          </form>
        )}
      </div>
    </main>
  )
}

function labelStatus(st: string) {
  return ({ aberta: 'Aberta', em_andamento: 'Em andamento', pronto: 'Pronto', entregue: 'Entregue', cancelada: 'Cancelada' } as Record<string, string>)[st] ?? st
}

const s: Record<string, React.CSSProperties> = {
  wrap: { minHeight: '100dvh', background: '#0f1115', padding: 24, color: '#e6e8ec' },
  shell: { maxWidth: 560, margin: '0 auto' },
  voltar: { display: 'inline-block', marginBottom: 16, fontSize: 13, color: '#7aa7ff', textDecoration: 'none' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  title: { fontSize: 22, fontWeight: 600, margin: 0 },
  sub: { fontSize: 13, color: '#9aa1ad', margin: '4px 0 0' },
  badge: { fontSize: 11, padding: '3px 10px', borderRadius: 6, border: '1px solid', whiteSpace: 'nowrap' },
  badgeAberta: { background: '#1c2333', color: '#cfe0ff', borderColor: '#2c4a7a' },
  badgeOk: { background: '#13211a', color: '#86e0ab', borderColor: '#245c3e' },
  bloco: { background: '#171a21', border: '1px solid #262b36', borderRadius: 12, padding: '16px 18px', marginBottom: 14 },
  blocoTitulo: { fontSize: 13, fontWeight: 600, color: '#c2c7d0', margin: '0 0 14px' },
  itens: { listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 4 },
  item: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #1e232c' },
  itemNome: { fontSize: 15, fontWeight: 500 },
  tagAdd: { fontSize: 10, color: '#7aa7ff', background: '#16233d', padding: '1px 6px', borderRadius: 4, marginLeft: 8, verticalAlign: 'middle' },
  itemSub: { fontSize: 12, color: '#9aa1ad', margin: '3px 0 0' },
  itemDir: { display: 'flex', alignItems: 'center', gap: 10 },
  itemPreco: { fontSize: 15, fontWeight: 600 },
  remover: { width: 26, height: 26, borderRadius: 6, border: '1px solid #2d333f', background: 'transparent', color: '#9aa1ad', fontSize: 16, lineHeight: 1, cursor: 'pointer' },
  removerConfirma: { height: 30, padding: '0 12px', borderRadius: 6, border: '1px solid #5c2326', background: '#2a1416', color: '#f4a7ab', fontSize: 12, fontWeight: 600, cursor: 'pointer' },
  totalLinha: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, paddingTop: 14, borderTop: '1px solid #2d333f' },
  totalRotulo: { fontSize: 14, color: '#c2c7d0' },
  totalValor: { fontSize: 24, fontWeight: 700 },
  form: { display: 'flex', flexDirection: 'column', gap: 10 },
  input: { height: 42, borderRadius: 8, border: '1px solid #2d333f', background: '#0f1115', color: '#e6e8ec', padding: '0 12px', fontSize: 14 },
  button: { height: 42, borderRadius: 8, border: 'none', background: '#3b82f6', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  fechar: { width: '100%', height: 46, borderRadius: 10, border: '1px solid #245c3e', background: '#13211a', color: '#86e0ab', fontSize: 15, fontWeight: 600, cursor: 'pointer' },
  entregar: { width: '100%', height: 46, borderRadius: 10, border: 'none', background: '#3b82f6', color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer' },
  cancelarLinha: { display: 'flex', justifyContent: 'center', marginTop: 14 },
  cancelarBtn: { height: 38, padding: '0 16px', borderRadius: 9, border: '1px solid #2d333f', background: 'transparent', color: '#9aa1ad', fontSize: 13, cursor: 'pointer' },
  cancelarConfirma: { height: 38, padding: '0 16px', borderRadius: 9, border: '1px solid #5c2326', background: '#2a1416', color: '#f4a7ab', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  concluida: { fontSize: 14, color: '#86e0ab', textAlign: 'center', padding: '12px 0' },
  cancelada: { fontSize: 14, color: '#f4a7ab', textAlign: 'center', padding: '12px 0' },
  vazio: { fontSize: 14, color: '#6b7280', margin: 0 },
}
