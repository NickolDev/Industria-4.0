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
  connectionString: 'postgresql://postgres.wxeqyotnhfsacagyqefp:zMl5hsZEvpr7bfi9@aws-1-sa-east-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

function auth(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ erro: 'Token não fornecido' });
  try { req.user = jwt.verify(token, JWT_SECRET); next(); }
  catch { res.status(401).json({ erro: 'Token inválido' }); }
}

async function log(usuario, acao, tabela, detalhe) {
  try { await pool.query('INSERT INTO auditoria (usuario,acao,tabela,detalhe) VALUES ($1,$2,$3,$4)', [usuario, acao, tabela, detalhe]); } catch {}
}

// ══════════════════ AUTH ══════════════════
app.post('/api/login', async (req, res) => {
  const { usuario, senha } = req.body;
  try {
    const r = await pool.query('SELECT * FROM usuarios WHERE usuario=$1 AND senha=$2', [usuario, senha]);
    if (!r.rows.length) return res.status(401).json({ erro: 'Usuário ou senha inválidos' });
    const u = r.rows[0];
    const token = jwt.sign({ id: u.id, nome: u.nome, perfil: u.perfil }, JWT_SECRET, { expiresIn: '12h' });
    await log(u.nome, 'LOGIN', 'usuarios', `Login — perfil: ${u.perfil}`);
    res.json({ token, nome: u.nome, perfil: u.perfil });
  } catch(e) { res.status(500).json({ erro: e.message }); }
});

// ══════════════════ USUÁRIOS ══════════════════
app.get('/api/usuarios', auth, async (req, res) => {
  const r = await pool.query('SELECT id,nome,usuario,perfil,criado_em FROM usuarios ORDER BY nome');
  res.json(r.rows);
});
app.post('/api/usuarios', auth, async (req, res) => {
  const { nome, usuario, senha, perfil } = req.body;
  if (!nome||!usuario||!senha) return res.status(400).json({ erro: 'Campos obrigatórios' });
  try {
    const r = await pool.query('INSERT INTO usuarios (nome,usuario,senha,perfil) VALUES ($1,$2,$3,$4) RETURNING id', [nome,usuario,senha,perfil||'atendente']);
    await log(req.user.nome,'CRIAR','usuarios',`Criado: ${usuario}`);
    res.json({ id: r.rows[0].id });
  } catch { res.status(400).json({ erro: 'Usuário já existe' }); }
});
app.put('/api/usuarios/:id', auth, async (req, res) => {
  const { nome, usuario, senha, perfil } = req.body;
  if (senha) await pool.query('UPDATE usuarios SET nome=$1,usuario=$2,senha=$3,perfil=$4 WHERE id=$5', [nome,usuario,senha,perfil,req.params.id]);
  else await pool.query('UPDATE usuarios SET nome=$1,usuario=$2,perfil=$3 WHERE id=$4', [nome,usuario,perfil,req.params.id]);
  res.json({ ok: true });
});
app.delete('/api/usuarios/:id', auth, async (req, res) => {
  if (parseInt(req.params.id)===req.user.id) return res.status(400).json({ erro: 'Não pode excluir a si mesmo' });
  await pool.query('DELETE FROM usuarios WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
});

// ══════════════════ CLIENTES ══════════════════
app.get('/api/clientes', auth, async (req, res) => {
  const q = req.query.q ? `%${req.query.q}%` : '%';
  const r = await pool.query(`
    SELECT c.*, COUNT(DISTINCT v.id)::int as total_veiculos, COUNT(DISTINCT os.id)::int as total_os,
      COALESCE(SUM(os.valor_total),0)::numeric as valor_total_gasto
    FROM clientes c
    LEFT JOIN veiculos v ON v.cliente_id=c.id
    LEFT JOIN ordens_servico os ON os.cliente_id=c.id AND os.status='entregue'
    WHERE c.nome ILIKE $1 OR c.telefone ILIKE $1 OR c.cpf ILIKE $1
    GROUP BY c.id ORDER BY c.nome`, [q]);
  res.json(r.rows);
});
app.get('/api/clientes/:id', auth, async (req, res) => {
  const cli = await pool.query('SELECT * FROM clientes WHERE id=$1', [req.params.id]);
  if (!cli.rows.length) return res.status(404).json({ erro: 'Não encontrado' });
  const veics = await pool.query('SELECT * FROM veiculos WHERE cliente_id=$1 ORDER BY placa', [req.params.id]);
  const os = await pool.query(`
    SELECT os.*, v.placa, v.modelo FROM ordens_servico os
    JOIN veiculos v ON v.id=os.veiculo_id
    WHERE os.cliente_id=$1 ORDER BY os.id DESC LIMIT 20`, [req.params.id]);
  res.json({ ...cli.rows[0], veiculos: veics.rows, historico_os: os.rows });
});
app.post('/api/clientes', auth, async (req, res) => {
  const { nome, telefone, email, cpf, endereco } = req.body;
  if (!nome) return res.status(400).json({ erro: 'Nome obrigatório' });
  const r = await pool.query('INSERT INTO clientes (nome,telefone,email,cpf,endereco) VALUES ($1,$2,$3,$4,$5) RETURNING id', [nome,telefone,email,cpf,endereco]);
  await log(req.user.nome,'CRIAR','clientes',`Cliente: ${nome}`);
  res.json({ id: r.rows[0].id });
});
app.put('/api/clientes/:id', auth, async (req, res) => {
  const { nome, telefone, email, cpf, endereco } = req.body;
  await pool.query('UPDATE clientes SET nome=$1,telefone=$2,email=$3,cpf=$4,endereco=$5 WHERE id=$6', [nome,telefone,email,cpf,endereco,req.params.id]);
  res.json({ ok: true });
});
app.delete('/api/clientes/:id', auth, async (req, res) => {
  await pool.query('DELETE FROM clientes WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
});

// ══════════════════ VEÍCULOS ══════════════════
app.get('/api/veiculos', auth, async (req, res) => {
  const q = req.query.q ? `%${req.query.q}%` : '%';
  const r = await pool.query(`
    SELECT v.*, c.nome as cliente_nome, c.telefone as cliente_tel
    FROM veiculos v JOIN clientes c ON c.id=v.cliente_id
    WHERE v.placa ILIKE $1 OR v.modelo ILIKE $1 OR c.nome ILIKE $1 ORDER BY v.placa`, [q]);
  res.json(r.rows);
});
app.get('/api/veiculos/:id/historico', auth, async (req, res) => {
  const os = await pool.query(`
    SELECT os.*, c.nome as cliente_nome,
      COALESCE(json_agg(json_build_object('nome',p.nome,'qtd',op.qtd,'preco',op.preco_un)) FILTER (WHERE p.id IS NOT NULL), '[]') as pecas_usadas
    FROM ordens_servico os
    JOIN clientes c ON c.id=os.cliente_id
    LEFT JOIN os_pecas op ON op.os_id=os.id
    LEFT JOIN pecas p ON p.id=op.peca_id
    WHERE os.veiculo_id=$1 GROUP BY os.id, c.nome ORDER BY os.id DESC`, [req.params.id]);
  res.json(os.rows);
});
app.post('/api/veiculos', auth, async (req, res) => {
  const { cliente_id, placa, modelo, marca, ano, cor, km_atual, combustivel, chassi, obs } = req.body;
  if (!cliente_id||!placa||!modelo) return res.status(400).json({ erro: 'Cliente, placa e modelo obrigatórios' });
  try {
    const r = await pool.query(
        'INSERT INTO veiculos (cliente_id,placa,modelo,marca,ano,cor,km_atual,combustivel,chassi,obs) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id',
        [cliente_id,placa.toUpperCase(),modelo,marca,ano,cor,km_atual||0,combustivel,chassi,obs]);
    res.json({ id: r.rows[0].id });
  } catch { res.status(400).json({ erro: 'Placa já cadastrada' }); }
});
app.put('/api/veiculos/:id', auth, async (req, res) => {
  const { placa, modelo, marca, ano, cor, km_atual, combustivel, chassi, obs } = req.body;
  await pool.query('UPDATE veiculos SET placa=$1,modelo=$2,marca=$3,ano=$4,cor=$5,km_atual=$6,combustivel=$7,chassi=$8,obs=$9 WHERE id=$10',
      [placa.toUpperCase(),modelo,marca,ano,cor,km_atual,combustivel,chassi,obs,req.params.id]);
  res.json({ ok: true });
});
app.delete('/api/veiculos/:id', auth, async (req, res) => {
  await pool.query('DELETE FROM veiculos WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
});

// ══════════════════ PEÇAS ══════════════════
app.get('/api/pecas', auth, async (req, res) => {
  const r = await pool.query('SELECT * FROM pecas ORDER BY nome');
  res.json(r.rows);
});
app.post('/api/pecas', auth, async (req, res) => {
  const { nome, categoria, unidade, qtd, qtd_minima, fornecedor, preco_custo, preco_venda } = req.body;
  if (!nome) return res.status(400).json({ erro: 'Nome obrigatório' });
  const r = await pool.query(
      'INSERT INTO pecas (nome,categoria,unidade,qtd,qtd_minima,fornecedor,preco_custo,preco_venda) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id',
      [nome,categoria||'Outros',unidade||'unid.',qtd||0,qtd_minima||1,fornecedor,preco_custo||0,preco_venda||0]);
  res.json({ id: r.rows[0].id });
});
app.put('/api/pecas/:id', auth, async (req, res) => {
  const { nome, categoria, unidade, qtd, qtd_minima, fornecedor, preco_custo, preco_venda } = req.body;
  await pool.query('UPDATE pecas SET nome=$1,categoria=$2,unidade=$3,qtd=$4,qtd_minima=$5,fornecedor=$6,preco_custo=$7,preco_venda=$8 WHERE id=$9',
      [nome,categoria,unidade,qtd,qtd_minima,fornecedor,preco_custo,preco_venda,req.params.id]);
  res.json({ ok: true });
});
app.patch('/api/pecas/:id/ajustar', auth, async (req, res) => {
  const { delta, os_id, obs } = req.body;
  const r = await pool.query('UPDATE pecas SET qtd=GREATEST(0,qtd+$1) WHERE id=$2 RETURNING qtd', [delta, req.params.id]);
  const peca = await pool.query('SELECT nome FROM pecas WHERE id=$1', [req.params.id]);
  await pool.query('INSERT INTO estoque_movimentacao (peca_id,tipo,qtd,os_id,usuario,obs) VALUES ($1,$2,$3,$4,$5,$6)',
      [req.params.id, delta>0?'entrada':'saida_manual', Math.abs(delta), os_id||null, req.user?.nome||'sistema', obs||'Ajuste manual']);
  res.json({ ok: true, qtd: r.rows[0].qtd });
});
app.delete('/api/pecas/:id', auth, async (req, res) => {
  await pool.query('DELETE FROM pecas WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
});
app.get('/api/pecas/movimentacao', auth, async (req, res) => {
  const r = await pool.query(`
    SELECT em.*, p.nome as peca_nome FROM estoque_movimentacao em
    JOIN pecas p ON p.id=em.peca_id ORDER BY em.id DESC LIMIT 100`);
  res.json(r.rows);
});

// ══════════════════ ELEVADORES ══════════════════
app.get('/api/elevadores', auth, async (req, res) => {
  const r = await pool.query(`
    SELECT e.*,
      os.numero as os_numero, os.servico as os_servico, os.mecanico as os_mecanico,
      os.status as os_status, os.prioridade as os_prioridade,
      c.nome as cliente_nome, v.placa as veiculo_placa,
      EXTRACT(EPOCH FROM (NOW()-e.ocupado_em))/60 as minutos_ocupado
    FROM elevadores e
    LEFT JOIN ordens_servico os ON os.id=e.os_id AND os.status NOT IN ('entregue','cancelado')
    LEFT JOIN veiculos v ON v.id=os.veiculo_id
    LEFT JOIN clientes c ON c.id=os.cliente_id
    ORDER BY e.id`);
  res.json(r.rows);
});
app.post('/api/elevadores', auth, async (req, res) => {
  const { nome, tipo } = req.body;
  const r = await pool.query('INSERT INTO elevadores (nome,tipo) VALUES ($1,$2) RETURNING id', [nome,tipo||'hidraulico']);
  res.json({ id: r.rows[0].id });
});
app.patch('/api/elevadores/:id/liberar', auth, async (req, res) => {
  await pool.query("UPDATE elevadores SET status='livre',os_id=NULL,ocupado_em=NULL WHERE id=$1", [req.params.id]);
  await log(req.user.nome,'LIBERAR','elevadores',`Elevador ${req.params.id} liberado`);
  res.json({ ok: true });
});
app.delete('/api/elevadores/:id', auth, async (req, res) => {
  await pool.query('DELETE FROM elevadores WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
});

// ══════════════════ ORDENS DE SERVIÇO ══════════════════
async function gerarNumero(client) {
  const hoje = new Date().toISOString().slice(0,10).replace(/-/g,'');
  const r = await client.query("SELECT COUNT(*) as n FROM ordens_servico WHERE numero LIKE $1", [`OS-${hoje}%`]);
  const seq = (parseInt(r.rows[0].n)+1).toString().padStart(3,'0');
  return `OS-${hoje}-${seq}`;
}

app.get('/api/os', auth, async (req, res) => {
  const { status, busca, prioridade } = req.query;
  let sql = `
    SELECT os.*, c.nome as cliente_nome, c.telefone as cliente_tel,
      v.placa, v.modelo, v.marca, e.nome as elevador_nome
    FROM ordens_servico os
    JOIN clientes c ON c.id=os.cliente_id
    JOIN veiculos v ON v.id=os.veiculo_id
    LEFT JOIN elevadores e ON e.id=os.elevador_id
    WHERE 1=1`;
  const params = []; let i = 1;
  if (status && status!=='todos') { sql+=` AND os.status=$${i++}`; params.push(status); }
  if (prioridade && prioridade!=='todos') { sql+=` AND os.prioridade=$${i++}`; params.push(prioridade); }
  if (busca) { sql+=` AND (c.nome ILIKE $${i} OR v.placa ILIKE $${i} OR os.numero ILIKE $${i})`; params.push(`%${busca}%`); i++; }
  sql += ` ORDER BY CASE os.prioridade WHEN 'urgente' THEN 1 WHEN 'alta' THEN 2 WHEN 'media' THEN 3 WHEN 'baixa' THEN 4 ELSE 5 END, os.id DESC`;
  const r = await pool.query(sql, params);
  res.json(r.rows);
});

app.get('/api/os/:id', auth, async (req, res) => {
  const r = await pool.query(`
    SELECT os.*, c.nome as cliente_nome, c.telefone as cliente_tel,
      v.placa, v.modelo, e.nome as elevador_nome
    FROM ordens_servico os
    JOIN clientes c ON c.id=os.cliente_id
    JOIN veiculos v ON v.id=os.veiculo_id
    LEFT JOIN elevadores e ON e.id=os.elevador_id
    WHERE os.id=$1`, [req.params.id]);
  if (!r.rows.length) return res.status(404).json({ erro: 'OS não encontrada' });
  const os = r.rows[0];
  const pecas = await pool.query(`
    SELECT op.*, p.nome as peca_nome, p.unidade, p.qtd as estoque_atual
    FROM os_pecas op JOIN pecas p ON p.id=op.peca_id
    WHERE op.os_id=$1`, [req.params.id]);
  os.pecas = pecas.rows;
  res.json(os);
});

app.post('/api/os', auth, async (req, res) => {
  const { cliente_id, veiculo_id, elevador_id, mecanico, servico, servico_outro,
    obs, km_entrada, valor_total, valor_mao_obra, prioridade, previsao_entrega, pecas } = req.body;
  if (!cliente_id||!veiculo_id||!mecanico||!servico)
    return res.status(400).json({ erro: 'Cliente, veículo, mecânico e serviço obrigatórios' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (elevador_id) {
      const elev = await client.query('SELECT * FROM elevadores WHERE id=$1', [elevador_id]);
      if (elev.rows[0]?.status==='ocupado') throw new Error(`${elev.rows[0].nome} já está ocupado`);
      if (elev.rows[0]?.status==='manutencao') throw new Error(`${elev.rows[0].nome} está em manutenção`);
    }

    // Valida estoque das peças antes de criar
    if (pecas && pecas.length > 0) {
      for (const p of pecas) {
        const estoque = await client.query('SELECT qtd, nome FROM pecas WHERE id=$1', [p.peca_id]);
        if (!estoque.rows.length) throw new Error('Peça não encontrada');
        if (estoque.rows[0].qtd < p.qtd) throw new Error(`Estoque insuficiente: ${estoque.rows[0].nome} (disponível: ${estoque.rows[0].qtd})`);
      }
    }

    const numero = await gerarNumero(client);
    const valorPecas = pecas ? pecas.reduce((s,p)=>s+(p.qtd*(p.preco_un||0)),0) : 0;
    const valorTotal = (parseFloat(valor_mao_obra)||0) + valorPecas;

    const r = await client.query(`
      INSERT INTO ordens_servico
        (numero,cliente_id,veiculo_id,elevador_id,mecanico,servico,servico_outro,obs,km_entrada,
         valor_total,valor_mao_obra,valor_pecas,prioridade,previsao_entrega)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING id`,
        [numero,cliente_id,veiculo_id,elevador_id||null,mecanico,servico,servico_outro||null,
          obs,km_entrada||0,valorTotal,valor_mao_obra||0,valorPecas,prioridade||'media',previsao_entrega||null]);
    const osId = r.rows[0].id;

    if (elevador_id)
      await client.query("UPDATE elevadores SET status='ocupado',os_id=$1,ocupado_em=NOW() WHERE id=$2", [osId,elevador_id]);

    // Insere peças e baixa estoque
    if (pecas && pecas.length > 0) {
      for (const p of pecas) {
        await client.query('INSERT INTO os_pecas (os_id,peca_id,qtd,preco_un) VALUES ($1,$2,$3,$4)', [osId,p.peca_id,p.qtd,p.preco_un||0]);
        await client.query('UPDATE pecas SET qtd=qtd-$1 WHERE id=$2', [p.qtd,p.peca_id]);
        await client.query('INSERT INTO estoque_movimentacao (peca_id,tipo,qtd,os_id,usuario,obs) VALUES ($1,$2,$3,$4,$5,$6)',
            [p.peca_id,'saida_os',p.qtd,osId,req.user.nome,`OS ${numero}`]);
      }
    }

    await client.query('COMMIT');
    await log(req.user.nome,'CRIAR','ordens_servico',`OS criada: ${numero} | Prioridade: ${prioridade||'media'}`);
    res.json({ id: osId, numero });
  } catch(e) {
    await client.query('ROLLBACK');
    res.status(500).json({ erro: e.message });
  } finally { client.release(); }
});

app.put('/api/os/:id', auth, async (req, res) => {
  const { mecanico, servico, servico_outro, obs, status, elevador_id,
    km_entrada, valor_mao_obra, valor_pecas, prioridade, previsao_entrega } = req.body;
  const valorTotal = (parseFloat(valor_mao_obra)||0) + (parseFloat(valor_pecas)||0);
  await pool.query(`UPDATE ordens_servico SET mecanico=$1,servico=$2,servico_outro=$3,obs=$4,status=$5,
    elevador_id=$6,km_entrada=$7,valor_mao_obra=$8,valor_pecas=$9,valor_total=$10,
    prioridade=$11,previsao_entrega=$12 WHERE id=$13`,
      [mecanico,servico,servico_outro,obs,status,elevador_id,km_entrada,
        valor_mao_obra,valor_pecas,valorTotal,prioridade,previsao_entrega,req.params.id]);
  res.json({ ok: true });
});

app.patch('/api/os/:id/status', auth, async (req, res) => {
  const { status, km_saida } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const os = await client.query('SELECT * FROM ordens_servico WHERE id=$1', [req.params.id]);
    if (!os.rows.length) return res.status(404).json({ erro: 'OS não encontrada' });
    const o = os.rows[0];
    const concluido_em = (status==='finalizado'||status==='entregue') ? new Date() : null;
    await client.query('UPDATE ordens_servico SET status=$1,concluido_em=$2,km_saida=$3 WHERE id=$4',
        [status, concluido_em, km_saida||o.km_saida, req.params.id]);
    // Libera elevador ao finalizar ou entregar
    if ((status==='finalizado'||status==='entregue'||status==='cancelado') && o.elevador_id)
      await client.query("UPDATE elevadores SET status='livre',os_id=NULL,ocupado_em=NULL WHERE id=$1", [o.elevador_id]);
    // Bloqueia elevador quando aguardando peça
    if (status==='aguardando_peca' && o.elevador_id)
      await client.query("UPDATE elevadores SET status='bloqueado' WHERE id=$1", [o.elevador_id]);
    await client.query('COMMIT');
    await log(req.user.nome,'STATUS','ordens_servico',`OS ${req.params.id} → ${status}`);
    res.json({ ok: true });
  } catch(e) {
    await client.query('ROLLBACK');
    res.status(500).json({ erro: e.message });
  } finally { client.release(); }
});

// Adicionar peça a OS existente
app.post('/api/os/:id/pecas', auth, async (req, res) => {
  const { peca_id, qtd, preco_un } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const estoque = await client.query('SELECT qtd, nome FROM pecas WHERE id=$1', [peca_id]);
    if (estoque.rows[0].qtd < qtd) throw new Error(`Estoque insuficiente: ${estoque.rows[0].nome}`);
    const os = await client.query('SELECT numero FROM ordens_servico WHERE id=$1', [req.params.id]);
    await client.query('INSERT INTO os_pecas (os_id,peca_id,qtd,preco_un) VALUES ($1,$2,$3,$4)', [req.params.id,peca_id,qtd,preco_un||0]);
    await client.query('UPDATE pecas SET qtd=qtd-$1 WHERE id=$2', [qtd,peca_id]);
    await client.query('INSERT INTO estoque_movimentacao (peca_id,tipo,qtd,os_id,usuario,obs) VALUES ($1,$2,$3,$4,$5,$6)',
        [peca_id,'saida_os',qtd,req.params.id,req.user.nome,`OS ${os.rows[0].numero}`]);
    // Recalcula valor_pecas
    const total = await client.query('SELECT COALESCE(SUM(qtd*preco_un),0) as total FROM os_pecas WHERE os_id=$1', [req.params.id]);
    await client.query('UPDATE ordens_servico SET valor_pecas=$1, valor_total=valor_mao_obra+$1 WHERE id=$2', [total.rows[0].total, req.params.id]);
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch(e) {
    await client.query('ROLLBACK');
    res.status(400).json({ erro: e.message });
  } finally { client.release(); }
});

app.delete('/api/os/:id/pecas/:pecaId', auth, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const op = await client.query('SELECT * FROM os_pecas WHERE os_id=$1 AND peca_id=$2', [req.params.id, req.params.pecaId]);
    if (!op.rows.length) throw new Error('Peça não encontrada na OS');
    // Devolve ao estoque
    await client.query('UPDATE pecas SET qtd=qtd+$1 WHERE id=$2', [op.rows[0].qtd, req.params.pecaId]);
    await client.query('DELETE FROM os_pecas WHERE os_id=$1 AND peca_id=$2', [req.params.id, req.params.pecaId]);
    const total = await client.query('SELECT COALESCE(SUM(qtd*preco_un),0) as total FROM os_pecas WHERE os_id=$1', [req.params.id]);
    await client.query('UPDATE ordens_servico SET valor_pecas=$1, valor_total=valor_mao_obra+$1 WHERE id=$2', [total.rows[0].total, req.params.id]);
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch(e) {
    await client.query('ROLLBACK');
    res.status(400).json({ erro: e.message });
  } finally { client.release(); }
});

// ══════════════════ RELATÓRIOS ══════════════════
app.get('/api/relatorios/os', auth, async (req, res) => {
  const { de, ate, status } = req.query;
  let sql = `SELECT os.numero,os.criado_em,os.concluido_em,os.status,os.prioridade,
    os.servico,os.servico_outro,os.mecanico,os.valor_mao_obra,os.valor_pecas,os.valor_total,os.km_entrada,
    c.nome as cliente, c.telefone, v.placa, v.modelo
    FROM ordens_servico os JOIN clientes c ON c.id=os.cliente_id JOIN veiculos v ON v.id=os.veiculo_id WHERE 1=1`;
  const params = []; let i = 1;
  if (de)     { sql+=` AND os.criado_em::date>=$${i++}`; params.push(de); }
  if (ate)    { sql+=` AND os.criado_em::date<=$${i++}`; params.push(ate); }
  if (status && status!=='todos') { sql+=` AND os.status=$${i++}`; params.push(status); }
  sql += ' ORDER BY os.id DESC';
  const r = await pool.query(sql, params);
  res.json(r.rows);
});
app.get('/api/relatorios/servicos', auth, async (req, res) => {
  const r = await pool.query(`SELECT servico, COUNT(*)::int as total, SUM(valor_mao_obra)::numeric as faturamento,
    COUNT(CASE WHEN status IN ('finalizado','entregue') THEN 1 END)::int as concluidos
    FROM ordens_servico GROUP BY servico ORDER BY total DESC`);
  res.json(r.rows);
});
app.get('/api/relatorios/mecanicos', auth, async (req, res) => {
  const r = await pool.query(`SELECT mecanico, COUNT(*)::int as total_os,
    COUNT(CASE WHEN status IN ('finalizado','entregue') THEN 1 END)::int as concluidas,
    COUNT(CASE WHEN status NOT IN ('finalizado','entregue','cancelado') THEN 1 END)::int as em_andamento,
    COALESCE(SUM(CASE WHEN status IN ('finalizado','entregue') THEN valor_mao_obra ELSE 0 END),0)::numeric as faturamento
    FROM ordens_servico GROUP BY mecanico ORDER BY total_os DESC`);
  res.json(r.rows);
});

// ══════════════════ DASHBOARD ══════════════════
app.get('/api/dashboard', auth, async (req, res) => {
  const hoje = new Date().toISOString().slice(0,10);
  const [and,ag,mu,fin,clis,veics,pecrit,elevbloq,urgentes,osrec,fatHoje] = await Promise.all([
    pool.query("SELECT COUNT(*)::int as n FROM ordens_servico WHERE status NOT IN ('finalizado','entregue','cancelado')"),
    pool.query("SELECT COUNT(*)::int as n FROM ordens_servico WHERE status='aguardando_peca'"),
    pool.query("SELECT COUNT(*)::int as n FROM ordens_servico WHERE status='pausado'"),
    pool.query("SELECT COUNT(*)::int as n FROM ordens_servico WHERE status IN ('finalizado','entregue') AND criado_em::date=CURRENT_DATE"),
    pool.query("SELECT COUNT(*)::int as n FROM clientes"),
    pool.query("SELECT COUNT(*)::int as n FROM veiculos"),
    pool.query("SELECT COUNT(*)::int as n FROM pecas WHERE qtd<=qtd_minima"),
    pool.query("SELECT COUNT(*)::int as n FROM elevadores WHERE status='bloqueado'"),
    pool.query("SELECT COUNT(*)::int as n FROM ordens_servico WHERE prioridade='urgente' AND status NOT IN ('finalizado','entregue','cancelado')"),
    pool.query(`SELECT os.numero,os.status,os.prioridade,os.criado_em,c.nome as cliente,v.placa
      FROM ordens_servico os JOIN clientes c ON c.id=os.cliente_id JOIN veiculos v ON v.id=os.veiculo_id
      ORDER BY CASE os.prioridade WHEN 'urgente' THEN 1 WHEN 'alta' THEN 2 WHEN 'media' THEN 3 ELSE 4 END, os.id DESC LIMIT 8`),
    pool.query("SELECT COALESCE(SUM(valor_total),0)::numeric as total FROM ordens_servico WHERE status IN ('finalizado','entregue') AND criado_em::date=CURRENT_DATE"),
  ]);
  res.json({
    os_andamento: and.rows[0].n, os_aguardando: ag.rows[0].n,
    os_multidias: mu.rows[0].n, os_finalizadas: fin.rows[0].n,
    total_clientes: clis.rows[0].n, total_veiculos: veics.rows[0].n,
    pecas_criticas: pecrit.rows[0].n, elev_bloqueados: elevbloq.rows[0].n,
    os_urgentes: urgentes.rows[0].n, os_recentes: osrec.rows,
    faturamento_hoje: fatHoje.rows[0].total,
  });
});

// ══════════════════ AUDITORIA ══════════════════
app.get('/api/auditoria', auth, async (req, res) => {
  const r = await pool.query('SELECT * FROM auditoria ORDER BY id DESC LIMIT 100');
  res.json(r.rows);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`\n🔧 Paulinho Auto-Center 4.0 — Etapa 1\n🌐 http://localhost:${PORT}\n`));
module.exports = app;