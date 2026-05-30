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

// ── Auth ──
function auth(req, res, next) {
  const h = req.headers['authorization'];
  if (!h) return res.status(401).json({ erro: 'Não autorizado' });
  try { req.user = jwt.verify(h.split(' ')[1], JWT_SECRET); next(); }
  catch { res.status(401).json({ erro: 'Token inválido' }); }
}

async function log(usuario, acao, tabela, detalhe) {
  try { await pool.query('INSERT INTO auditoria(usuario,acao,tabela,detalhe) VALUES($1,$2,$3,$4)', [usuario,acao,tabela,detalhe]); } catch{}
}

// ══ LOGIN ══
app.post('/api/login', async (req,res) => {
  try {
    const {usuario,senha} = req.body;
    const r = await pool.query('SELECT * FROM usuarios WHERE usuario=$1 AND senha=$2',[usuario,senha]);
    if (!r.rows.length) return res.status(401).json({erro:'Usuário ou senha inválidos'});
    const u = r.rows[0];
    const token = jwt.sign({id:u.id,nome:u.nome,perfil:u.perfil}, JWT_SECRET, {expiresIn:'12h'});
    await log(u.nome,'LOGIN','usuarios',`Perfil: ${u.perfil}`);
    res.json({token, nome:u.nome, perfil:u.perfil});
  } catch(e){res.status(500).json({erro:e.message});}
});

// ══ USUÁRIOS ══
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

// ══ CLIENTES ══
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
  res.json({...c.rows[0], veiculos:v.rows, historico_os:o.rows});
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

// ══ VEÍCULOS ══
app.get('/api/veiculos', auth, async (req,res) => {
  const q = req.query.q ? `%${req.query.q}%` : '%';
  const r = await pool.query(`
    SELECT v.*, c.nome as cliente_nome, c.telefone as cliente_tel
    FROM veiculos v JOIN clientes c ON c.id=v.cliente_id
    WHERE v.placa ILIKE $1 OR v.modelo ILIKE $1 OR c.nome ILIKE $1
    ORDER BY v.placa`,[q]);
  res.json(r.rows);
});
app.post('/api/veiculos', auth, async (req,res) => {
  const {cliente_id,placa,modelo,marca,ano,cor,km_atual} = req.body;
  if(!cliente_id||!placa||!modelo) return res.status(400).json({erro:'Cliente, placa e modelo obrigatórios'});
  try {
    const r = await pool.query('INSERT INTO veiculos(cliente_id,placa,modelo,marca,ano,cor,km_atual) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id',[cliente_id,placa.toUpperCase(),modelo,marca,ano,cor,km_atual||0]);
    res.json({id:r.rows[0].id});
  } catch{res.status(400).json({erro:'Placa já cadastrada'});}
});
app.put('/api/veiculos/:id', auth, async (req,res) => {
  const {placa,modelo,marca,ano,cor,km_atual} = req.body;
  await pool.query('UPDATE veiculos SET placa=$1,modelo=$2,marca=$3,ano=$4,cor=$5,km_atual=$6 WHERE id=$7',[placa.toUpperCase(),modelo,marca,ano,cor,km_atual,req.params.id]);
  res.json({ok:true});
});
app.delete('/api/veiculos/:id', auth, async (req,res) => {
  await pool.query('DELETE FROM veiculos WHERE id=$1',[req.params.id]);
  res.json({ok:true});
});

// ══ PEÇAS ══
app.get('/api/pecas', auth, async (req,res) => {
  const r = await pool.query('SELECT * FROM pecas ORDER BY nome');
  res.json(r.rows);
});
app.post('/api/pecas', auth, async (req,res) => {
  const {nome,categoria,unidade,qtd,qtd_minima,fornecedor,preco_custo} = req.body;
  if(!nome) return res.status(400).json({erro:'Nome obrigatório'});
  const r = await pool.query('INSERT INTO pecas(nome,categoria,unidade,qtd,qtd_minima,fornecedor,preco_custo) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id',[nome,categoria||'Outros',unidade||'unid.',qtd||0,qtd_minima||1,fornecedor,preco_custo||0]);
  res.json({id:r.rows[0].id});
});
app.put('/api/pecas/:id', auth, async (req,res) => {
  const {nome,categoria,unidade,qtd,qtd_minima,fornecedor,preco_custo} = req.body;
  await pool.query('UPDATE pecas SET nome=$1,categoria=$2,unidade=$3,qtd=$4,qtd_minima=$5,fornecedor=$6,preco_custo=$7 WHERE id=$8',[nome,categoria,unidade,qtd,qtd_minima,fornecedor,preco_custo,req.params.id]);
  res.json({ok:true});
});
app.patch('/api/pecas/:id/ajustar', auth, async (req,res) => {
  const {delta} = req.body;
  const r = await pool.query('UPDATE pecas SET qtd=GREATEST(0,qtd+$1) WHERE id=$2 RETURNING qtd',[delta,req.params.id]);
  res.json({ok:true, qtd:r.rows[0].qtd});
});
app.delete('/api/pecas/:id', auth, async (req,res) => {
  await pool.query('DELETE FROM pecas WHERE id=$1',[req.params.id]);
  res.json({ok:true});
});

// ══ ELEVADORES ══
app.get('/api/elevadores', auth, async (req,res) => {
  const r = await pool.query(`
    SELECT e.*,
      os.numero as os_numero, os.servico as os_servico, os.mecanico as os_mecanico, os.status as os_status,
      c.nome as cliente_nome, v.placa as veiculo_placa,
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
app.patch('/api/elevadores/:id/liberar', auth, async (req,res) => {
  await pool.query("UPDATE elevadores SET status='livre',os_id=NULL,ocupado_em=NULL WHERE id=$1",[req.params.id]);
  res.json({ok:true});
});
app.delete('/api/elevadores/:id', auth, async (req,res) => {
  await pool.query('DELETE FROM elevadores WHERE id=$1',[req.params.id]);
  res.json({ok:true});
});

// ══ ORDENS DE SERVIÇO ══
async function gerarNumero(client) {
  const hoje = new Date().toISOString().slice(0,10).replace(/-/g,'');
  const r = await client.query("SELECT COUNT(*) as n FROM ordens_servico WHERE numero LIKE $1",[`OS-${hoje}%`]);
  return `OS-${hoje}-${(parseInt(r.rows[0].n)+1).toString().padStart(3,'0')}`;
}

app.get('/api/os', auth, async (req,res) => {
  const {status,busca} = req.query;
  let sql = `
    SELECT os.*, c.nome as cliente_nome, c.telefone as cliente_tel,
      v.placa, v.modelo, e.nome as elevador_nome
    FROM ordens_servico os
    JOIN clientes c ON c.id=os.cliente_id
    JOIN veiculos v ON v.id=os.veiculo_id
    LEFT JOIN elevadores e ON e.id=os.elevador_id
    WHERE 1=1`;
  const p=[]; let i=1;
  if(status&&status!=='todos'){sql+=` AND os.status=$${i++}`;p.push(status);}
  if(busca){sql+=` AND (c.nome ILIKE $${i} OR v.placa ILIKE $${i} OR os.numero ILIKE $${i})`;p.push(`%${busca}%`);i++;}
  sql+=' ORDER BY os.id DESC';
  const r = await pool.query(sql,p);
  res.json(r.rows);
});

app.get('/api/os/:id', auth, async (req,res) => {
  const r = await pool.query(`
    SELECT os.*, c.nome as cliente_nome, c.telefone as cliente_tel,
      v.placa, v.modelo, e.nome as elevador_nome
    FROM ordens_servico os
    JOIN clientes c ON c.id=os.cliente_id
    JOIN veiculos v ON v.id=os.veiculo_id
    LEFT JOIN elevadores e ON e.id=os.elevador_id
    WHERE os.id=$1`,[req.params.id]);
  if(!r.rows.length) return res.status(404).json({erro:'OS não encontrada'});
  res.json(r.rows[0]);
});

app.post('/api/os', auth, async (req,res) => {
  const {cliente_id,veiculo_id,elevador_id,mecanico,servico,obs,km_entrada,valor_total} = req.body;
  if(!cliente_id||!veiculo_id||!mecanico||!servico) return res.status(400).json({erro:'Campos obrigatórios'});
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if(elevador_id){
      const e = await client.query('SELECT * FROM elevadores WHERE id=$1',[elevador_id]);
      if(e.rows[0]?.status==='ocupado') throw new Error(`${e.rows[0].nome} já está ocupado`);
    }
    const numero = await gerarNumero(client);
    const r = await client.query('INSERT INTO ordens_servico(numero,cliente_id,veiculo_id,elevador_id,mecanico,servico,obs,km_entrada,valor_total) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id',
        [numero,cliente_id,veiculo_id,elevador_id||null,mecanico,servico,obs,km_entrada||0,valor_total||0]);
    if(elevador_id) await client.query("UPDATE elevadores SET status='ocupado',os_id=$1,ocupado_em=NOW() WHERE id=$2",[r.rows[0].id,elevador_id]);
    await client.query('COMMIT');
    await log(req.user.nome,'CRIAR','ordens_servico',`OS: ${numero}`);
    res.json({id:r.rows[0].id, numero});
  } catch(e){await client.query('ROLLBACK');res.status(500).json({erro:e.message});}
  finally{client.release();}
});

app.put('/api/os/:id', auth, async (req,res) => {
  const {mecanico,servico,obs,status,elevador_id,km_entrada,valor_total} = req.body;
  await pool.query('UPDATE ordens_servico SET mecanico=$1,servico=$2,obs=$3,status=$4,elevador_id=$5,km_entrada=$6,valor_total=$7 WHERE id=$8',
      [mecanico,servico,obs,status,elevador_id,km_entrada,valor_total,req.params.id]);
  res.json({ok:true});
});

app.patch('/api/os/:id/status', auth, async (req,res) => {
  const {status} = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const os = await client.query('SELECT * FROM ordens_servico WHERE id=$1',[req.params.id]);
    if(!os.rows.length) return res.status(404).json({erro:'OS não encontrada'});
    const o = os.rows[0];
    const concluido_em = (status==='finalizado'||status==='entregue') ? new Date() : null;
    await client.query('UPDATE ordens_servico SET status=$1,concluido_em=$2 WHERE id=$3',[status,concluido_em,req.params.id]);
    if((status==='finalizado'||status==='entregue'||status==='cancelado')&&o.elevador_id)
      await client.query("UPDATE elevadores SET status='livre',os_id=NULL,ocupado_em=NULL WHERE id=$1",[o.elevador_id]);
    if(status==='aguardando_peca'&&o.elevador_id)
      await client.query("UPDATE elevadores SET status='bloqueado' WHERE id=$1",[o.elevador_id]);
    await client.query('COMMIT');
    await log(req.user.nome,'STATUS','ordens_servico',`OS ${req.params.id} → ${status}`);
    res.json({ok:true});
  } catch(e){await client.query('ROLLBACK');res.status(500).json({erro:e.message});}
  finally{client.release();}
});

// ══ RELATÓRIOS ══
app.get('/api/relatorios/os', auth, async (req,res) => {
  const {de,ate,status} = req.query;
  let sql=`SELECT os.numero,os.criado_em,os.status,os.servico,os.mecanico,os.valor_total,c.nome as cliente,c.telefone,v.placa,v.modelo
    FROM ordens_servico os JOIN clientes c ON c.id=os.cliente_id JOIN veiculos v ON v.id=os.veiculo_id WHERE 1=1`;
  const p=[]; let i=1;
  if(de){sql+=` AND os.criado_em::date>=$${i++}`;p.push(de);}
  if(ate){sql+=` AND os.criado_em::date<=$${i++}`;p.push(ate);}
  if(status&&status!=='todos'){sql+=` AND os.status=$${i++}`;p.push(status);}
  sql+=' ORDER BY os.id DESC';
  const r = await pool.query(sql,p);
  res.json(r.rows);
});
app.get('/api/relatorios/servicos', auth, async (req,res) => {
  const r = await pool.query(`SELECT servico, COUNT(*)::int as total, SUM(valor_total)::numeric as faturamento FROM ordens_servico GROUP BY servico ORDER BY total DESC`);
  res.json(r.rows);
});
app.get('/api/relatorios/mecanicos', auth, async (req,res) => {
  const r = await pool.query(`SELECT mecanico, COUNT(*)::int as total_os, COUNT(CASE WHEN status IN ('finalizado','entregue') THEN 1 END)::int as concluidas, COALESCE(SUM(CASE WHEN status IN ('finalizado','entregue') THEN valor_total ELSE 0 END),0)::numeric as faturamento FROM ordens_servico GROUP BY mecanico ORDER BY total_os DESC`);
  res.json(r.rows);
});

// ══ DASHBOARD ══
app.get('/api/dashboard', auth, async (req,res) => {
  const [a,ag,fi,cl,ve,pc,eb,or] = await Promise.all([
    pool.query("SELECT COUNT(*)::int as n FROM ordens_servico WHERE status NOT IN ('finalizado','entregue','cancelado')"),
    pool.query("SELECT COUNT(*)::int as n FROM ordens_servico WHERE status='aguardando_peca'"),
    pool.query("SELECT COUNT(*)::int as n FROM ordens_servico WHERE status IN ('finalizado','entregue') AND criado_em::date=CURRENT_DATE"),
    pool.query("SELECT COUNT(*)::int as n FROM clientes"),
    pool.query("SELECT COUNT(*)::int as n FROM veiculos"),
    pool.query("SELECT COUNT(*)::int as n FROM pecas WHERE qtd<=qtd_minima"),
    pool.query("SELECT COUNT(*)::int as n FROM elevadores WHERE status='bloqueado'"),
    pool.query(`SELECT os.numero,os.status,os.criado_em,c.nome as cliente,v.placa FROM ordens_servico os JOIN clientes c ON c.id=os.cliente_id JOIN veiculos v ON v.id=os.veiculo_id ORDER BY os.id DESC LIMIT 8`),
  ]);
  res.json({os_andamento:a.rows[0].n,os_aguardando:ag.rows[0].n,os_finalizadas:fi.rows[0].n,total_clientes:cl.rows[0].n,total_veiculos:ve.rows[0].n,pecas_criticas:pc.rows[0].n,elev_bloqueados:eb.rows[0].n,os_recentes:or.rows});
});

// ══ AUDITORIA ══
app.get('/api/auditoria', auth, async (req,res) => {
  const r = await pool.query('SELECT * FROM auditoria ORDER BY id DESC LIMIT 100');
  res.json(r.rows);
});

// ══ CATCH-ALL: serve index.html para qualquer rota não-API ══
app.get('*', (req,res) => {
  res.sendFile(path.join(__dirname,'../public/index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Rodando na porta ${PORT}`));
module.exports = app;