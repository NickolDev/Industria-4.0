import { createClient } from '@/utils/supabase/server'
import { criarAgendamento, setStatusAgendamento, criarBox, abrirOrdemDoAgendamento } from '@/app/agenda/actions'
import { redirect } from 'next/navigation'
import Link from 'next/link'

const TZ = 'America/Sao_Paulo'
const OFFSET = '-03:00'

const horaSP = (iso: string) =>
  new Date(iso).toLocaleTimeString('pt-BR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' })

const hojeSP = () => new Date().toLocaleDateString('en-CA', { timeZone: TZ })

function addDias(dia: string, n: number) {
  const d = new Date(`${dia}T12:00:00${OFFSET}`)
  d.setDate(d.getDate() + n)
  return d.toLocaleDateString('en-CA', { timeZone: TZ })
}

const statusLabel: Record<string, string> = {
  agendado: 'Agendado', confirmado: 'Confirmado', cancelado: 'Cancelado', concluido: 'Concluído',
}

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ dia?: string; erro?: string }>
}) {
  const sp = await searchParams
  const dia = sp.dia || hojeSP()
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

  const inicioDia = `${dia}T00:00:00${OFFSET}`
  const fimDia = `${addDias(dia, 1)}T00:00:00${OFFSET}`

  const [{ data: ags }, { data: boxes }, { data: veiculos }, { data: funcionarios }] = await Promise.all([
    supabase
      .from('agendamentos')
      .select('id, inicio, fim, status, cliente_id, veiculo_id, cliente:clientes(nome), veiculo:veiculos(modelo, placa), box:boxes(nome), funcionario:funcionarios(nome)')
      .gte('inicio', inicioDia)
      .lt('inicio', fimDia)
      .order('inicio'),
    supabase.from('boxes').select('id, nome').eq('ativo', true).order('nome'),
    supabase.from('veiculos').select('id, modelo, placa, cliente:clientes(nome)').order('modelo'),
    supabase.from('funcionarios').select('id, nome').eq('ativo', true).order('nome'),
  ])

  const tituloDia = new Date(`${dia}T12:00:00${OFFSET}`).toLocaleDateString('pt-BR', {
    timeZone: TZ, weekday: 'long', day: '2-digit', month: 'long',
  })

  return (
    <main style={s.wrap}>
      <div style={s.shell}>
        <Link href="/dashboard" style={s.voltar}>← Painel</Link>
        <h1 style={s.title}>Agenda</h1>

        {sp.erro && <p style={s.erro}>{sp.erro}</p>}

        <nav style={s.nav}>
          <Link href={`/agenda?dia=${addDias(dia, -1)}`} style={s.navBtn}>‹</Link>
          <span style={s.navData}>{tituloDia}</span>
          <Link href={`/agenda?dia=${addDias(dia, 1)}`} style={s.navBtn}>›</Link>
          <Link href={`/agenda?dia=${hojeSP()}`} style={{ ...s.navBtn, marginLeft: 'auto', width: 'auto', padding: '0 12px' }}>Hoje</Link>
        </nav>

        {/* Lista do dia */}
        <section style={s.bloco}>
          {(ags?.length ?? 0) === 0 ? (
            <p style={s.vazio}>Nenhum agendamento neste dia.</p>
          ) : (
            <ul style={s.lista}>
              {(ags as any[]).map((a) => {
                const ativo = a.status === 'agendado' || a.status === 'confirmado'
                return (
                  <li key={a.id} style={{ ...s.item, opacity: a.status === 'cancelado' ? 0.5 : 1 }}>
                    <div style={s.hora}>
                      <span style={s.horaIni}>{horaSP(a.inicio)}</span>
                      <span style={s.horaFim}>{horaSP(a.fim)}</span>
                    </div>
                    <div style={s.info}>
                      <p style={s.cliente}>{a.cliente?.nome ?? 'Cliente'}</p>
                      <p style={s.sub}>
                        {[a.veiculo?.modelo, a.veiculo?.placa].filter(Boolean).join(' · ') || '—'}
                        {a.box?.nome ? ` · ${a.box.nome}` : ''}
                        {a.funcionario?.nome ? ` · ${a.funcionario.nome}` : ''}
                      </p>
                    </div>
                    <div style={s.acoes}>
                      <span style={{ ...s.badge, ...badge(a.status) }}>{statusLabel[a.status] ?? a.status}</span>
                      {ativo && (
                        <div style={s.botoes}>
                          {a.status === 'agendado' && (
                            <form action={setStatusAgendamento}>
                              <input type="hidden" name="id" value={a.id} />
                              <input type="hidden" name="dia" value={dia} />
                              <input type="hidden" name="status" value="confirmado" />
                              <button type="submit" style={s.mini}>Confirmar</button>
                            </form>
                          )}
                          <form action={abrirOrdemDoAgendamento}>
                            <input type="hidden" name="id" value={a.id} />
                            <input type="hidden" name="cliente_id" value={a.cliente_id} />
                            <input type="hidden" name="veiculo_id" value={a.veiculo_id} />
                            <input type="hidden" name="dia" value={dia} />
                            <button type="submit" style={{ ...s.mini, ...s.miniAzul }}>Abrir ordem</button>
                          </form>
                          <form action={setStatusAgendamento}>
                            <input type="hidden" name="id" value={a.id} />
                            <input type="hidden" name="dia" value={dia} />
                            <input type="hidden" name="status" value="cancelado" />
                            <button type="submit" style={s.mini}>Cancelar</button>
                          </form>
                        </div>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        {/* Novo agendamento */}
        <section style={s.bloco}>
          <p style={s.blocoTitulo}>Novo agendamento</p>
          {(veiculos?.length ?? 0) === 0 ? (
            <p style={s.vazio}>
              Cadastre um cliente com veículo primeiro em{' '}
              <Link href="/clientes" style={s.link}>Clientes</Link>.
            </p>
          ) : (
            <form action={criarAgendamento} style={s.form}>
              <select name="veiculo_id" required defaultValue="" style={{ ...s.input, flexBasis: '100%' }}>
                <option value="" disabled>Cliente e veículo…</option>
                {(veiculos as any[]).map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.cliente?.nome} — {[v.modelo, v.placa].filter(Boolean).join(' ')}
                  </option>
                ))}
              </select>
              <input type="date" name="data" defaultValue={dia} required style={s.input} />
              <input type="time" name="hora" required style={s.input} />
              <input name="duracao" type="number" defaultValue={60} min={5} step={5} style={s.input} title="Duração (min)" />
              <select name="box_id" defaultValue="" style={s.input}>
                <option value="">Box (opcional)</option>
                {(boxes ?? []).map((b: any) => <option key={b.id} value={b.id}>{b.nome}</option>)}
              </select>
              <select name="funcionario_id" defaultValue="" style={s.input}>
                <option value="">Responsável (opcional)</option>
                {(funcionarios ?? []).map((f: any) => <option key={f.id} value={f.id}>{f.nome}</option>)}
              </select>
              <button type="submit" style={s.button}>Agendar</button>
            </form>
          )}
        </section>

        {/* Boxes (admin) */}
        {ehAdmin && (
          <section style={s.bloco}>
            <p style={s.blocoTitulo}>Boxes</p>
            <p style={s.boxesLista}>
              {(boxes?.length ?? 0) === 0 ? 'Nenhum box ainda.' : (boxes as any[]).map((b) => b.nome).join(' · ')}
            </p>
            <form action={criarBox} style={s.form}>
              <input type="hidden" name="dia" value={dia} />
              <input name="nome" placeholder="Nome do box (ex: Box 2)" style={s.input} />
              <button type="submit" style={s.button}>Adicionar box</button>
            </form>
          </section>
        )}
      </div>
    </main>
  )
}

function badge(status: string): React.CSSProperties {
  if (status === 'confirmado') return { background: '#13211a', color: '#86e0ab', borderColor: '#245c3e' }
  if (status === 'cancelado') return { background: '#2a1416', color: '#f4a7ab', borderColor: '#5c2326' }
  if (status === 'concluido') return { background: '#1c2333', color: '#cfe0ff', borderColor: '#2c4a7a' }
  return { background: '#2a2410', color: '#e6cf86', borderColor: '#5c4d23' }
}

const s: Record<string, React.CSSProperties> = {
  wrap: { minHeight: '100dvh', background: '#0f1115', padding: 24, color: '#e6e8ec' },
  shell: { maxWidth: 640, margin: '0 auto' },
  voltar: { display: 'inline-block', marginBottom: 12, fontSize: 13, color: '#7aa7ff', textDecoration: 'none' },
  title: { fontSize: 24, fontWeight: 600, margin: '0 0 16px' },
  nav: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 },
  navBtn: { width: 36, height: 36, display: 'grid', placeItems: 'center', borderRadius: 8, border: '1px solid #262b36', color: '#c2c7d0', textDecoration: 'none', fontSize: 16 },
  navData: { fontSize: 15, fontWeight: 500, textTransform: 'capitalize' },
  bloco: { background: '#171a21', border: '1px solid #262b36', borderRadius: 12, padding: '16px 18px', marginBottom: 14 },
  blocoTitulo: { fontSize: 13, fontWeight: 600, color: '#c2c7d0', margin: '0 0 14px' },
  lista: { listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 4 },
  item: { display: 'flex', gap: 14, alignItems: 'flex-start', padding: '12px 0', borderBottom: '1px solid #1e232c' },
  hora: { display: 'flex', flexDirection: 'column', minWidth: 48 },
  horaIni: { fontSize: 15, fontWeight: 600 },
  horaFim: { fontSize: 12, color: '#9aa1ad' },
  info: { flex: 1 },
  cliente: { fontSize: 15, fontWeight: 500, margin: 0 },
  sub: { fontSize: 12, color: '#9aa1ad', margin: '3px 0 0' },
  acoes: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 },
  badge: { fontSize: 11, padding: '2px 8px', borderRadius: 6, border: '1px solid', whiteSpace: 'nowrap' },
  botoes: { display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' },
  mini: { height: 30, borderRadius: 6, border: '1px solid #2d333f', background: 'transparent', color: '#c2c7d0', fontSize: 12, cursor: 'pointer', padding: '0 10px' },
  miniAzul: { border: '1px solid #2c4a7a', background: '#16233d', color: '#cfe0ff' },
  form: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  input: { height: 40, borderRadius: 8, border: '1px solid #2d333f', background: '#0f1115', color: '#e6e8ec', padding: '0 12px', fontSize: 14, flex: 1, minWidth: 110 },
  button: { height: 40, borderRadius: 8, border: 'none', background: '#3b82f6', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', padding: '0 18px' },
  boxesLista: { fontSize: 13, color: '#9aa1ad', margin: '0 0 12px' },
  link: { color: '#7aa7ff', textDecoration: 'none' },
  erro: { background: '#2a1416', border: '1px solid #5c2326', color: '#f4a7ab', fontSize: 13, padding: '8px 12px', borderRadius: 8, margin: '0 0 14px' },
  vazio: { fontSize: 14, color: '#6b7280', margin: 0 },
}
