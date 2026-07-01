import Link from 'next/link'

export default function CadastroPage() {
  return (
    <main style={styles.wrap}>
      <div style={styles.card}>
        <h1 style={styles.title}>Cadastro fechado</h1>
        <p style={styles.subtitle}>
          As contas são criadas pela administração. Entre em contato para
          liberar o acesso da sua estética.
        </p>
        <Link href="/login" style={styles.link}>← Voltar para o login</Link>
      </div>
    </main>
  )
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f1115', padding: 24 },
  card: { width: '100%', maxWidth: 380, background: '#171a21', border: '1px solid #262b36', borderRadius: 14, padding: 28, color: '#e6e8ec', textAlign: 'center' },
  title: { fontSize: 22, fontWeight: 600, margin: '0 0 8px' },
  subtitle: { fontSize: 14, color: '#9aa1ad', margin: '0 0 18px', lineHeight: 1.5 },
  link: { fontSize: 14, color: '#7aa7ff', textDecoration: 'none' },
}
