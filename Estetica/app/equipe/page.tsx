import { createClient } from '@/utils/supabase/server'
import { criarConvite } from '@/app/auth/invites'
import { atualizarFuncionario, setFuncionarioAtivo } from '@/app/equipe/actions'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import Link from 'next/link'

export default async function EquipePage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; ok?: string }>
}) {
  const { erro, ok } = await searchParams
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
          <h1 style={s.title}>Equipe</h1>
          <p style={s.vazio}>Você não tem permissão para gerenciar a equipe.</p>
        </div>
      </main>
    )
  }

  const { data: equipe } = await supabase
    .from('funcionarios')
    .select('id, nome, cargo, comissao_pct, ativo')
    .order('nome')

  const { data: convites } = await supabase
    .from('convites')
    .select('email, cargo, token, status')
    .eq('status', 'pendente')
    .order('criado_em', { ascending: false })

  const h = await headers()
  const host = h.get('host') ?? 'localhost:3000'
  const proto = h.get('x-forwarded-proto') ?? 'http'
  const base = `${proto}://${host}`

  return (
    <main style={s.wrap}>
      <div style={s.shell}>
        <Link href="/dashboard" style={s.voltar}>← Painel</Link>
        <h1 style={s.title}>Equipe</h1>

        {ok === 'convite-criado' && <p style={s.ok}>Convite criado.</p>}
        {erro && <p style={s.erro}>{erro}</p>}

        <section style={s.bloco}>
          <p style={s.blocoTitulo}>Funcionários</p>
          {(equipe?.length ?? 0) === 0 ? (
            <p style={s.vazio}>Nenhum funcionário.</p>
          ) : (
            <ul style={s.lista}>
              {(equipe as any[]).map((f) => (
                <li key={f.id} style={{ ...s.row, opacity: f.ativo ? 1 : 0.5 }}>
                  <span style={s.rowNome}>{f.nome}</span>
                  <form action={atualizarFuncionario} style={s.rowForm}>
                    <input type="hidden" name="id" value={f.id} />
                    <select name="cargo" defaultValue={f.cargo} style={s.select}>
                      <option value="dono">Dono</option>
                      <option value="gerente">Gerente</option>
                      <option value="operador">Operador</option>
                    </select>
                    <input name="comissao" defaultValue={Number(f.comissao_pct)} style={s.inputMini} inputMode="decimal" />
                    <span style={s.pct}>%</span>
                    <button type="submit" style={s.salvar}>Salvar</button>
                  </form>
                  <form action={setFuncionarioAtivo}>
                    <input type="hidden" name="id" value={f.id} />
                    <input type="hidden" name="ativo" value={(!f.ativo).toString()} />
                    <button type="submit" style={s.toggle}>{f.ativo ? 'Desativar' : 'Ativar'}</button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section style={s.bloco}>
          <p style={s.blocoTitulo}>Convidar funcionário</p>
          <form action={criarConvite} style={s.form}>
            <input name="email" type="email" placeholder="email@exemplo.com" required style={s.input} />
            <select name="cargo" defaultValue="operador" style={s.input}>
              <option value="operador">Operador</option>
              <option value="gerente">Gerente</option>
            </select>
            <button type="submit" style={s.button}>Enviar convite</button>
          </form>
        </section>

        {(convites?.length ?? 0) > 0 && (
          <section style={s.bloco}>
            <p style={s.blocoTitulo}>Convites pendentes</p>
            <ul style={s.lista}>
              {(convites as any[]).map((c, i) => (
                <li key={i} style={s.itemCol}>
                  <span>{c.email} · <span style={s.tag}>{c.cargo}</span></span>
                  <code style={s.link}>{base}/aceitar-convite?token={c.token}</code>
                </li>
              ))}
            </ul>
          </section>
        )}
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
  blocoTitulo: { fontSize: 13, fontWeight: 600, color: '#c2c7d0', margin: '0 0 14px' },
  lista: { listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 },
  row: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '8px 0', borderBottom: '1px solid #1e232c' },
  rowNome: { fontSize: 14, fontWeight: 500, flex: 1, minWidth: 90 },
  rowForm: { display: 'flex', alignItems: 'center', gap: 6 },
  select: { height: 34, borderRadius: 6, border: '1px solid #2d333f', background: '#0f1115', color: '#e6e8ec', padding: '0 8px', fontSize: 13 },
  inputMini: { width: 54, height: 34, borderRadius: 6, border: '1px solid #2d333f', background: '#0f1115', color: '#e6e8ec', padding: '0 8px', fontSize: 13 },
  pct: { fontSize: 13, color: '#9aa1ad' },
  salvar: { height: 34, borderRadius: 6, border: '1px solid #2c4a7a', background: '#16233d', color: '#cfe0ff', fontSize: 12, cursor: 'pointer', padding: '0 10px' },
  toggle: { height: 34, borderRadius: 6, border: '1px solid #2d333f', background: 'transparent', color: '#9aa1ad', fontSize: 12, cursor: 'pointer', padding: '0 10px' },
  form: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  input: { height: 40, borderRadius: 8, border: '1px solid #2d333f', background: '#0f1115', color: '#e6e8ec', padding: '0 12px', fontSize: 14, flex: 1, minWidth: 140 },
  button: { height: 40, borderRadius: 8, border: 'none', background: '#3b82f6', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', padding: '0 18px' },
  itemCol: { display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, padding: '8px 12px', background: '#0f1115', border: '1px solid #262b36', borderRadius: 8 },
  tag: { fontSize: 12, color: '#7aa7ff', background: '#16233d', padding: '2px 8px', borderRadius: 6 },
  ok: { background: '#13211a', border: '1px solid #245c3e', color: '#86e0ab', fontSize: 13, padding: '8px 12px', borderRadius: 8, margin: '0 0 12px' },
  erro: { background: '#2a1416', border: '1px solid #5c2326', color: '#f4a7ab', fontSize: 13, padding: '8px 12px', borderRadius: 8, margin: '0 0 12px' },
  link: { fontSize: 12, color: '#9aa1ad', wordBreak: 'break-all' },
  vazio: { fontSize: 14, color: '#6b7280', margin: 0 },
}
