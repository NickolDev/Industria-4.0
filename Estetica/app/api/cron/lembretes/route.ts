import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { enviarLembretesDoDia } from '@/lib/whatsapp'

// Compara dois segredos em tempo constante — não vaza, pelo tempo de
// resposta, o quanto do segredo estava certo (proteção contra timing
// attack). Retorna false se qualquer um for vazio ou de tamanho diferente.
function segredosBatem(a: string, b: string): boolean {
  if (!a || !b) return false
  const ba = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ba.length !== bb.length) return false
  return timingSafeEqual(ba, bb)
}

// Disparado diariamente pelo Vercel Cron (ver vercel.json). A Vercel
// inclui automaticamente o header Authorization: Bearer <CRON_SECRET>
// quando a variável CRON_SECRET está definida no projeto.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  const auth = request.headers.get('authorization') ?? ''

  // Sem segredo configurado: recusa (não deixa a rota aberta por acidente).
  if (!secret || !segredosBatem(auth, `Bearer ${secret}`)) {
    return NextResponse.json({ erro: 'não autorizado' }, { status: 401 })
  }

  const resultado = await enviarLembretesDoDia()
  return NextResponse.json(resultado)
}
