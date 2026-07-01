import { createAdminClient } from '@/utils/supabase/admin'

const TZ = 'America/Sao_Paulo'
const OFFSET = '-03:00'

// --- Helpers ---------------------------------------------------------
function normalizarTelefone(tel: string | null | undefined) {
  const d = (tel ?? '').replace(/\D/g, '')
  if (!d) return ''
  return d.startsWith('55') ? d : `55${d}` // assume Brasil
}

function addDias(dia: string, n: number) {
  const d = new Date(`${dia}T12:00:00${OFFSET}`)
  d.setDate(d.getDate() + n)
  return d.toLocaleDateString('en-CA', { timeZone: TZ })
}

type Config = {
  phone_number_id: string
  access_token: string
  idioma: string
}

// --- Envio cru de um template via Cloud API --------------------------
async function enviarTemplate(
  config: Config,
  paraBruto: string,
  template: string,
  variaveis: string[] = []
): Promise<{ ok: boolean; detalhe: string; destino: string }> {
  const to = normalizarTelefone(paraBruto)
  if (!to) return { ok: false, detalhe: 'Telefone inválido', destino: '' }
  if (!config.phone_number_id || !config.access_token) {
    return { ok: false, detalhe: 'Cloud API não configurada', destino: to }
  }

  const body = {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: template,
      language: { code: config.idioma || 'pt_BR' },
      ...(variaveis.length
        ? {
            components: [
              {
                type: 'body',
                parameters: variaveis.map((t) => ({ type: 'text', text: t })),
              },
            ],
          }
        : {}),
    },
  }

  try {
    const resp = await fetch(
      `https://graph.facebook.com/v23.0/${config.phone_number_id}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }
    )
    const data: any = await resp.json().catch(() => ({}))
    return resp.ok
      ? { ok: true, detalhe: data?.messages?.[0]?.id ?? 'enviado', destino: to }
      : { ok: false, detalhe: data?.error?.message ?? `HTTP ${resp.status}`, destino: to }
  } catch (e: any) {
    return { ok: false, detalhe: e?.message ?? 'Falha de rede', destino: to }
  }
}

async function registrar(
  admin: ReturnType<typeof createAdminClient>,
  tenantId: string,
  tipo: string,
  template: string,
  r: { ok: boolean; detalhe: string; destino: string }
) {
  await admin.from('notificacoes').insert({
    tenant_id: tenantId,
    tipo,
    destino: r.destino,
    template,
    status: r.ok ? 'enviado' : 'falha',
    detalhe: r.detalhe,
  })
}

async function carregarConfig(
  admin: ReturnType<typeof createAdminClient>,
  tenantId: string
) {
  const { data } = await admin
    .from('whatsapp_config')
    .select('phone_number_id, access_token, idioma, template_pronto, template_lembrete, ativo')
    .eq('tenant_id', tenantId)
    .single()
  return data
}

// --- Carro pronto (chamado ao fechar a ordem) ------------------------
export async function notificarOrdemPronta(osId: string) {
  const admin = createAdminClient()

  const { data: ordem } = await admin
    .from('ordens_servico')
    .select('tenant_id, cliente:clientes(nome, telefone), veiculo:veiculos(modelo)')
    .eq('id', osId)
    .single()
  if (!ordem) return

  const cfg = await carregarConfig(admin, (ordem as any).tenant_id)
  if (!cfg || !cfg.ativo) return // estética não usa WhatsApp: silencioso

  const cliente: any = (ordem as any).cliente
  const veiculo: any = (ordem as any).veiculo
  if (!cliente?.telefone) return

  const r = await enviarTemplate(
    cfg as Config,
    cliente.telefone,
    cfg.template_pronto,
    [cliente.nome ?? 'cliente', veiculo?.modelo ?? 'veículo']
  )
  await registrar(admin, (ordem as any).tenant_id, 'pronto', cfg.template_pronto, r)
}

// --- Envio de teste (a partir das configurações) ---------------------
export async function enviarTeste(tenantId: string, telefone: string) {
  const admin = createAdminClient()
  const cfg = await carregarConfig(admin, tenantId)
  if (!cfg) return { ok: false, detalhe: 'Configuração não encontrada' }

  const r = await enviarTemplate(cfg as Config, telefone, cfg.template_pronto, ['cliente', 'veículo'])
  await registrar(admin, tenantId, 'teste', cfg.template_pronto, r)
  return r
}

// --- Lembretes do dia seguinte (chamado pelo cron) -------------------
export async function enviarLembretesDoDia() {
  const admin = createAdminClient()

  const hoje = new Date().toLocaleDateString('en-CA', { timeZone: TZ })
  const amanha = addDias(hoje, 1)
  const inicio = `${amanha}T00:00:00${OFFSET}`
  const fim = `${addDias(amanha, 1)}T00:00:00${OFFSET}`

  const { data: ags } = await admin
    .from('agendamentos')
    .select('tenant_id, inicio, status, cliente:clientes(nome, telefone)')
    .gte('inicio', inicio)
    .lt('inicio', fim)
    .in('status', ['agendado', 'confirmado'])

  let enviados = 0
  const cacheCfg = new Map<string, any>()

  for (const a of (ags ?? []) as any[]) {
    if (!cacheCfg.has(a.tenant_id)) {
      cacheCfg.set(a.tenant_id, await carregarConfig(admin, a.tenant_id))
    }
    const cfg = cacheCfg.get(a.tenant_id)
    if (!cfg || !cfg.ativo || !a.cliente?.telefone) continue

    const quando = new Date(a.inicio).toLocaleString('pt-BR', {
      timeZone: TZ, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
    })
    const r = await enviarTemplate(cfg as Config, a.cliente.telefone, cfg.template_lembrete, [
      a.cliente.nome ?? 'cliente',
      quando,
    ])
    await registrar(admin, a.tenant_id, 'lembrete', cfg.template_lembrete, r)
    if (r.ok) enviados++
  }

  return { total: (ags ?? []).length, enviados }
}
