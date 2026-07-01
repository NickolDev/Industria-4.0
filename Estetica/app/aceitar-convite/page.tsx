import { createClient } from '@/utils/supabase/server'
import { aceitarConvite } from '@/app/auth/invites'

export default async function AceitarConvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; erro?: string }>
}) {
  const { token, erro } = await searchParams
  const supabase = await createClient()

  let info: { email: string; estetica: string; cargo: string; valido: boolean } | null = null
  if (token) {
    const { data } = await supabase.rpc('convite_info', { p_token: token })
    info = Array.isArray(data) ? data[0] ?? null : null
  }

  if (!token || !info || !info.valido) {
    return (
      <main style={styles.wrap}>
        <div style={styles.card}>
          <h1 style={styles.title}>Convite inválido</h1>
          <p style={styles.subtitle}>
            Este convite não existe, expirou ou já foi utilizado. Peça um novo
            ao administrador da estética.
          </p>
        </div>
      </main>
    )
  }

  return (
    <main style={styles.wrap}>
      <div style={styles.card}>
        <p style={styles.eyebrow}>Convite para {info.estetica}</p>
        <h1 style={styles.title}>Criar seu acesso</h1>
        <p style={styles.subtitle}>
          Você foi convidado como <strong>{info.cargo}</strong>. Defina sua senha
          para entrar.
        </p>

        {erro && <p style={styles.erro}>{erro}</p>}

        <form action={aceitarConvite} style={styles.form}>
          <input type="hidden" name="token" value={token} />
          <input type="hidden" name="email" value={info.email} />
          <label style={styles.label}>
            E-mail
            <input value={info.email} readOnly style={{ ...styles.input, opacity: 0.7 }} />
          </label>
          <label style={styles.label}>
            Seu nome
            <input name="nome" required style={styles.input} />
          </label>
          <label style={styles.label}>
            Senha
            <input name="password" type="password" required minLength={6} style={styles.input} />
          </label>
          <button type="submit" style={styles.button}>Entrar na equipe</button>
        </form>
      </div>
    </main>
  )
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { minHeight: '100dvh', display: 'grid', placeItems: 'center', background: '#0f1115', padding: 24 },
  card: { width: '100%', maxWidth: 380, background: '#171a21', border: '1px solid #262b36', borderRadius: 14, padding: '28px 24px', color: '#e6e8ec' },
  eyebrow: { fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', color: '#7aa7ff', margin: '0 0 4px' },
  title: { fontSize: 20, fontWeight: 600, margin: '0 0 4px' },
  subtitle: { fontSize: 14, color: '#9aa1ad', margin: '0 0 20px' },
  form: { display: 'flex', flexDirection: 'column', gap: 14 },
  label: { display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: '#c2c7d0' },
  input: { height: 40, borderRadius: 8, border: '1px solid #2d333f', background: '#0f1115', color: '#e6e8ec', padding: '0 12px', fontSize: 14 },
  button: { height: 42, borderRadius: 8, border: 'none', background: '#3b82f6', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', marginTop: 4 },
  erro: { background: '#2a1416', border: '1px solid #5c2326', color: '#f4a7ab', fontSize: 13, padding: '8px 12px', borderRadius: 8, margin: '0 0 16px' },
}
