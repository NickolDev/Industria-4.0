import { redefinirSenha } from '@/app/auth/actions'

export default async function RedefinirSenhaPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>
}) {
  const { erro } = await searchParams

  return (
    <main style={s.wrap}>
      <div style={s.card}>
        <h1 style={s.title}>Nova senha</h1>
        <p style={s.subtitle}>Escolha uma nova senha para sua conta.</p>

        {erro && <p style={s.erro}>{erro}</p>}

        <form action={redefinirSenha} style={s.form}>
          <label style={s.label}>
            Nova senha
            <input name="password" type="password" required minLength={6} style={s.input} />
          </label>
          <label style={s.label}>
            Repita a nova senha
            <input name="password2" type="password" required minLength={6} style={s.input} />
          </label>
          <button type="submit" style={s.button}>Salvar nova senha</button>
        </form>
      </div>
    </main>
  )
}

const s: Record<string, React.CSSProperties> = {
  wrap: { minHeight: '100dvh', display: 'grid', placeItems: 'center', background: '#0f1115', padding: 24 },
  card: { width: '100%', maxWidth: 380, background: '#171a21', border: '1px solid #262b36', borderRadius: 14, padding: '28px 24px', color: '#e6e8ec' },
  title: { fontSize: 20, fontWeight: 600, margin: '0 0 4px' },
  subtitle: { fontSize: 14, color: '#9aa1ad', margin: '0 0 20px' },
  form: { display: 'flex', flexDirection: 'column', gap: 14 },
  label: { display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: '#c2c7d0' },
  input: { height: 40, borderRadius: 8, border: '1px solid #2d333f', background: '#0f1115', color: '#e6e8ec', padding: '0 12px', fontSize: 14 },
  button: { height: 42, borderRadius: 8, border: 'none', background: '#3b82f6', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', marginTop: 4 },
  erro: { background: '#2a1416', border: '1px solid #5c2326', color: '#f4a7ab', fontSize: 13, padding: '8px 12px', borderRadius: 8, margin: '0 0 16px' },
}
