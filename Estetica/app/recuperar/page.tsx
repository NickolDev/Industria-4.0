import { enviarRecuperacao } from '@/app/auth/actions'
import Link from 'next/link'

export default async function RecuperarPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; enviado?: string }>
}) {
  const { erro, enviado } = await searchParams

  return (
    <main style={s.wrap}>
      <div style={s.card}>
        <h1 style={s.title}>Recuperar senha</h1>
        <p style={s.subtitle}>
          Informe seu e-mail. Se houver uma conta, enviaremos um link para criar
          uma nova senha.
        </p>

        {enviado && (
          <p style={s.aviso}>
            Pronto! Se o e-mail estiver cadastrado, o link de recuperação já está
            a caminho. Verifique a caixa de entrada (e o spam).
          </p>
        )}
        {erro && <p style={s.erro}>{erro}</p>}

        <form action={enviarRecuperacao} style={s.form}>
          <label style={s.label}>
            E-mail
            <input name="email" type="email" required style={s.input} />
          </label>
          <button type="submit" style={s.button}>Enviar link</button>
        </form>

        <p style={s.foot}>
          <Link href="/login" style={s.link}>← Voltar para o login</Link>
        </p>
      </div>
    </main>
  )
}

const s: Record<string, React.CSSProperties> = {
  wrap: { minHeight: '100dvh', display: 'grid', placeItems: 'center', background: '#0f1115', padding: 24 },
  card: { width: '100%', maxWidth: 380, background: '#171a21', border: '1px solid #262b36', borderRadius: 14, padding: '28px 24px', color: '#e6e8ec' },
  title: { fontSize: 20, fontWeight: 600, margin: '0 0 4px' },
  subtitle: { fontSize: 14, color: '#9aa1ad', margin: '0 0 20px', lineHeight: 1.5 },
  form: { display: 'flex', flexDirection: 'column', gap: 14 },
  label: { display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: '#c2c7d0' },
  input: { height: 40, borderRadius: 8, border: '1px solid #2d333f', background: '#0f1115', color: '#e6e8ec', padding: '0 12px', fontSize: 14 },
  button: { height: 42, borderRadius: 8, border: 'none', background: '#3b82f6', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', marginTop: 4 },
  erro: { background: '#2a1416', border: '1px solid #5c2326', color: '#f4a7ab', fontSize: 13, padding: '8px 12px', borderRadius: 8, margin: '0 0 16px' },
  aviso: { background: '#13211a', border: '1px solid #245c3e', color: '#86e0ab', fontSize: 13, padding: '8px 12px', borderRadius: 8, margin: '0 0 16px', lineHeight: 1.5 },
  foot: { fontSize: 13, color: '#9aa1ad', textAlign: 'center', marginTop: 18 },
  link: { color: '#7aa7ff', textDecoration: 'none' },
}
