const express = require('express');
const cors = require('cors');
const path = require('path');
const os = require('os');
const fs = require('fs');

// ── Use Node.js built-in SQLite (Node >= 22.5) ──────────────────
const { DatabaseSync } = require('node:sqlite');

const app = express();
const PORT = 3333;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── Database setup ───────────────────────────────────────────────
const DB_PATH = path.join(__dirname, 'casamento.db');
const db = new DatabaseSync(DB_PATH);

// WAL mode for better concurrency
db.exec('PRAGMA journal_mode=WAL;');

db.exec(`
  CREATE TABLE IF NOT EXISTS categorias (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL UNIQUE,
    icone TEXT DEFAULT '💍',
    orcamento REAL DEFAULT 0,
    criado_em TEXT DEFAULT (datetime('now', 'localtime')),
    padrao INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS gastos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    categoria_id INTEGER NOT NULL,
    descricao TEXT NOT NULL,
    valor REAL NOT NULL,
    pago INTEGER DEFAULT 0,
    data_pagamento TEXT,
    notas TEXT,
    criado_em TEXT DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (categoria_id) REFERENCES categorias(id) ON DELETE CASCADE
  );
`);

// ── Seed default categories if empty ────────────────────────────
const defaultCategories = [
  { nome: 'Cartório', icone: '🏛️' },
  { nome: 'Cerimonialista', icone: '👰' },
  { nome: 'Banda', icone: '🎵' },
  { nome: 'DJ', icone: '🎧' },
  { nome: 'Buffet', icone: '🍽️' },
  { nome: 'Bebidas', icone: '🥂' },
  { nome: 'Bar', icone: '🍹' },
  { nome: 'Garçom', icone: '🤵' },
  { nome: 'Som', icone: '🔊' },
  { nome: 'Lustre da Pista de Dança', icone: '✨' },
  { nome: 'Salão de Festa', icone: '🏰' },
  { nome: 'Pré-Wedding', icone: '📸' },
  { nome: 'Foto/Filmagem', icone: '🎬' },
  { nome: 'Decoração', icone: '💐' },
  { nome: 'Igreja', icone: '⛪' },
  { nome: 'Músicos da Igreja', icone: '🎶' },
  { nome: 'Vestido (Noiva e Daminhas)', icone: '👗' },
  { nome: 'Terno', icone: '🤵' },
  { nome: 'Convite dos Padrinhos', icone: '💌' },
  { nome: 'Convites Gerais', icone: '📨' },
  { nome: 'Lembranças', icone: '🎁' },
  { nome: 'Transfer', icone: '🚌' },
];

const countRow = db.prepare('SELECT COUNT(*) as cnt FROM categorias').get();
if (countRow.cnt === 0) {
  const insert = db.prepare('INSERT OR IGNORE INTO categorias (nome, icone, padrao) VALUES (?, ?, 1)');
  for (const cat of defaultCategories) {
    insert.run(cat.nome, cat.icone);
  }
}

// ── Helper ───────────────────────────────────────────────────────
function getAllCategorias() {
  return db.prepare(`
    SELECT 
      c.*,
      COALESCE(SUM(g.valor), 0) as total_gasto,
      COALESCE(SUM(CASE WHEN g.pago = 1 THEN g.valor ELSE 0 END), 0) as total_pago,
      COUNT(g.id) as num_itens
    FROM categorias c
    LEFT JOIN gastos g ON g.categoria_id = c.id
    GROUP BY c.id
    ORDER BY c.padrao DESC, c.nome ASC
  `).all();
}

// ── Routes: Categories ───────────────────────────────────────────
app.get('/api/categorias', (req, res) => {
  res.json(getAllCategorias());
});

app.post('/api/categorias', (req, res) => {
  const { nome, icone = '💍', orcamento = 0 } = req.body;
  if (!nome) return res.status(400).json({ error: 'Nome é obrigatório' });
  try {
    const result = db.prepare('INSERT INTO categorias (nome, icone, orcamento) VALUES (?, ?, ?)').run(nome.trim(), icone, orcamento);
    const cat = db.prepare('SELECT * FROM categorias WHERE id = ?').get(result.lastInsertRowid);
    res.json(cat);
  } catch (e) {
    res.status(400).json({ error: 'Categoria já existe' });
  }
});

app.put('/api/categorias/:id', (req, res) => {
  const { nome, icone, orcamento } = req.body;
  const { id } = req.params;
  const cur = db.prepare('SELECT * FROM categorias WHERE id = ?').get(id);
  if (!cur) return res.status(404).json({ error: 'Não encontrado' });
  db.prepare('UPDATE categorias SET nome = ?, icone = ?, orcamento = ? WHERE id = ?')
    .run(nome ?? cur.nome, icone ?? cur.icone, orcamento ?? cur.orcamento, id);
  res.json(db.prepare('SELECT * FROM categorias WHERE id = ?').get(id));
});

app.delete('/api/categorias/:id', (req, res) => {
  db.prepare('DELETE FROM categorias WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ── Routes: Gastos ───────────────────────────────────────────────
app.get('/api/gastos', (req, res) => {
  const { categoria_id } = req.query;
  let rows;
  if (categoria_id) {
    rows = db.prepare('SELECT * FROM gastos WHERE categoria_id = ? ORDER BY criado_em DESC').all(categoria_id);
  } else {
    rows = db.prepare(`
      SELECT g.*, c.nome as categoria_nome, c.icone as categoria_icone 
      FROM gastos g JOIN categorias c ON c.id = g.categoria_id 
      ORDER BY g.criado_em DESC
    `).all();
  }
  res.json(rows);
});

app.post('/api/gastos', (req, res) => {
  const { categoria_id, descricao, valor, pago = 0, data_pagamento = null, notas = '' } = req.body;
  if (!categoria_id || !descricao || valor === undefined) {
    return res.status(400).json({ error: 'Campos obrigatórios faltando' });
  }
  const result = db.prepare(
    'INSERT INTO gastos (categoria_id, descricao, valor, pago, data_pagamento, notas) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(categoria_id, descricao.trim(), valor, pago ? 1 : 0, data_pagamento, notas);
  res.json(db.prepare('SELECT * FROM gastos WHERE id = ?').get(result.lastInsertRowid));
});

app.put('/api/gastos/:id', (req, res) => {
  const { id } = req.params;
  const cur = db.prepare('SELECT * FROM gastos WHERE id = ?').get(id);
  if (!cur) return res.status(404).json({ error: 'Não encontrado' });
  const { descricao, valor, pago, data_pagamento, notas } = req.body;
  db.prepare(`UPDATE gastos SET 
    descricao = ?, valor = ?, pago = ?, data_pagamento = ?, notas = ?
    WHERE id = ?`
  ).run(
    descricao ?? cur.descricao,
    valor ?? cur.valor,
    pago !== undefined ? (pago ? 1 : 0) : cur.pago,
    data_pagamento !== undefined ? data_pagamento : cur.data_pagamento,
    notas ?? cur.notas,
    id
  );
  res.json(db.prepare('SELECT * FROM gastos WHERE id = ?').get(id));
});

app.delete('/api/gastos/:id', (req, res) => {
  db.prepare('DELETE FROM gastos WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ── Summary ──────────────────────────────────────────────────────
app.get('/api/resumo', (req, res) => {
  const stats = db.prepare(`
    SELECT
      COALESCE(SUM(valor), 0) as total_orcado,
      COALESCE(SUM(CASE WHEN pago = 1 THEN valor ELSE 0 END), 0) as total_pago,
      COALESCE(SUM(CASE WHEN pago = 0 THEN valor ELSE 0 END), 0) as total_pendente,
      COUNT(*) as total_itens,
      COUNT(CASE WHEN pago = 1 THEN 1 END) as itens_pagos
    FROM gastos
  `).get();
  const orcamento_total = db.prepare('SELECT COALESCE(SUM(orcamento), 0) as total FROM categorias').get().total;
  res.json({ ...stats, orcamento_total });
});

// ── Start ────────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  const interfaces = os.networkInterfaces();
  console.log('\n💍 Casamento de Scarlet & Matheus — Controle de Gastos\n');
  console.log(`   Local:    http://localhost:${PORT}`);
  Object.values(interfaces).flat().forEach(iface => {
    if (iface && iface.family === 'IPv4' && !iface.internal) {
      console.log(`   Rede WiFi: http://${iface.address}:${PORT}  ← outros dispositivos`);
    }
  });
  console.log(`\n   Banco de dados: ${DB_PATH}`);
  console.log('   Pressione Ctrl+C para parar o servidor.\n');
});
