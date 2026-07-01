import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'

// =====================================================================
// Camada de autorização da aplicação (defesa em profundidade).
//
// O RLS do banco já é a trava principal — mesmo que estas funções
// falhem, o banco recusa acesso a dados de outro tenant. Estas funções
// são uma SEGUNDA barreira, no servidor, que:
//   - garante que há um usuário logado de verdade (getUser valida o
//     token no servidor de auth, não confia só no cookie);
//   - garante que a estática dele está ATIVA (não suspensa por
//     pagamento) antes de deixar qualquer escrita acontecer;
//   - opcionalmente, exige cargo de admin.
//
// Falha => redireciona (nunca segue adiante numa ação sensível).
// =====================================================================

type Sessao = {
  supabase: Awaited<ReturnType<typeof createClient>>
  userId: string
  tenantId: string
  status: string
}

// Exige usuário logado + tenant ativo. Use no início de toda action
// que grava dados. Retorna o cliente e o contexto já validado.
export async function exigirSessaoAtiva(): Promise<Sessao> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: mt } = await supabase.rpc('meu_tenant')
  // meu_tenant devolve { id, nome, status } ignorando o bloqueio, para
  // conseguirmos distinguir "não tem tenant" de "tenant suspenso".
  if (!mt || !mt.id) redirect('/login')
  if (mt.status !== 'ativo') redirect('/bloqueado')

  return { supabase, userId: user.id, tenantId: mt.id, status: mt.status }
}

// Igual à anterior, mas também exige cargo de admin (dono/gerente).
// Use em ações de configuração/catálogo/estoque/equipe.
export async function exigirAdmin(): Promise<Sessao> {
  const sessao = await exigirSessaoAtiva()

  const { data: ehAdmin } = await sessao.supabase.rpc('tem_cargo_admin')
  if (!ehAdmin) redirect('/dashboard')

  return sessao
}

// Exige que o usuário seja admin da PLATAFORMA (super-admin/você).
// Use nas ações do painel /admin.
export async function exigirPlataforma() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: ok } = await supabase.rpc('is_plataforma_admin')
  if (!ok) redirect('/dashboard')

  return { supabase, userId: user.id }
}
