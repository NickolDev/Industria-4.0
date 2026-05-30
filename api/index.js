const express = require('express');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');

const app = express();
const JWT_SECRET = 'paulinho-autocenter-2025';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres.wxeqyotnhfsacagyqefp:zMl5hsZEvpr7bfi9@aws-1-sa-east-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

function auth(req, res, next) {
  const h = req.headers['authorization'];
  if (!h) return res.status(401).json({ erro: 'Não autorizado' });
  try { req.user = jwt.verify(h.split(' ')[1], JWT_SECRET); next(); }
  catch { res.status(401).json({ erro: 'Token inválido' }); }
}

async function log(usuario, acao, tabela, detalhe) {
  try { await pool.query('INSERT INTO auditoria(usuario,acao,tabela,detalhe) VALUES($1,$2,$3,$4)', [usuario,acao,tabela,detalhe]); } catch{}
}

// ══════════════════════════════
// AUTH
// ══════════════════════════════
app.post('/api/login', async (req,res) => {
  try {
    const {usuario,senha} = req.body;
    const r = await pool.query('SELECT * FROM usuarios WHERE usuario=$1 AND senha=$2',[usuario,senha]);
    if (!r.rows.length) return res.status(401).json({erro:'Usuário ou senha inválidos'});
    const u = r.rows[0];
    const token = jwt.sign({id:u.id,nome:u.nome,perfil:u.perfil},JWT_SECRET,{expiresIn:'12h'});
    await log(u.nome,'LOGIN','usuarios',`Perfil: ${u.perfil}`);
    res.json({token,nome:u.nome,perfil:u.perfil});
  } catch(e){res.status(500).json({erro:e.message});}
});

// ══════════════════════════════
// USUÁRIOS
// ══════════════════════════════
app.get('/api/usuarios', auth, async (req,res) => {
  const r = await pool.query('SELECT id,nome,usuario,perfil,criado_em FROM usuarios ORDER BY nome');
  res.json(r.rows);
});
app.post('/api/usuarios', auth, async (req,res) => {
  const {nome,usuario,senha,perfil} = req.body;
  if(!nome||!usuario||!senha) return res.status(400).json({erro:'Campos obrigatórios'});
  try {
    const r = await pool.query('INSERT INTO usuarios(nome,usuario,senha,perfil) VALUES($1,$2,$3,$4) RETURNING id',[nome,usuario,senha,perfil||'atendente']);
    res.json({id:r.rows[0].id});
  } catch{res.status(400).json({erro:'Usuário já existe'});}
});
app.put('/api/usuarios/:id', auth, async (req,res) => {
  const {nome,usuario,senha,perfil} = req.body;
  if(senha) await pool.query('UPDATE usuarios SET nome=$1,usuario=$2,senha=$3,perfil=$4 WHERE id=$5',[nome,usuario,senha,perfil,req.params.id]);
  else await pool.query('UPDATE usuarios SET nome=$1,usuario=$2,perfil=$3 WHERE id=$4',[nome,usuario,perfil,req.params.id]);
  res.json({ok:true});
});
app.delete('/api/usuarios/:id', auth, async (req,res) => {
  if(parseInt(req.params.id)===req.user.id) return res.status(400).json({erro:'Não pode excluir a si mesmo'});
  await pool.query('DELETE FROM usuarios WHERE id=$1',[req.params.id]);
  res.json({ok:true});
});

// ══════════════════════════════
// CLIENTES
// ══════════════════════════════
app.get('/api/clientes', auth, async (req,res) => {
  const q = req.query.q ? `%${req.query.q}%` : '%';
  const r = await pool.query(`
    SELECT c.*, COUNT(DISTINCT v.id)::int as total_veiculos, COUNT(DISTINCT os.id)::int as total_os
    FROM clientes c
    LEFT JOIN veiculos v ON v.cliente_id=c.id
    LEFT JOIN ordens_servico os ON os.cliente_id=c.id
    WHERE c.nome ILIKE $1 OR c.telefone ILIKE $1 OR c.cpf ILIKE $1
    GROUP BY c.id ORDER BY c.nome`,[q]);
  res.json(r.rows);
});
app.get('/api/clientes/:id', auth, async (req,res) => {
  const c = await pool.query('SELECT * FROM clientes WHERE id=$1',[req.params.id]);
  if(!c.rows.length) return res.status(404).json({erro:'Não encontrado'});
  const v = await pool.query('SELECT * FROM veiculos WHERE cliente_id=$1 ORDER BY placa',[req.params.id]);
  const o = await pool.query(`SELECT os.*,v.placa,v.modelo FROM ordens_servico os JOIN veiculos v ON v.id=os.veiculo_id WHERE os.cliente_id=$1 ORDER BY os.id DESC LIMIT 20`,[req.params.id]);
  res.json({...c.rows[0],veiculos:v.rows,historico_os:o.rows});
});
app.post('/api/clientes', auth, async (req,res) => {
  const {nome,telefone,email,cpf,endereco} = req.body;
  if(!nome) return res.status(400).json({erro:'Nome obrigatório'});
  const r = await pool.query('INSERT INTO clientes(nome,telefone,email,cpf,endereco) VALUES($1,$2,$3,$4,$5) RETURNING id',[nome,telefone,email,cpf,endereco]);
  await log(req.user.nome,'CRIAR','clientes',nome);
  res.json({id:r.rows[0].id});
});
app.put('/api/clientes/:id', auth, async (req,res) => {
  const {nome,telefone,email,cpf,endereco} = req.body;
  await pool.query('UPDATE clientes SET nome=$1,telefone=$2,email=$3,cpf=$4,endereco=$5 WHERE id=$6',[nome,telefone,email,cpf,endereco,req.params.id]);
  res.json({ok:true});
});
app.delete('/api/clientes/:id', auth, async (req,res) => {
  await pool.query('DELETE FROM clientes WHERE id=$1',[req.params.id]);
  res.json({ok:true});
});

// ══════════════════════════════
// VEÍCULOS
// ══════════════════════════════
app.get('/api/veiculos', auth, async (req,res) => {
  const q = req.query.q ? `%${req.query.q}%` : '%';
  const r = await pool.query(`
    SELECT v.*, c.nome as cliente_nome, c.telefone as cliente_tel
    FROM veiculos v JOIN clientes c ON c.id=v.cliente_id
    WHERE v.placa ILIKE $1 OR v.modelo ILIKE $1 OR c.nome ILIKE $1
    ORDER BY v.placa`,[q]);
  res.json(r.rows);
});
app.get('/api/veiculos/:id/historico', auth, async (req,res) => {
  const r = await pool.query(`
    SELECT os.*, c.nome as cliente_nome,
      COALESCE(json_agg(json_build_object('nome',p.nome,'qtd',op.qtd,'preco',op.preco_un)) FILTER (WHERE p.id IS NOT NULL),'[]') as pecas_usadas
    FROM ordens_servico os JOIN clientes c ON c.id=os.cliente_id
    LEFT JOIN os_pecas op ON op.os_id=os.id LEFT JOIN pecas p ON p.id=op.peca_id
    WHERE os.veiculo_id=$1 GROUP BY os.id,c.nome ORDER BY os.id DESC`,[req.params.id]);
  res.json(r.rows);
});
app.post('/api/veiculos', auth, async (req,res) => {
  const {cliente_id,placa,modelo,marca,ano,cor,km_atual,combustivel,chassi,obs} = req.body;
  if(!cliente_id||!placa||!modelo) return res.status(400).json({erro:'Cliente, placa e modelo obrigatórios'});
  try {
    const r = await pool.query('INSERT INTO veiculos(cliente_id,placa,modelo,marca,ano,cor,km_atual,combustivel,chassi,obs) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id',
        [cliente_id,placa.toUpperCase(),modelo,marca,ano,cor,km_atual||0,combustivel,chassi,obs]);
    res.json({id:r.rows[0].id});
  } catch{res.status(400).json({erro:'Placa já cadastrada'});}
});
app.put('/api/veiculos/:id', auth, async (req,res) => {
  const {placa,modelo,marca,ano,cor,km_atual,combustivel,chassi,obs} = req.body;
  await pool.query('UPDATE veiculos SET placa=$1,modelo=$2,marca=$3,ano=$4,cor=$5,km_atual=$6,combustivel=$7,chassi=$8,obs=$9 WHERE id=$10',
      [placa.toUpperCase(),modelo,marca,ano,cor,km_atual,combustivel,chassi,obs,req.params.id]);
  res.json({ok:true});
});
app.delete('/api/veiculos/:id', auth, async (req,res) => {
  await pool.query('DELETE FROM veiculos WHERE id=$1',[req.params.id]);
  res.json({ok:true});
});

// ══════════════════════════════
// PEÇAS
// ══════════════════════════════
app.get('/api/pecas', auth, async (req,res) => {
  const r = await pool.query('SELECT * FROM pecas ORDER BY nome');
  res.json(r.rows);
});
app.post('/api/pecas', auth, async (req,res) => {
  const {nome,categoria,unidade,qtd,qtd_minima,fornecedor,preco_custo,preco_venda} = req.body;
  if(!nome) return res.status(400).json({erro:'Nome obrigatório'});
  const r = await pool.query('INSERT INTO pecas(nome,categoria,unidade,qtd,qtd_minima,fornecedor,preco_custo,preco_venda) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id',
      [nome,categoria||'Outros',unidade||'unid.',qtd||0,qtd_minima||1,fornecedor,preco_custo||0,preco_venda||0]);
  res.json({id:r.rows[0].id});
});
app.put('/api/pecas/:id', auth, async (req,res) => {
  const {nome,categoria,unidade,qtd,qtd_minima,fornecedor,preco_custo,preco_venda} = req.body;
  await pool.query('UPDATE pecas SET nome=$1,categoria=$2,unidade=$3,qtd=$4,qtd_minima=$5,fornecedor=$6,preco_custo=$7,preco_venda=$8 WHERE id=$9',
      [nome,categoria,unidade,qtd,qtd_minima,fornecedor,preco_custo,preco_venda,req.params.id]);
  res.json({ok:true});
});
app.patch('/api/pecas/:id/ajustar', auth, async (req,res) => {
  const {delta,os_id,obs} = req.body;
  const r = await pool.query('UPDATE pecas SET qtd=GREATEST(0,qtd+$1) WHERE id=$2 RETURNING qtd',[delta,req.params.id]);
  try { await pool.query('INSERT INTO estoque_movimentacao(peca_id,tipo,qtd,os_id,usuario,obs) VALUES($1,$2,$3,$4,$5,$6)',
      [req.params.id,delta>0?'entrada':'saida_manual',Math.abs(delta),os_id||null,req.user?.nome||'sistema',obs||'Ajuste manual']); } catch{}
  res.json({ok:true,qtd:r.rows[0].qtd});
});
app.delete('/api/pecas/:id', auth, async (req,res) => {
  await pool.query('DELETE FROM pecas WHERE id=$1',[req.params.id]);
  res.json({ok:true});
});
app.get('/api/estoque/movimentacao', auth, async (req,res) => {
  const r = await pool.query(`SELECT em.*,p.nome as peca_nome FROM estoque_movimentacao em JOIN pecas p ON p.id=em.peca_id ORDER BY em.id DESC LIMIT 200`);
  res.json(r.rows);
});

// ══════════════════════════════
// MECÂNICOS (Etapa 2)
// ══════════════════════════════
app.get('/api/mecanicos', auth, async (req,res) => {
  const r = await pool.query(`
    SELECT m.*, COUNT(os.id)::int as total_os,
      COUNT(CASE WHEN os.status NOT IN ('finalizado','entregue','cancelado') THEN 1 END)::int as os_ativas
    FROM mecanicos m LEFT JOIN ordens_servico os ON os.mecanico=m.nome
    GROUP BY m.id ORDER BY m.nome`);
  res.json(r.rows);
});
app.post('/api/mecanicos', auth, async (req,res) => {
  const {nome,telefone,especialidade,status,comissao,obs} = req.body;
  if(!nome) return res.status(400).json({erro:'Nome obrigatório'});
  const r = await pool.query('INSERT INTO mecanicos(nome,telefone,especialidade,status,comissao,obs) VALUES($1,$2,$3,$4,$5,$6) RETURNING id',
      [nome,telefone,especialidade||'Mecânica geral',status||'disponivel',comissao||0,obs]);
  res.json({id:r.rows[0].id});
});
app.put('/api/mecanicos/:id', auth, async (req,res) => {
  const {nome,telefone,especialidade,status,comissao,obs} = req.body;
  await pool.query('UPDATE mecanicos SET nome=$1,telefone=$2,especialidade=$3,status=$4,comissao=$5,obs=$6 WHERE id=$7',
      [nome,telefone,especialidade,status,comissao,obs,req.params.id]);
  res.json({ok:true});
});
app.delete('/api/mecanicos/:id', auth, async (req,res) => {
  await pool.query('DELETE FROM mecanicos WHERE id=$1',[req.params.id]);
  res.json({ok:true});
});
app.get('/api/mecanicos/:id/relatorio', auth, async (req,res) => {
  const {de,ate} = req.query;
  const mec = await pool.query('SELECT * FROM mecanicos WHERE id=$1',[req.params.id]);
  if(!mec.rows.length) return res.status(404).json({erro:'Mecânico não encontrado'});
  let sql=`SELECT * FROM ordens_servico WHERE mecanico=$1`;
  const p=[mec.rows[0].nome]; let i=2;
  if(de){sql+=` AND criado_em::date>=$${i++}`;p.push(de);}
  if(ate){sql+=` AND criado_em::date<=$${i++}`;p.push(ate);}
  const os = await pool.query(sql,p);
  const vales = await pool.query('SELECT * FROM vales WHERE mecanico_id=$1 AND descontado=false',[req.params.id]);
  const totalMaoObra = os.rows.filter(o=>['finalizado','entregue'].includes(o.status)).reduce((s,o)=>s+(parseFloat(o.valor_mao_obra)||parseFloat(o.valor_total)||0),0);
  const comissao = totalMaoObra * (mec.rows[0].comissao/100);
  const totalVales = vales.rows.reduce((s,v)=>s+(parseFloat(v.valor)||0),0);
  res.json({mecanico:mec.rows[0],os:os.rows,vales:vales.rows,totalMaoObra,comissao,totalVales,liquido:comissao-totalVales});
});
// Vales
app.get('/api/mecanicos/:id/vales', auth, async (req,res) => {
  const r = await pool.query('SELECT * FROM vales WHERE mecanico_id=$1 ORDER BY id DESC',[req.params.id]);
  res.json(r.rows);
});
app.post('/api/mecanicos/:id/vales', auth, async (req,res) => {
  const {valor,motivo} = req.body;
  if(!valor) return res.status(400).json({erro:'Valor obrigatório'});
  const r = await pool.query('INSERT INTO vales(mecanico_id,valor,motivo,responsavel) VALUES($1,$2,$3,$4) RETURNING id',
      [req.params.id,valor,motivo,req.user.nome]);
  res.json({id:r.rows[0].id});
});
app.delete('/api/vales/:id', auth, async (req,res) => {
  await pool.query('DELETE FROM vales WHERE id=$1',[req.params.id]);
  res.json({ok:true});
});

// ══════════════════════════════
// ELEVADORES
// ══════════════════════════════
app.get('/api/elevadores', auth, async (req,res) => {
  const r = await pool.query(`
    SELECT e.*,
      os.numero as os_numero,os.servico as os_servico,os.mecanico as os_mecanico,
      os.status as os_status,os.prioridade as os_prioridade,
      c.nome as cliente_nome,v.placa as veiculo_placa,
      EXTRACT(EPOCH FROM (NOW()-e.ocupado_em))/60 as minutos_ocupado
    FROM elevadores e
    LEFT JOIN ordens_servico os ON os.id=e.os_id AND os.status NOT IN ('finalizado','entregue','cancelado')
    LEFT JOIN veiculos v ON v.id=os.veiculo_id
    LEFT JOIN clientes c ON c.id=os.cliente_id
    ORDER BY e.id`);
  res.json(r.rows);
});
app.post('/api/elevadores', auth, async (req,res) => {
  const {nome,tipo} = req.body;
  const r = await pool.query('INSERT INTO elevadores(nome,tipo) VALUES($1,$2) RETURNING id',[nome,tipo||'hidraulico']);
  res.json({id:r.rows[0].id});
});
app.put('/api/elevadores/:id', auth, async (req,res) => {
  const {nome,tipo} = req.body;
  await pool.query('UPDATE elevadores SET nome=$1,tipo=$2 WHERE id=$3',[nome,tipo,req.params.id]);
  res.json({ok:true});
});
app.patch('/api/elevadores/:id/liberar', auth, async (req,res) => {
  // Automação: verifica fila de OSs aguardando
  const prox = await pool.query(`
    SELECT id FROM ordens_servico
    WHERE status='aguardando_atendimento' AND elevador_id IS NULL
    ORDER BY CASE prioridade WHEN 'urgente' THEN 1 WHEN 'alta' THEN 2 WHEN 'media' THEN 3 ELSE 4 END, id ASC
    LIMIT 1`);
  if(prox.rows.length) {
    await pool.query("UPDATE elevadores SET status='ocupado',os_id=$1,ocupado_em=NOW() WHERE id=$2",[prox.rows[0].id,req.params.id]);
    await pool.query("UPDATE ordens_servico SET elevador_id=$1,status='em_execucao' WHERE id=$2",[req.params.id,prox.rows[0].id]);
    return res.json({ok:true,alocado:true,os_id:prox.rows[0].id});
  }
  await pool.query("UPDATE elevadores SET status='livre',os_id=NULL,ocupado_em=NULL WHERE id=$1",[req.params.id]);
  res.json({ok:true,alocado:false});
});
app.delete('/api/elevadores/:id', auth, async (req,res) => {
  await pool.query('DELETE FROM elevadores WHERE id=$1',[req.params.id]);
  res.json({ok:true});
});

// ══════════════════════════════
// ORDENS DE SERVIÇO
// ══════════════════════════════
async function gerarNumeroOS(client) {
  const hoje = new Date().toISOString().slice(0,10).replace(/-/g,'');
  const r = await client.query("SELECT COUNT(*) as n FROM ordens_servico WHERE numero LIKE $1",[`OS-${hoje}%`]);
  return `OS-${hoje}-${(parseInt(r.rows[0].n)+1).toString().padStart(3,'0')}`;
}

app.get('/api/os', auth, async (req,res) => {
  const {status,busca,prioridade} = req.query;
  let sql=`SELECT os.*,c.nome as cliente_nome,c.telefone as cliente_tel,v.placa,v.modelo,e.nome as elevador_nome
    FROM ordens_servico os JOIN clientes c ON c.id=os.cliente_id JOIN veiculos v ON v.id=os.veiculo_id
    LEFT JOIN elevadores e ON e.id=os.elevador_id WHERE 1=1`;
  const p=[]; let i=1;
  if(status&&status!=='todos'){sql+=` AND os.status=$${i++}`;p.push(status);}
  if(prioridade&&prioridade!=='todos'){sql+=` AND os.prioridade=$${i++}`;p.push(prioridade);}
  if(busca){sql+=` AND (c.nome ILIKE $${i} OR v.placa ILIKE $${i} OR os.numero ILIKE $${i})`;p.push(`%${busca}%`);i++;}
  sql+=` ORDER BY CASE os.prioridade WHEN 'urgente' THEN 1 WHEN 'alta' THEN 2 WHEN 'media' THEN 3 ELSE 4 END, os.id DESC`;
  const r = await pool.query(sql,p);
  res.json(r.rows);
});

app.get('/api/os/:id', auth, async (req,res) => {
  const r = await pool.query(`SELECT os.*,c.nome as cliente_nome,c.telefone as cliente_tel,v.placa,v.modelo,e.nome as elevador_nome
    FROM ordens_servico os JOIN clientes c ON c.id=os.cliente_id JOIN veiculos v ON v.id=os.veiculo_id
    LEFT JOIN elevadores e ON e.id=os.elevador_id WHERE os.id=$1`,[req.params.id]);
  if(!r.rows.length) return res.status(404).json({erro:'OS não encontrada'});
  const os = r.rows[0];
  const pecas = await pool.query(`SELECT op.*,p.nome as peca_nome,p.unidade,p.qtd as estoque_atual
    FROM os_pecas op JOIN pecas p ON p.id=op.peca_id WHERE op.os_id=$1`,[req.params.id]);
  os.pecas = pecas.rows;
  res.json(os);
});

app.post('/api/os', auth, async (req,res) => {
  const {cliente_id,veiculo_id,elevador_id,mecanico,servico,servico_outro,obs,km_entrada,
    valor_mao_obra,prioridade,previsao_entrega,pecas,status} = req.body;
  if(!cliente_id||!veiculo_id||!mecanico||!servico) return res.status(400).json({erro:'Campos obrigatórios'});
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if(elevador_id){
      const e = await client.query('SELECT * FROM elevadores WHERE id=$1',[elevador_id]);
      if(e.rows[0]?.status==='ocupado') throw new Error(`${e.rows[0].nome} já está ocupado`);
      if(e.rows[0]?.status==='manutencao') throw new Error(`${e.rows[0].nome} está em manutenção`);
    }
    // Valida estoque
    if(pecas&&pecas.length>0){
      for(const p of pecas){
        const est = await client.query('SELECT qtd,nome FROM pecas WHERE id=$1',[p.peca_id]);
        if(est.rows[0].qtd < p.qtd) throw new Error(`Estoque insuficiente: ${est.rows[0].nome} (disponível: ${est.rows[0].qtd})`);
      }
    }
    const numero = await gerarNumeroOS(client);
    const valorPecas = pecas ? pecas.reduce((s,p)=>s+(p.qtd*(p.preco_un||0)),0) : 0;
    const valorTotal = (parseFloat(valor_mao_obra)||0) + valorPecas;
    const r = await client.query(`INSERT INTO ordens_servico
      (numero,cliente_id,veiculo_id,elevador_id,mecanico,servico,servico_outro,obs,km_entrada,
       valor_total,valor_mao_obra,valor_pecas,prioridade,previsao_entrega,status)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING id`,
        [numero,cliente_id,veiculo_id,elevador_id||null,mecanico,servico,servico_outro||null,
          obs,km_entrada||0,valorTotal,valor_mao_obra||0,valorPecas,
          prioridade||'media',previsao_entrega||null,status||'aguardando_atendimento']);
    const osId = r.rows[0].id;
    if(elevador_id) await client.query("UPDATE elevadores SET status='ocupado',os_id=$1,ocupado_em=NOW() WHERE id=$2",[osId,elevador_id]);
    if(pecas&&pecas.length>0){
      for(const p of pecas){
        await client.query('INSERT INTO os_pecas(os_id,peca_id,qtd,preco_un) VALUES($1,$2,$3,$4)',[osId,p.peca_id,p.qtd,p.preco_un||0]);
        await client.query('UPDATE pecas SET qtd=qtd-$1 WHERE id=$2',[p.qtd,p.peca_id]);
        await client.query('INSERT INTO estoque_movimentacao(peca_id,tipo,qtd,os_id,usuario,obs) VALUES($1,$2,$3,$4,$5,$6)',
            [p.peca_id,'saida_os',p.qtd,osId,req.user.nome,`OS ${numero}`]);
      }
    }
    await client.query('COMMIT');
    await log(req.user.nome,'CRIAR','ordens_servico',`OS: ${numero} | Prio: ${prioridade||'media'}`);
    res.json({id:osId,numero});
  } catch(e){await client.query('ROLLBACK');res.status(500).json({erro:e.message});}
  finally{client.release();}
});

app.put('/api/os/:id', auth, async (req,res) => {
  const {mecanico,servico,servico_outro,obs,status,elevador_id,km_entrada,
    valor_mao_obra,valor_pecas,prioridade,previsao_entrega,
    forma_pagamento,status_pagamento,desconto} = req.body;
  const valorTotal = (parseFloat(valor_mao_obra)||0)+(parseFloat(valor_pecas)||0)-(parseFloat(desconto)||0);
  await pool.query(`UPDATE ordens_servico SET mecanico=$1,servico=$2,servico_outro=$3,obs=$4,status=$5,
    elevador_id=$6,km_entrada=$7,valor_mao_obra=$8,valor_pecas=$9,valor_total=$10,
    prioridade=$11,previsao_entrega=$12,forma_pagamento=$13,status_pagamento=$14,desconto=$15 WHERE id=$16`,
      [mecanico,servico,servico_outro,obs,status,elevador_id,km_entrada,
        valor_mao_obra,valor_pecas,valorTotal,prioridade,previsao_entrega,
        forma_pagamento,status_pagamento,desconto||0,req.params.id]);
  res.json({ok:true});
});

app.patch('/api/os/:id/status', auth, async (req,res) => {
  const {status,km_saida,forma_pagamento,status_pagamento} = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const os = await client.query('SELECT * FROM ordens_servico WHERE id=$1',[req.params.id]);
    if(!os.rows.length) return res.status(404).json({erro:'OS não encontrada'});
    const o = os.rows[0];
    const concluido_em = ['finalizado','entregue'].includes(status) ? new Date() : null;
    await client.query(`UPDATE ordens_servico SET status=$1,concluido_em=$2,km_saida=$3,
      forma_pagamento=COALESCE($4,forma_pagamento),status_pagamento=COALESCE($5,status_pagamento) WHERE id=$6`,
        [status,concluido_em,km_saida||o.km_saida,forma_pagamento,status_pagamento,req.params.id]);
    if(['finalizado','entregue','cancelado'].includes(status)&&o.elevador_id)
      await client.query("UPDATE elevadores SET status='livre',os_id=NULL,ocupado_em=NULL WHERE id=$1",[o.elevador_id]);
    if(status==='aguardando_peca'&&o.elevador_id)
      await client.query("UPDATE elevadores SET status='bloqueado' WHERE id=$1",[o.elevador_id]);
    await client.query('COMMIT');
    await log(req.user.nome,'STATUS','ordens_servico',`OS ${req.params.id} → ${status}`);
    res.json({ok:true});
  } catch(e){await client.query('ROLLBACK');res.status(500).json({erro:e.message});}
  finally{client.release();}
});

// Adicionar/remover peça na OS
app.post('/api/os/:id/pecas', auth, async (req,res) => {
  const {peca_id,qtd,preco_un} = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const est = await client.query('SELECT qtd,nome FROM pecas WHERE id=$1',[peca_id]);
    if(est.rows[0].qtd < qtd) throw new Error(`Estoque insuficiente: ${est.rows[0].nome}`);
    const osn = await client.query('SELECT numero FROM ordens_servico WHERE id=$1',[req.params.id]);
    // Verifica se peça já está na OS
    const existe = await client.query('SELECT id FROM os_pecas WHERE os_id=$1 AND peca_id=$2',[req.params.id,peca_id]);
    if(existe.rows.length) await client.query('UPDATE os_pecas SET qtd=qtd+$1 WHERE os_id=$2 AND peca_id=$3',[qtd,req.params.id,peca_id]);
    else await client.query('INSERT INTO os_pecas(os_id,peca_id,qtd,preco_un) VALUES($1,$2,$3,$4)',[req.params.id,peca_id,qtd,preco_un||0]);
    await client.query('UPDATE pecas SET qtd=qtd-$1 WHERE id=$2',[qtd,peca_id]);
    await client.query('INSERT INTO estoque_movimentacao(peca_id,tipo,qtd,os_id,usuario,obs) VALUES($1,$2,$3,$4,$5,$6)',
        [peca_id,'saida_os',qtd,req.params.id,req.user.nome,`OS ${osn.rows[0].numero}`]);
    const total = await client.query('SELECT COALESCE(SUM(qtd*preco_un),0) as t FROM os_pecas WHERE os_id=$1',[req.params.id]);
    await client.query('UPDATE ordens_servico SET valor_pecas=$1,valor_total=valor_mao_obra+$1 WHERE id=$2',[total.rows[0].t,req.params.id]);
    await client.query('COMMIT');
    res.json({ok:true});
  } catch(e){await client.query('ROLLBACK');res.status(400).json({erro:e.message});}
  finally{client.release();}
});
app.delete('/api/os/:id/pecas/:pid', auth, async (req,res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const op = await client.query('SELECT * FROM os_pecas WHERE os_id=$1 AND peca_id=$2',[req.params.id,req.params.pid]);
    if(!op.rows.length) throw new Error('Peça não encontrada na OS');
    await client.query('UPDATE pecas SET qtd=qtd+$1 WHERE id=$2',[op.rows[0].qtd,req.params.pid]);
    await client.query('DELETE FROM os_pecas WHERE os_id=$1 AND peca_id=$2',[req.params.id,req.params.pid]);
    const total = await client.query('SELECT COALESCE(SUM(qtd*preco_un),0) as t FROM os_pecas WHERE os_id=$1',[req.params.id]);
    await client.query('UPDATE ordens_servico SET valor_pecas=$1,valor_total=valor_mao_obra+$1 WHERE id=$2',[total.rows[0].t,req.params.id]);
    await client.query('COMMIT');
    res.json({ok:true});
  } catch(e){await client.query('ROLLBACK');res.status(400).json({erro:e.message});}
  finally{client.release();}
});

// ══════════════════════════════
// ORÇAMENTOS (Etapa 5)
// ══════════════════════════════
async function gerarNumeroOrc(client) {
  const hoje = new Date().toISOString().slice(0,10).replace(/-/g,'');
  const r = await client.query("SELECT COUNT(*) as n FROM orcamentos WHERE numero LIKE $1",[`ORC-${hoje}%`]);
  return `ORC-${hoje}-${(parseInt(r.rows[0].n)+1).toString().padStart(3,'0')}`;
}
app.get('/api/orcamentos', auth, async (req,res) => {
  const r = await pool.query(`SELECT o.*,c.nome as cliente_nome,v.placa,v.modelo
    FROM orcamentos o JOIN clientes c ON c.id=o.cliente_id JOIN veiculos v ON v.id=o.veiculo_id
    ORDER BY o.id DESC`);
  res.json(r.rows);
});
app.get('/api/orcamentos/:id', auth, async (req,res) => {
  const r = await pool.query(`SELECT o.*,c.nome as cliente_nome,c.telefone,v.placa,v.modelo
    FROM orcamentos o JOIN clientes c ON c.id=o.cliente_id JOIN veiculos v ON v.id=o.veiculo_id
    WHERE o.id=$1`,[req.params.id]);
  if(!r.rows.length) return res.status(404).json({erro:'Orçamento não encontrado'});
  const pecas = await pool.query(`SELECT op.*,p.nome as peca_nome,p.unidade FROM orcamento_pecas op JOIN pecas p ON p.id=op.peca_id WHERE op.orcamento_id=$1`,[req.params.id]);
  res.json({...r.rows[0],pecas:pecas.rows});
});
app.post('/api/orcamentos', auth, async (req,res) => {
  const {cliente_id,veiculo_id,mecanico,servico,servico_outro,obs,valor_mao_obra,validade,pecas} = req.body;
  if(!cliente_id||!veiculo_id||!mecanico||!servico) return res.status(400).json({erro:'Campos obrigatórios'});
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const numero = await gerarNumeroOrc(client);
    const valorPecas = pecas ? pecas.reduce((s,p)=>s+(p.qtd*(p.preco_un||0)),0) : 0;
    const valorTotal = (parseFloat(valor_mao_obra)||0)+valorPecas;
    const r = await client.query('INSERT INTO orcamentos(numero,cliente_id,veiculo_id,mecanico,servico,servico_outro,obs,valor_mao_obra,valor_pecas,valor_total,validade) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id',
        [numero,cliente_id,veiculo_id,mecanico,servico,servico_outro,obs,valor_mao_obra||0,valorPecas,valorTotal,validade||7]);
    const orcId = r.rows[0].id;
    if(pecas&&pecas.length>0){
      for(const p of pecas) await client.query('INSERT INTO orcamento_pecas(orcamento_id,peca_id,qtd,preco_un) VALUES($1,$2,$3,$4)',[orcId,p.peca_id,p.qtd,p.preco_un||0]);
    }
    await client.query('COMMIT');
    res.json({id:orcId,numero});
  } catch(e){await client.query('ROLLBACK');res.status(500).json({erro:e.message});}
  finally{client.release();}
});
app.patch('/api/orcamentos/:id/status', auth, async (req,res) => {
  const {status} = req.body;
  await pool.query('UPDATE orcamentos SET status=$1 WHERE id=$2',[status,req.params.id]);
  res.json({ok:true});
});
// Converter orçamento em OS
app.post('/api/orcamentos/:id/converter', auth, async (req,res) => {
  const orc = await pool.query(`SELECT o.*,c.nome as cliente_nome,v.placa FROM orcamentos o JOIN clientes c ON c.id=o.cliente_id JOIN veiculos v ON v.id=o.veiculo_id WHERE o.id=$1`,[req.params.id]);
  if(!orc.rows.length) return res.status(404).json({erro:'Orçamento não encontrado'});
  const o = orc.rows[0];
  const pecas = await pool.query('SELECT * FROM orcamento_pecas WHERE orcamento_id=$1',[req.params.id]);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const numero = await gerarNumeroOS(client);
    const r = await client.query(`INSERT INTO ordens_servico(numero,cliente_id,veiculo_id,mecanico,servico,servico_outro,obs,valor_mao_obra,valor_pecas,valor_total,status,prioridade)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
        [numero,o.cliente_id,o.veiculo_id,o.mecanico,o.servico,o.servico_outro,o.obs,o.valor_mao_obra,o.valor_pecas,o.valor_total,'aguardando_atendimento','media']);
    const osId = r.rows[0].id;
    for(const p of pecas.rows) await client.query('INSERT INTO os_pecas(os_id,peca_id,qtd,preco_un) VALUES($1,$2,$3,$4)',[osId,p.peca_id,p.qtd,p.preco_un]);
    await client.query('UPDATE orcamentos SET status=$1 WHERE id=$2',['aprovado',req.params.id]);
    await client.query('COMMIT');
    await log(req.user.nome,'CONVERTER','orcamentos',`ORC ${req.params.id} → OS ${numero}`);
    res.json({id:osId,numero});
  } catch(e){await client.query('ROLLBACK');res.status(500).json({erro:e.message});}
  finally{client.release();}
});

// ══════════════════════════════
// GARANTIAS (Etapa 9)
// ══════════════════════════════
app.post('/api/os/:id/garantia', auth, async (req,res) => {
  const {prazo_dias,prazo_km,descricao} = req.body;
  const r = await pool.query('INSERT INTO garantias(os_id,prazo_dias,prazo_km,descricao) VALUES($1,$2,$3,$4) RETURNING id',
      [req.params.id,prazo_dias||90,prazo_km||5000,descricao]);
  res.json({id:r.rows[0].id});
});
app.get('/api/garantias/verificar/:veiculo_id', auth, async (req,res) => {
  const r = await pool.query(`
    SELECT g.*,os.servico,os.concluido_em,os.numero,
      (os.concluido_em + (g.prazo_dias || ' days')::interval) as validade_data
    FROM garantias g JOIN ordens_servico os ON os.id=g.os_id
    WHERE os.veiculo_id=$1 AND os.concluido_em IS NOT NULL
      AND (os.concluido_em + (g.prazo_dias || ' days')::interval) > NOW()
    ORDER BY os.concluido_em DESC`,[req.params.veiculo_id]);
  res.json(r.rows);
});

// ══════════════════════════════
// RELATÓRIOS
// ══════════════════════════════
app.get('/api/relatorios/os', auth, async (req,res) => {
  const {de,ate,status} = req.query;
  let sql=`SELECT os.numero,os.criado_em,os.concluido_em,os.status,os.prioridade,
    os.servico,os.mecanico,os.valor_mao_obra,os.valor_pecas,os.valor_total,
    os.forma_pagamento,os.status_pagamento,
    c.nome as cliente,c.telefone,v.placa,v.modelo
    FROM ordens_servico os JOIN clientes c ON c.id=os.cliente_id JOIN veiculos v ON v.id=os.veiculo_id WHERE 1=1`;
  const p=[]; let i=1;
  if(de){sql+=` AND os.criado_em::date>=$${i++}`;p.push(de);}
  if(ate){sql+=` AND os.criado_em::date<=$${i++}`;p.push(ate);}
  if(status&&status!=='todos'){sql+=` AND os.status=$${i++}`;p.push(status);}
  sql+=' ORDER BY os.id DESC';
  res.json((await pool.query(sql,p)).rows);
});
app.get('/api/relatorios/servicos', auth, async (req,res) => {
  const r = await pool.query(`SELECT servico,COUNT(*)::int as total,SUM(valor_mao_obra)::numeric as faturamento,
    COUNT(CASE WHEN status IN ('finalizado','entregue') THEN 1 END)::int as concluidos FROM ordens_servico GROUP BY servico ORDER BY total DESC`);
  res.json(r.rows);
});
app.get('/api/relatorios/mecanicos', auth, async (req,res) => {
  const r = await pool.query(`SELECT mecanico,COUNT(*)::int as total_os,
    COUNT(CASE WHEN status IN ('finalizado','entregue') THEN 1 END)::int as concluidas,
    COALESCE(SUM(CASE WHEN status IN ('finalizado','entregue') THEN valor_mao_obra ELSE 0 END),0)::numeric as faturamento
    FROM ordens_servico GROUP BY mecanico ORDER BY total_os DESC`);
  res.json(r.rows);
});
app.get('/api/relatorios/financeiro', auth, async (req,res) => {
  const {de,ate} = req.query;
  let sql=`SELECT forma_pagamento,status_pagamento,SUM(valor_total)::numeric as total,COUNT(*)::int as qtd
    FROM ordens_servico WHERE status IN ('finalizado','entregue')`;
  const p=[]; let i=1;
  if(de){sql+=` AND criado_em::date>=$${i++}`;p.push(de);}
  if(ate){sql+=` AND criado_em::date<=$${i++}`;p.push(ate);}
  sql+=' GROUP BY forma_pagamento,status_pagamento';
  const r = await pool.query(sql,p);
  const fat = await pool.query(`SELECT COALESCE(SUM(valor_total),0)::numeric as total,COALESCE(SUM(valor_pecas),0)::numeric as pecas,COALESCE(SUM(valor_mao_obra),0)::numeric as mao_obra FROM ordens_servico WHERE status IN ('finalizado','entregue')`);
  res.json({por_pagamento:r.rows,...fat.rows[0]});
});

// ══════════════════════════════
// DASHBOARD
// ══════════════════════════════
app.get('/api/dashboard', auth, async (req,res) => {
  const [a,ag,fi,cl,ve,pc,eb,urg,fat,or] = await Promise.all([
    pool.query("SELECT COUNT(*)::int as n FROM ordens_servico WHERE status NOT IN ('finalizado','entregue','cancelado')"),
    pool.query("SELECT COUNT(*)::int as n FROM ordens_servico WHERE status='aguardando_peca'"),
    pool.query("SELECT COUNT(*)::int as n FROM ordens_servico WHERE status IN ('finalizado','entregue') AND criado_em::date=CURRENT_DATE"),
    pool.query("SELECT COUNT(*)::int as n FROM clientes"),
    pool.query("SELECT COUNT(*)::int as n FROM veiculos"),
    pool.query("SELECT COUNT(*)::int as n FROM pecas WHERE qtd<=qtd_minima"),
    pool.query("SELECT COUNT(*)::int as n FROM elevadores WHERE status='bloqueado'"),
    pool.query("SELECT COUNT(*)::int as n FROM ordens_servico WHERE prioridade='urgente' AND status NOT IN ('finalizado','entregue','cancelado')"),
    pool.query("SELECT COALESCE(SUM(valor_total),0)::numeric as total FROM ordens_servico WHERE status IN ('finalizado','entregue') AND criado_em::date=CURRENT_DATE"),
    pool.query(`SELECT os.numero,os.status,os.prioridade,os.criado_em,c.nome as cliente,v.placa
      FROM ordens_servico os JOIN clientes c ON c.id=os.cliente_id JOIN veiculos v ON v.id=os.veiculo_id
      ORDER BY CASE os.prioridade WHEN 'urgente' THEN 1 WHEN 'alta' THEN 2 WHEN 'media' THEN 3 ELSE 4 END, os.id DESC LIMIT 8`),
  ]);
  res.json({os_andamento:a.rows[0].n,os_aguardando:ag.rows[0].n,os_finalizadas:fi.rows[0].n,
    total_clientes:cl.rows[0].n,total_veiculos:ve.rows[0].n,pecas_criticas:pc.rows[0].n,
    elev_bloqueados:eb.rows[0].n,os_urgentes:urg.rows[0].n,
    faturamento_hoje:fat.rows[0].total,os_recentes:or.rows});
});

// ══════════════════════════════
// AUDITORIA
// ══════════════════════════════
app.get('/api/auditoria', auth, async (req,res) => {
  const r = await pool.query('SELECT * FROM auditoria ORDER BY id DESC LIMIT 200');
  res.json(r.rows);
});

// CATCH-ALL
app.get('*', (req,res) => {
  res.sendFile(path.join(__dirname,'../public/index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🔧 Paulinho Auto-Center — porta ${PORT}`));
module.exports = app;