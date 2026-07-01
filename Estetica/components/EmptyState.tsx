import Link from 'next/link'

const ICONS: Record<string, string> = {
  ordens:
    '<path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 12h6M9 16h4"/>',
  clientes:
    '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/>',
  servicos:
    '<path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6z"/>',
  estoque:
    '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="M3.3 7L12 12l8.7-5M12 22V12"/>',
  agenda:
    '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  busca:
    '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
}

export default function EmptyState({
  icon = 'ordens',
  titulo,
  descricao,
  acaoHref,
  acaoLabel,
}: {
  icon?: keyof typeof ICONS | string
  titulo: string
  descricao: string
  acaoHref?: string
  acaoLabel?: string
}) {
  return (
    <div style={box}>
      <span
        style={ring}
        dangerouslySetInnerHTML={{
          __html: `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${ICONS[icon] ?? ICONS.ordens}</svg>`,
        }}
      />
      <h3 style={t}>{titulo}</h3>
      <p style={d}>{descricao}</p>
      {acaoHref && acaoLabel && (
        <Link href={acaoHref} style={btn}>{acaoLabel}</Link>
      )}
    </div>
  )
}

const box: React.CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '44px 24px', background: '#171a21', border: '1px dashed #2d333f', borderRadius: 14 }
const ring: React.CSSProperties = { width: 56, height: 56, borderRadius: 14, background: '#16213c', color: '#7aa7ff', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }
const t: React.CSSProperties = { fontSize: 16, fontWeight: 600, color: '#e6e8ec', margin: '0 0 6px' }
const d: React.CSSProperties = { fontSize: 13.5, color: '#9aa1ad', margin: '0 0 18px', maxWidth: 320, lineHeight: 1.5 }
const btn: React.CSSProperties = { background: '#3b82f6', color: '#fff', fontSize: 14, fontWeight: 600, textDecoration: 'none', padding: '10px 18px', borderRadius: 9 }
