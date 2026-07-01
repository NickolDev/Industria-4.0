'use client'

import { useState } from 'react'

// Botão de submit que pede confirmação inline antes de enviar o form.
// Use dentro de um <form action={...}> com os hidden inputs necessários.
export default function ConfirmSubmit({
  label,
  confirmLabel = 'Confirmar',
  pergunta = 'Tem certeza?',
  style,
  confirmStyle,
}: {
  label: React.ReactNode
  confirmLabel?: string
  pergunta?: string
  style?: React.CSSProperties
  confirmStyle?: React.CSSProperties
}) {
  const [armado, setArmado] = useState(false)

  if (!armado) {
    return (
      <button type="button" style={style} onClick={() => setArmado(true)}>
        {label}
      </button>
    )
  }

  return (
    <span style={wrap}>
      <span style={txt}>{pergunta}</span>
      <button type="submit" style={confirmStyle ?? style}>{confirmLabel}</button>
      <button type="button" style={no} onClick={() => setArmado(false)}>Não</button>
    </span>
  )
}

const wrap: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }
const txt: React.CSSProperties = { fontSize: 13, color: '#9aa1ad' }
const no: React.CSSProperties = { height: 34, padding: '0 12px', borderRadius: 8, border: '1px solid #2d333f', background: 'transparent', color: '#c2c7d0', fontSize: 13, cursor: 'pointer' }
