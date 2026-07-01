import { criarOrdem } from '@/app/ordens/actions'
import Link from 'next/link'

export default async function NovaOrdemPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>
}) {
  const { erro } = await searchParams

  return (
    <main style={s.wrap}>
      <div style={s.card}>
        <h1 style={s.title}>Nova ordem</h1>
        <p style={s.subtitle}>Quem é o cliente e qual o veículo?</p>

        <p style={s.dica}>
          Cliente recorrente? <Link href="/clientes" style={s.link}>Busque na lista</Link> e
          abra a ordem pelo veículo dele.
        </p>

        {erro && <p style={s.erro}>{erro}</p>}

        <form action={criarOrdem} style={s.form}>
          <p style={s.grupo}>Cliente</p>
          <label style={s.label}>
            Nome
            <input name="cliente_nome" required style={s.input} />
          </label>
          <label style={s.label}>
            Telefone (opcional)
            <input name="cliente_telefone" style={s.input} />
          </label>

          <p style={s.grupo}>Veículo</p>
          <label style={s.label}>
            Modelo
            <input name="veiculo_modelo" placeholder="Civic, Onix..." style={s.input} />
          </label>
          <div style={s.linha2}>
            <label style={{ ...s.label, flex: 1 }}>
              Placa
              <input name="veiculo_placa" style={s.input} />
            </label>
            <label style={{ ...s.label, flex: 1 }}>
              Cor
              <input name="veiculo_cor" style={s.input} />
            </label>
          </div>

          <button type="submit" style={s.button}>Abrir ordem</button>
        </form>

        <Link href="/ordens" style={s.voltar}>← Cancelar</Link>
      </div>
    </main>
  )
}

const s: Record<string, React.CSSProperties> = {
  wrap: { minHeight: '100dvh', display: 'grid', placeItems: 'center', background: '#0f1115', padding: 24 },
  card: { width: '100%', maxWidth: 420, background: '#171a21', border: '1px solid #262b36', borderRadius: 14, padding: '28px 24px', color: '#e6e8ec' },
  title: { fontSize: 20, fontWeight: 600, margin: '0 0 4px' },
  subtitle: { fontSize: 14, color: '#9aa1ad', margin: '0 0 20px' },
  form: { display: 'flex', flexDirection: 'column', gap: 12 },
  grupo: { fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', color: '#7aa7ff', margin: '8px 0 0' },
  label: { display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: '#c2c7d0' },
  linha2: { display: 'flex', gap: 10 },
  input: { height: 40, borderRadius: 8, border: '1px solid #2d333f', background: '#0f1115', color: '#e6e8ec', padding: '0 12px', fontSize: 14 },
  button: { height: 42, borderRadius: 8, border: 'none', background: '#3b82f6', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', marginTop: 8 },
  erro: { background: '#2a1416', border: '1px solid #5c2326', color: '#f4a7ab', fontSize: 13, padding: '8px 12px', borderRadius: 8, margin: '0 0 16px' },
  voltar: { display: 'inline-block', marginTop: 16, fontSize: 13, color: '#9aa1ad', textDecoration: 'none' },
  dica: { fontSize: 13, color: '#9aa1ad', background: '#0f1115', border: '1px solid #262b36', borderRadius: 8, padding: '10px 12px', margin: '0 0 18px' },
  link: { color: '#7aa7ff', textDecoration: 'none' },
}
