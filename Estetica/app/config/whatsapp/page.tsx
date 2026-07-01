import { createClient } from '@/utils/supabase/server'
import { salvarConfig, testarEnvio } from '@/app/config/whatsapp/actions'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function WhatsAppConfigPage({
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
          <h1 style={s.title}>WhatsApp</h1>
          <p style={s.vazio}>Você não tem permissão para configurar o WhatsApp.</p>
        </div>
      </main>
    )
  }

  const { data: cfg } = await supabase
    .from('whatsapp_config')
    .select('phone_number_id, access_token, template_pronto, template_lembrete, idioma, ativo')
    .maybeSingle()

  const { data: logs } = await supabase
    .from('notificacoes')
    .select('tipo, destino, status, detalhe, criado_em')
    .order('criado_em', { ascending: false })
    .limit(15)

  const tokenDefinido = !!cfg?.access_token

  return (
    <main style={s.wrap}>
      <div style={s.shell}>
        <Link href="/dashboard" style={s.voltar}>← Painel</Link>
        <h1 style={s.title}>WhatsApp</h1>

        {ok === '1' && <p style={s.ok}>Configuração salva.</p>}
        {ok === 'teste' && <p style={s.ok}>Mensagem de teste enviada.</p>}
        {erro && <p style={s.erro}>{erro}</p>}

        <section style={s.bloco}>
          <p style={s.blocoTitulo}>Credenciais da Cloud API</p>
          <form action={salvarConfig} style={s.form}>
            <label style={s.label}>
              Phone Number ID
              <input name="phone_number_id" defaultValue={cfg?.phone_number_id ?? ''} style={s.input} />
            </label>
            <label style={s.label}>
              Access Token {tokenDefinido && <span style={s.hint}>(já salvo — preencha só para alterar)</span>}
              <input name="access_token" type="password" placeholder={tokenDefinido ? '••••••••' : ''} style={s.input} />
            </label>
            <div style={s.linha2}>
              <label style={{ ...s.label, flex: 1 }}>
                Template "carro pronto"
                <input name="template_pronto" defaultValue={cfg?.template_pronto ?? 'carro_pronto'} style={s.input} />
              </label>
              <label style={{ ...s.label, flex: 1 }}>
                Template "lembrete"
                <input name="template_lembrete" defaultValue={cfg?.template_lembrete ?? 'lembrete_agendamento'} style={s.input} />
              </label>
            </div>
            <label style={s.check}>
              <input type="checkbox" name="ativo" defaultChecked={cfg?.ativo ?? false} />
              Ativar envios automáticos
            </label>
            <button type="submit" style={s.button}>Salvar</button>
          </form>
        </section>

        <section style={s.bloco}>
          <p style={s.blocoTitulo}>Enviar teste</p>
          <form action={testarEnvio} style={s.formLinha}>
            <input name="telefone" placeholder="Telefone com DDD (ex: 16999990001)" style={s.input} />
            <button type="submit" style={s.button}>Enviar teste</button>
          </form>
        </section>

        <section style={s.blocoInfo}>
          <p style={s.blocoTitulo}>Templates para submeter à Meta</p>
          <p style={s.infoTexto}>
            Crie estes dois templates no WhatsApp Manager (categoria <strong>Utility</strong>),
            com exatamente estas variáveis, e use os nomes acima depois de aprovados:
          </p>
          <div style={s.template}>
            <code style={s.tnome}>carro_pronto</code>
            <p style={s.tcorpo}>Olá {'{{1}}'}, o seu {'{{2}}'} está pronto para retirada! 🚗 Qualquer dúvida, é só responder.</p>
          </div>
          <div style={s.template}>
            <code style={s.tnome}>lembrete_agendamento</code>
            <p style={s.tcorpo}>Olá {'{{1}}'}, passando para lembrar do seu agendamento em {'{{2}}'}. Podemos confirmar?</p>
          </div>
        </section>

        <section style={s.bloco}>
          <p style={s.blocoTitulo}>Últimos envios</p>
          {(logs?.length ?? 0) === 0 ? (
            <p style={s.vazio}>Nenhum envio ainda.</p>
          ) : (
            <ul style={s.logs}>
              {(logs as any[]).map((l, i) => (
                <li key={i} style={s.log}>
                  <span style={{ ...s.logStatus, color: l.status === 'enviado' ? '#86e0ab' : '#f4a7ab' }}>
                    {l.status === 'enviado' ? '✓' : '✕'}
                  </span>
                  <span style={s.logTipo}>{l.tipo}</span>
                  <span style={s.logDest}>{l.destino}</span>
                  <span style={s.logDet}>{l.detalhe}</span>
                </li>
              ))}
            </ul>
          )}
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
  bloco: { background: '#171a21', border: '1px solid #262b36', borderRadius: 12, padding: '16px 18px', marginBottom: 14 },
  blocoInfo: { background: '#13182a', border: '1px solid #24314f', borderRadius: 12, padding: '16px 18px', marginBottom: 14 },
  blocoTitulo: { fontSize: 13, fontWeight: 600, color: '#c2c7d0', margin: '0 0 14px' },
  form: { display: 'flex', flexDirection: 'column', gap: 12 },
  formLinha: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  linha2: { display: 'flex', gap: 10, flexWrap: 'wrap' },
  label: { display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: '#c2c7d0' },
  hint: { fontSize: 11, color: '#9aa1ad' },
  input: { height: 40, borderRadius: 8, border: '1px solid #2d333f', background: '#0f1115', color: '#e6e8ec', padding: '0 12px', fontSize: 14, flex: 1, minWidth: 120 },
  check: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#c2c7d0' },
  button: { height: 40, borderRadius: 8, border: 'none', background: '#3b82f6', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', padding: '0 18px', alignSelf: 'flex-start' },
  infoTexto: { fontSize: 13, color: '#9aa1ad', margin: '0 0 14px', lineHeight: 1.5 },
  template: { background: '#0f1115', border: '1px solid #262b36', borderRadius: 8, padding: '10px 12px', marginBottom: 8 },
  tnome: { fontSize: 12, color: '#7aa7ff' },
  tcorpo: { fontSize: 13, color: '#c2c7d0', margin: '6px 0 0' },
  logs: { listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 },
  log: { display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, padding: '6px 0', borderBottom: '1px solid #1e232c' },
  logStatus: { fontWeight: 700 },
  logTipo: { color: '#cfe0ff', minWidth: 64 },
  logDest: { color: '#9aa1ad', minWidth: 110 },
  logDet: { color: '#6b7280', fontSize: 12, flex: 1, wordBreak: 'break-all' },
  ok: { background: '#13211a', border: '1px solid #245c3e', color: '#86e0ab', fontSize: 13, padding: '8px 12px', borderRadius: 8, margin: '0 0 14px' },
  erro: { background: '#2a1416', border: '1px solid #5c2326', color: '#f4a7ab', fontSize: 13, padding: '8px 12px', borderRadius: 8, margin: '0 0 14px' },
  vazio: { fontSize: 14, color: '#6b7280', margin: 0 },
}
