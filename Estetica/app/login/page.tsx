import { entrar } from '@/app/auth/actions'
import Link from 'next/link'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; aviso?: string }>
}) {
  const { erro, aviso } = await searchParams

  return (
    <main style={styles.wrap}>
      <div style={styles.card}>
        <h1 style={styles.title}>Entrar</h1>
        <p style={styles.subtitle}>Acesse o painel da sua estética.</p>

        {aviso === 'confirme-seu-email' && (
          <p style={styles.aviso}>
            Enviamos um link de confirmação para o seu e-mail. Confirme para
            poder entrar.
          </p>
        )}
        {erro && <p style={styles.erro}>{erro}</p>}

        <form action={entrar} style={styles.form}>
          <label style={styles.label}>
            E-mail
            <input name="email" type="email" required style={styles.input} />
          </label>
          <label style={styles.label}>
            Senha
            <input name="password" type="password" required style={styles.input} />
          </label>
          <button type="submit" style={styles.button}>Entrar</button>
        </form>

        <p style={{ ...styles.foot, marginTop: 14 }}>
          <Link href="/recuperar" style={styles.link}>Esqueci minha senha</Link>
        </p>

        <p style={styles.foot}>
          Acesso exclusivo. Fale com a administração para liberar sua estética.
        </p>
      </div>
    </main>
  )
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { minHeight: '100dvh', display: 'grid', placeItems: 'center', background: '#0f1115', padding: 24 },
  card: { width: '100%', maxWidth: 380, background: '#171a21', border: '1px solid #262b36', borderRadius: 14, padding: '28px 24px', color: '#e6e8ec' },
  title: { fontSize: 20, fontWeight: 600, margin: '0 0 4px' },
  subtitle: { fontSize: 14, color: '#9aa1ad', margin: '0 0 20px' },
  form: { display: 'flex', flexDirection: 'column', gap: 14 },
  label: { display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: '#c2c7d0' },
  input: { height: 40, borderRadius: 8, border: '1px solid #2d333f', background: '#0f1115', color: '#e6e8ec', padding: '0 12px', fontSize: 14 },
  button: { height: 42, borderRadius: 8, border: 'none', background: '#3b82f6', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', marginTop: 4 },
  erro: { background: '#2a1416', border: '1px solid #5c2326', color: '#f4a7ab', fontSize: 13, padding: '8px 12px', borderRadius: 8, margin: '0 0 16px' },
  aviso: { background: '#13211a', border: '1px solid #245c3e', color: '#86e0ab', fontSize: 13, padding: '8px 12px', borderRadius: 8, margin: '0 0 16px' },
  foot: { fontSize: 13, color: '#9aa1ad', textAlign: 'center', marginTop: 18 },
  link: { color: '#7aa7ff', textDecoration: 'none' },
}
