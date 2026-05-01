const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');

const db = new DatabaseSync('casamento.db');

const data = {
  nextCatId: 1,
  nextGastoId: 1,
  categorias: [],
  gastos: []
};

const categorias = db.prepare('SELECT * FROM categorias').all();
data.categorias = categorias;
data.nextCatId = categorias.length > 0 ? Math.max(...categorias.map(c => c.id)) + 1 : 1;

const gastos = db.prepare('SELECT * FROM gastos').all();
data.gastos = gastos;
data.nextGastoId = gastos.length > 0 ? Math.max(...gastos.map(g => g.id)) + 1 : 1;

fs.writeFileSync('meu-backup-casamento.json', JSON.stringify(data, null, 2));
console.log('Backup gerado com sucesso: meu-backup-casamento.json');
