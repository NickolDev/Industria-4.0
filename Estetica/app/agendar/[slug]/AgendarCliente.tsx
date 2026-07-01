'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/utils/supabase/client'

type Servico = { id: string; nome: string; tipo: string; preco: number; duracao_min: number }
type Dados = {
  nome: string
  slug: string
  hora_abertura: number
  hora_fechamento: number
  intervalo_min: number
  servicos: Servico[]
}

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
function fmtDur(min: number) {
  const h = Math.floor(min / 60)
  const m = min % 60
  return [h ? `${h}h` : '', m ? `${m}min` : ''].filter(Boolean).join(' ') || '—'
}

export default function AgendarCliente({ slug, dados }: { slug: string; dados: Dados }) {
  const supabase = createClient()

  const principais = dados.servicos.filter((s) => s.tipo === 'principal')
  const adicionais = dados.servicos.filter((s) => s.tipo === 'adicional')

  const hojeSP = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })

  const [principal, setPrincipal] = useState('')
  const [extras, setExtras] = useState<string[]>([])
  const [dia, setDia] = useState(hojeSP)
  const [slots, setSlots] = useState<string[]>([])
  const [carregando, setCarregando] = useState(false)
  const [hora, setHora] = useState('')
  const [nome, setNome] = useState('')
  const [telefone, setTelefone] = useState('')
  const [modelo, setModelo] = useState('')
  const [placa, setPlaca] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState<{ mensagem: string } | null>(null)

  const idsSelecionados = useMemo(
    () => (principal ? [principal, ...extras] : []),
    [principal, extras]
  )
  const selecionados = dados.servicos.filter((s) => idsSelecionados.includes(s.id))
  const total = selecionados.reduce((a, s) => a + Number(s.preco), 0)
  const duracao = selecionados.reduce((a, s) => a + Number(s.duracao_min), 0)

  async function buscarSlots() {
    if (!principal) {
      setSlots([])
      return
    }
    setCarregando(true)
    const { data } = await supabase.rpc('horarios_livres', {
      p_slug: slug,
      p_dia: dia,
      p_servico_ids: idsSelecionados,
    })
    setSlots(((data ?? []) as { hora: string }[]).map((r) => r.hora))
    setCarregando(false)
  }

  // Sempre que o serviço, os adicionais ou o dia mudam, os horários mudam.
  useEffect(() => {
    setHora('')
    buscarSlots()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [principal, extras, dia])

  function toggleExtra(id: string) {
    setExtras((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  async function confirmar() {
    setErro('')
    if (!principal) return setErro('Escolha uma lavagem.')
    if (!hora) return setErro('Escolha um horário.')
    if (!nome.trim() || !telefone.trim()) return setErro('Preencha seu nome e telefone.')

    setEnviando(true)
    const { data, error } = await supabase.rpc('criar_agendamento_publico', {
      p_slug: slug,
      p_dia: dia,
      p_hora: hora,
      p_servico_ids: idsSelecionados,
      p_cliente_nome: nome,
      p_cliente_telefone: telefone,
      p_veiculo_modelo: modelo || null,
      p_veiculo_placa: placa || null,
    })
    setEnviando(false)

    if (error) return setErro('Não foi possível agendar agora. Tente de novo.')
    if (data?.ok) {
      setSucesso({ mensagem: data.mensagem })
    } else {
      setErro(data?.erro ?? 'Não foi possível agendar.')
      // Se o horário foi tomado nesse meio tempo, atualiza a lista.
      if (String(data?.erro ?? '').includes('preenchido')) {
        setHora('')
        buscarSlots()
      }
    }
  }

  // ---- Tela de sucesso ----
  if (sucesso) {
    return (
      <main style={s.wrap}>
        <div style={s.shell}>
          <div style={s.sucessoCard}>
            <div style={s.check}>✓</div>
            <h1 style={s.sucessoTitulo}>{sucesso.mensagem}</h1>
            <div style={s.resumo}>
              <p style={s.resumoLinha}><span>Estética</span><strong>{dados.nome}</strong></p>
              <p style={s.resumoLinha}><span>Quando</span><strong>{dia.split('-').reverse().join('/')} às {hora}</strong></p>
              <p style={s.resumoLinha}><span>Serviços</span><strong>{selecionados.map((x) => x.nome).join(', ')}</strong></p>
              <p style={s.resumoLinha}><span>Total</span><strong>{brl(total)}</strong></p>
            </div>
            <p style={s.sucessoNota}>Anote o horário. Em caso de imprevisto, fale com a estética.</p>
          </div>
        </div>
      </main>
    )
  }

  // ---- Tela de agendamento ----
  return (
    <main style={s.wrap}>
      <div style={s.shell}>
        <header style={s.header}>
          <p style={s.eyebrow}>Agendamento</p>
          <h1 style={s.titulo}>{dados.nome}</h1>
          <p style={s.func}>
            Funcionamento: {dados.hora_abertura}h às {dados.hora_fechamento}h
          </p>
        </header>

        {/* 1. Lavagem */}
        <section style={s.bloco}>
          <p style={s.passo}>1. Escolha a lavagem</p>
          <div style={s.opcoes}>
            {principais.map((sv) => (
              <button
                key={sv.id}
                onClick={() => setPrincipal(sv.id)}
                style={{ ...s.opcao, ...(principal === sv.id ? s.opcaoAtiva : {}) }}
              >
                <span style={s.opcaoNome}>{sv.nome}</span>
                <span style={s.opcaoMeta}>{brl(Number(sv.preco))} · {fmtDur(sv.duracao_min)}</span>
              </button>
            ))}
            {principais.length === 0 && <p style={s.vazio}>Nenhuma lavagem cadastrada.</p>}
          </div>
        </section>

        {/* 2. Adicionais */}
        {adicionais.length > 0 && (
          <section style={s.bloco}>
            <p style={s.passo}>2. Adicionais (opcional)</p>
            <div style={s.opcoes}>
              {adicionais.map((sv) => (
                <button
                  key={sv.id}
                  onClick={() => toggleExtra(sv.id)}
                  style={{ ...s.opcao, ...(extras.includes(sv.id) ? s.opcaoAtiva : {}) }}
                >
                  <span style={s.opcaoNome}>
                    <span style={s.box}>{extras.includes(sv.id) ? '✓' : ''}</span>
                    {sv.nome}
                  </span>
                  <span style={s.opcaoMeta}>+{brl(Number(sv.preco))} · +{fmtDur(sv.duracao_min)}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Total */}
        {principal && (
          <div style={s.totalBar}>
            <span>Total: <strong>{brl(total)}</strong></span>
            <span style={s.totalDur}>Duração: {fmtDur(duracao)}</span>
          </div>
        )}

        {/* 3. Dia e horário */}
        {principal && (
          <section style={s.bloco}>
            <p style={s.passo}>3. Escolha o dia e o horário</p>
            <input
              type="date"
              value={dia}
              min={hojeSP}
              onChange={(e) => setDia(e.target.value)}
              style={s.data}
            />
            {carregando ? (
              <p style={s.vazio}>Buscando horários…</p>
            ) : slots.length === 0 ? (
              <p style={s.vazio}>Nenhum horário livre nesse dia para os serviços escolhidos.</p>
            ) : (
              <div style={s.slots}>
                {slots.map((h) => (
                  <button
                    key={h}
                    onClick={() => setHora(h)}
                    style={{ ...s.slot, ...(hora === h ? s.slotAtivo : {}) }}
                  >
                    {h}
                  </button>
                ))}
              </div>
            )}
          </section>
        )}

        {/* 4. Dados */}
        {principal && hora && (
          <section style={s.bloco}>
            <p style={s.passo}>4. Seus dados</p>
            <div style={s.campos}>
              <input placeholder="Seu nome" value={nome} onChange={(e) => setNome(e.target.value)} style={s.input} />
              <input placeholder="Telefone (com DDD)" value={telefone} onChange={(e) => setTelefone(e.target.value)} style={s.input} />
              <input placeholder="Modelo do carro (opcional)" value={modelo} onChange={(e) => setModelo(e.target.value)} style={s.input} />
              <input placeholder="Placa (opcional)" value={placa} onChange={(e) => setPlaca(e.target.value)} style={s.input} />
            </div>
          </section>
        )}

        {erro && <p style={s.erro}>{erro}</p>}

        {principal && hora && (
          <button onClick={confirmar} disabled={enviando} style={{ ...s.confirmar, ...(enviando ? s.confirmarOff : {}) }}>
            {enviando ? 'Agendando…' : `Confirmar agendamento · ${brl(total)}`}
          </button>
        )}
      </div>
    </main>
  )
}

const s: Record<string, React.CSSProperties> = {
  wrap: { minHeight: '100dvh', background: '#0f1115', color: '#e6e8ec', padding: '24px 16px' },
  shell: { maxWidth: 480, margin: '0 auto' },
  header: { marginBottom: 18 },
  eyebrow: { fontSize: 12, color: '#7aa7ff', textTransform: 'uppercase', letterSpacing: 1, margin: 0 },
  titulo: { fontSize: 26, fontWeight: 700, margin: '4px 0 4px' },
  func: { fontSize: 13, color: '#9aa1ad', margin: 0 },
  bloco: { background: '#171a21', border: '1px solid #262b36', borderRadius: 12, padding: '16px 16px', marginBottom: 12 },
  passo: { fontSize: 13, fontWeight: 600, color: '#c2c7d0', margin: '0 0 12px' },
  opcoes: { display: 'flex', flexDirection: 'column', gap: 8 },
  opcao: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, textAlign: 'left', width: '100%', background: '#0f1115', border: '1px solid #2d333f', borderRadius: 10, padding: '12px 14px', color: '#e6e8ec', cursor: 'pointer' },
  opcaoAtiva: { borderColor: '#3b82f6', background: '#15233f' },
  opcaoNome: { fontSize: 14, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8 },
  opcaoMeta: { fontSize: 13, color: '#9aa1ad', whiteSpace: 'nowrap' },
  box: { width: 18, height: 18, borderRadius: 4, border: '1px solid #3b82f6', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#7aa7ff' },
  totalBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#13211a', border: '1px solid #245c3e', borderRadius: 10, padding: '10px 14px', fontSize: 14, marginBottom: 12, color: '#cfe9d6' },
  totalDur: { fontSize: 13, color: '#86e0ab' },
  data: { height: 42, borderRadius: 8, border: '1px solid #2d333f', background: '#0f1115', color: '#e6e8ec', padding: '0 12px', fontSize: 14, width: '100%', marginBottom: 12, colorScheme: 'dark' },
  slots: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  slot: { minWidth: 64, padding: '9px 12px', borderRadius: 8, border: '1px solid #2d333f', background: '#0f1115', color: '#e6e8ec', fontSize: 14, cursor: 'pointer' },
  slotAtivo: { borderColor: '#3b82f6', background: '#15233f', color: '#fff', fontWeight: 600 },
  campos: { display: 'flex', flexDirection: 'column', gap: 8 },
  input: { height: 42, borderRadius: 8, border: '1px solid #2d333f', background: '#0f1115', color: '#e6e8ec', padding: '0 12px', fontSize: 14 },
  confirmar: { width: '100%', height: 50, borderRadius: 10, border: 'none', background: '#3b82f6', color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer', marginTop: 4 },
  confirmarOff: { background: '#2a3550', cursor: 'default' },
  erro: { background: '#2a1416', border: '1px solid #5c2326', color: '#f4a7ab', fontSize: 13, padding: '10px 12px', borderRadius: 8, margin: '0 0 12px' },
  vazio: { fontSize: 13, color: '#6b7280', margin: 0 },
  sucessoCard: { background: '#171a21', border: '1px solid #245c3e', borderRadius: 14, padding: 28, textAlign: 'center', marginTop: 40 },
  check: { width: 56, height: 56, borderRadius: '50%', background: '#15331f', color: '#86e0ab', fontSize: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', border: '1px solid #245c3e' },
  sucessoTitulo: { fontSize: 18, fontWeight: 600, margin: '0 0 18px' },
  resumo: { textAlign: 'left', borderTop: '1px solid #262b36', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 8 },
  resumoLinha: { display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 14, margin: 0, color: '#9aa1ad' },
  sucessoNota: { fontSize: 12, color: '#6b7280', margin: '18px 0 0' },
}
