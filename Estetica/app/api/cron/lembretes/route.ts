import { NextRequest, NextResponse } from 'next/server'
import { enviarLembretesDoDia } from '@/lib/whatsapp'

// Disparado diariamente pelo Vercel Cron (ver vercel.json). A Vercel
// inclui automaticamente o header Authorization: Bearer <CRON_SECRET>
// quando a variável CRON_SECRET está definida no projeto.
export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ erro: 'não autorizado' }, { status: 401 })
  }

  const resultado = await enviarLembretesDoDia()
  return NextResponse.json(resultado)
}
