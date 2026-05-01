const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Substitua com as suas chaves do Supabase
const SUPABASE_URL = 'https://qmymnqzhhdaycuxjcghr.supabase.co';
const SUPABASE_KEY = 'sb_publishable_6hFd1Dutx0ugMUmC_kSZAg_n3L81d4T';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function importar() {
  if (SUPABASE_URL === 'SUA_URL_AQUI') {
    console.error('❌ Por favor, adicione sua URL e KEY do Supabase no arquivo import_to_supabase.js');
    return;
  }

  console.log('Lendo backup recuperado...');
  let data;
  try {
    const raw = fs.readFileSync('meu-backup-recuperado.json', 'utf8');
    data = JSON.parse(raw);
  } catch (e) {
    console.error('Erro ao ler meu-backup-recuperado.json', e.message);
    return;
  }

  const categorias = data.categorias || [];
  const gastos = data.gastos || [];

  console.log(`Lidas ${categorias.length} categorias e ${gastos.length} gastos.`);

  console.log('Limpando dados antigos da nuvem...');
  // Apaga todas as categorias (que apaga os gastos por CASCADE)
  await supabase.from('categorias').delete().neq('id', -1);

  // 1. Inserir Categorias
  console.log('Enviando categorias para o Supabase...');
  for (const cat of categorias) {
    const { error } = await supabase.from('categorias').insert([{
      id: cat.id,
      nome: cat.nome,
      icone: cat.icone,
      orcamento: cat.orcamento,
      padrao: cat.padrao || 0,
      criado_em: cat.criado_em || new Date().toISOString()
    }]);
    
    if (error) { 
      console.error(`Erro ao inserir categoria ${cat.nome}:`, error.message);
    }
  }

  // 2. Inserir Gastos
  console.log('Enviando gastos para o Supabase...');
  for (const g of gastos) {
    const { error } = await supabase.from('gastos').insert([{
      id: g.id,
      categoria_id: g.categoria_id,
      descricao: g.descricao,
      valor: g.valor,
      pago: g.pago === 1 || g.pago === true,
      data_pagamento: g.data_pagamento,
      notas: g.notas,
      criado_em: g.criado_em || new Date().toISOString()
    }]);

    if (error) {
      console.error(`Erro ao inserir gasto ${g.descricao}:`, error.message);
    }
  }

  console.log('✅ Dados recuperados com sucesso!');
}

importar();
