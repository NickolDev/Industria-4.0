import { createClient } from '@/utils/supabase/server'
import { salvarConfigAgendamento } from '@/app/config/agendamento/actions'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import Link from 'next/link'

export default async function ConfigAgendamentoPage({
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
          <h1 style={s.title}>Agendamento online</h1>
          <p style={s.vazio}>Você não tem permissão para configurar isto.</p>
        </div>
      </main>
    )
  }

  const { data: t } = await supabase
    .from('tenants')
    .select('slug, agendamento_online, hora_abertura, hora_fechamento, intervalo_min, confirma_auto')
    .single()

  const h = await headers()
  const host = h.get('host') ?? 'localhost:3000'
  const proto = h.get('x-forwarded-proto') ?? 'http'
  const linkPublico = t?.slug ? `${proto}://${host}/agendar/${t.slug}` : null

  return (
    <main style={s.wrap}>
      <div style={s.shell}>
        <Link href="/dashboard" style={s.voltar}>← Painel</Link>
        <h1 style={s.title}>Agendamento online</h1>
        <p style={s.sub}>A página pública onde seus clientes marcam sozinhos.</p>

        {ok && <p style={s.ok}>Configuração salva.</p>}
        {erro && <p style={s.erro}>{erro}</p>}

        {t?.agendamento_online && linkPublico && (
          <div style={s.linkBox}>
            <p style={s.linkLabel}>Seu link de agendamento (compartilhe com os clientes):</p>
            <code style={s.link}>{linkPublico}</code>
          </div>
        )}

        <section style={s.bloco}>
          <form action={salvarConfigAgendamento} style={s.form}>
            <label style={s.label}>
              Link (slug)
              <div style={s.slugRow}>
                <span style={s.slugPrefix}>/agendar/</span>
                <input name="slug" defaultValue={t?.slug ?? ''} placeholder="brilho-total" style={{ ...s.input, flex: 1 }} />
              </div>
              <span style={s.hint}>Só letras, números e hífens. Acentos e espaços viram hífen.</span>
            </label>

            <div style={s.linha}>
              <label style={{ ...s.label, flex: 1 }}>
                Abre às
                <input name="hora_abertura" type="number" min={0} max={23} defaultValue={t?.hora_abertura ?? 8} style={s.input} />
              </label>
              <label style={{ ...s.label, flex: 1 }}>
                Fecha às
                <input name="hora_fechamento" type="number" min={1} max={24} defaultValue={t?.hora_fechamento ?? 18} style={s.input} />
              </label>
              <label style={{ ...s.label, flex: 1 }}>
                Intervalo (min)
                <input name="intervalo_min" type="number" min={5} step={5} defaultValue={t?.intervalo_min ?? 30} style={s.input} />
              </label>
            </div>

            <label style={s.check}>
              <input type="checkbox" name="confirma_auto" defaultChecked={t?.confirma_auto ?? false} />
              <span>
                Confirmar agendamentos automaticamente
                <span style={s.checkHint}> — desligado, eles entram como "pendentes" para você confirmar na agenda.</span>
              </span>
            </label>

            <label style={s.check}>
              <input type="checkbox" name="agendamento_online" defaultChecked={t?.agendamento_online ?? false} />
              <span>
                Ativar a página pública
                <span style={s.checkHint}> — enquanto desligado, o link não funciona.</span>
              </span>
            </label>

            <button type="submit" style={s.button}>Salvar</button>
          </form>
        </section>

        <section style={s.blocoInfo}>
          <p style={s.infoTitulo}>Como funciona</p>
          <p style={s.infoTexto}>
            A duração de cada agendamento vem da soma das durações dos serviços que
            o cliente escolher (definidas no catálogo, em minutos). O sistema só
            oferece horários onde o serviço inteiro cabe antes do fechamento e há
            box livre. Cadastre seus boxes na agenda — eles definem quantos carros
            cabem ao mesmo tempo.
          </p>
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
  linkBox: { background: '#13211a', border: '1px solid #245c3e', borderRadius: 10, padding: '12px 14px', marginBottom: 14 },
  linkLabel: { fontSize: 12, color: '#86e0ab', margin: '0 0 6px' },
  link: { fontSize: 14, color: '#cfe0ff', wordBreak: 'break-all' },
  bloco: { background: '#171a21', border: '1px solid #262b36', borderRadius: 12, padding: '18px 20px', marginBottom: 14 },
  blocoInfo: { background: '#13182a', border: '1px solid #24314f', borderRadius: 12, padding: '16px 18px' },
  form: { display: 'flex', flexDirection: 'column', gap: 16 },
  label: { display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: '#c2c7d0' },
  slugRow: { display: 'flex', alignItems: 'center', gap: 0, border: '1px solid #2d333f', borderRadius: 8, overflow: 'hidden', background: '#0f1115' },
  slugPrefix: { fontSize: 13, color: '#6b7280', padding: '0 4px 0 12px', whiteSpace: 'nowrap' },
  input: { height: 40, borderRadius: 8, border: '1px solid #2d333f', background: '#0f1115', color: '#e6e8ec', padding: '0 12px', fontSize: 14 },
  linha: { display: 'flex', gap: 10, flexWrap: 'wrap' },
  hint: { fontSize: 11, color: '#6b7280' },
  check: { display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 14, color: '#c2c7d0', lineHeight: 1.4 },
  checkHint: { color: '#9aa1ad', fontSize: 13 },
  button: { height: 42, borderRadius: 8, border: 'none', background: '#3b82f6', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', alignSelf: 'flex-start', padding: '0 20px' },
  infoTitulo: { fontSize: 13, fontWeight: 600, color: '#c2c7d0', margin: '0 0 8px' },
  infoTexto: { fontSize: 13, color: '#9aa1ad', margin: 0, lineHeight: 1.5 },
  ok: { background: '#13211a', border: '1px solid #245c3e', color: '#86e0ab', fontSize: 13, padding: '8px 12px', borderRadius: 8, margin: '0 0 14px' },
  erro: { background: '#2a1416', border: '1px solid #5c2326', color: '#f4a7ab', fontSize: 13, padding: '8px 12px', borderRadius: 8, margin: '0 0 14px' },
  vazio: { fontSize: 14, color: '#6b7280' },
}
