/* ═══════════════════════════════════════════════════
   Casamento Scarlet & Matheus — Frontend Logic
   (Versão com Supabase na Nuvem)
   ═══════════════════════════════════════════════════ */

// ── CONFIGURAÇÃO DO SUPABASE ───────────────────────
// ATENÇÃO: Substitua os valores abaixo com as chaves do seu projeto Supabase!
const SUPABASE_URL = 'https://qmymnqzhhdaycuxjcghr.supabase.co';
const SUPABASE_KEY = 'sb_publishable_6hFd1Dutx0ugMUmC_kSZAg_n3L81d4T';

const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ── STATE ──────────────────────────────────────────
let categorias    = [];
let currentCat    = null;
let gastos        = [];
let deleteCallback = null;

// ── DOM refs ───────────────────────────────────────
const categoryList    = document.getElementById('categoryList');
const emptyState      = document.getElementById('emptyState');
const detailContent   = document.getElementById('detailContent');
const detailIcon      = document.getElementById('detailIcon');
const detailName      = document.getElementById('detailName');
const detailStats     = document.getElementById('detailStats');
const gastosList      = document.getElementById('gastosList');
const budgetLabel     = document.getElementById('budgetLabel');
const budgetUsedLabel = document.getElementById('budgetUsedLabel');
const budgetBar       = document.getElementById('budgetProgressBar');
const progBar         = document.getElementById('progressBar');

// Summary
const sumTotal    = document.getElementById('sumTotal');
const sumPago     = document.getElementById('sumPago');
const sumPendente = document.getElementById('sumPendente');
const sumProgress = document.getElementById('sumProgress');

// ── Helpers ────────────────────────────────────────
const fmt = v => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

function toast(msg, type = 'success') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = (type === 'success' ? '✓ ' : '✕ ') + msg;
  document.getElementById('toastContainer').appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

function esc(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function fmtDate(d) {
  if (!d) return '';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

// ── Date header ────────────────────────────────────
(function updateDate() {
  const now  = new Date();
  const opts = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  document.getElementById('headerDate').textContent = now.toLocaleDateString('pt-BR', opts);
})();

// ── Data Fetching ──────────────────────────────────

async function getResumoData() {
  // Para evitar múltiplas chamadas, podemos calcular o resumo a partir dos gastos totais e categorias
  const { data: allGastos, error: errG } = await supabase.from('gastos').select('valor, pago');
  if (errG) throw errG;
  
  const total_orcado    = allGastos.reduce((s, g) => s + (g.valor || 0), 0);
  const total_pago      = allGastos.filter(g => g.pago).reduce((s, g) => s + (g.valor || 0), 0);
  
  const total_pendente  = categorias.reduce((s, cat) => {
    const pendenteCat = Math.max(0, cat.orcamento > 0
      ? cat.orcamento - (cat.total_pago || 0)
      : (cat.total_gasto || 0) - (cat.total_pago || 0));
    return s + pendenteCat;
  }, 0);
  
  const orcamento_total = categorias.reduce((s, c) => s + (c.orcamento || 0), 0);
  
  return { total_orcado, total_pago, total_pendente, orcamento_total };
}

async function fetchCategorias() {
  const { data: cats, error: errC } = await supabase
    .from('categorias')
    .select('*')
    .order('padrao', { ascending: false })
    .order('nome', { ascending: true });
  if (errC) throw errC;

  const { data: allGastos, error: errG } = await supabase
    .from('gastos')
    .select('categoria_id, valor, pago');
  if (errG) throw errG;

  return cats.map(cat => {
    const catGastos = allGastos.filter(g => g.categoria_id === cat.id);
    const total_gasto = catGastos.reduce((s, g) => s + (g.valor || 0), 0);
    const total_pago  = catGastos.filter(g => g.pago).reduce((s, g) => s + (g.valor || 0), 0);
    return { ...cat, total_gasto, total_pago, num_itens: catGastos.length };
  });
}

// ── Load summary ───────────────────────────────────
async function loadSummary() {
  try {
    const s = await getResumoData();
    sumTotal.textContent    = fmt(s.orcamento_total);
    sumPago.textContent     = fmt(s.total_pago);
    sumPendente.textContent = fmt(s.total_pendente);
    const base = s.orcamento_total > 0 ? s.orcamento_total : s.total_orcado;
    const pct  = base > 0 ? Math.min(100, (s.total_pago / base) * 100) : 0;
    sumProgress.textContent = pct.toFixed(0) + '%';
    progBar.style.width = pct + '%';
  } catch (e) {
    console.error('Erro ao carregar resumo:', e);
  }
}

// ── Load categories ────────────────────────────────
async function loadCategorias() {
  try {
    if (SUPABASE_URL === 'SUA_URL_AQUI') {
      toast('Configure as chaves do Supabase no código!', 'error');
      return;
    }

    categorias = await fetchCategorias();
    renderCategorias();
    await loadSummary();
    if (currentCat) {
      const updated = categorias.find(c => c.id === currentCat.id);
      if (updated) { currentCat = updated; renderDetailHeader(); }
    }
  } catch (e) {
    toast('Erro ao carregar categorias', 'error');
    console.error(e);
  }
}

function renderCategorias() {
  categoryList.innerHTML = '';
  categorias.forEach(cat => {
    const li = document.createElement('li');
    li.className = 'category-item' + (currentCat?.id === cat.id ? ' active' : '');
    li.setAttribute('role', 'option');
    li.setAttribute('aria-selected', currentCat?.id === cat.id ? 'true' : 'false');
    const base   = cat.orcamento > 0 ? cat.orcamento : cat.total_gasto;
    const paid   = cat.total_pago || 0;
    const pct    = base > 0 ? Math.min(100, (paid / base) * 100) : 0;
    const isOver = cat.orcamento > 0 && paid >= cat.orcamento;
    li.innerHTML = `
      <span class="cat-icon">${cat.icone}</span>
      <div class="cat-info">
        <div class="cat-name">${esc(cat.nome)}</div>
        <div class="cat-amount">${fmt(cat.total_gasto)}</div>
        <div class="cat-progress-wrap">
          <div class="cat-progress-bar${isOver ? ' over' : ''}" style="width:${pct}%"></div>
        </div>
      </div>
      ${cat.num_itens > 0 ? `<span class="cat-badge">${cat.num_itens}</span>` : ''}
      <button class="cat-edit-btn" title="Editar categoria" aria-label="Editar ${esc(cat.nome)}">✏️</button>
    `;
    li.querySelector('.cat-edit-btn').addEventListener('click', e => {
      e.stopPropagation();
      openCatModal(cat);
    });
    li.addEventListener('click', () => selectCategory(cat));
    categoryList.appendChild(li);
  });
}

// ── Select category ────────────────────────────────
async function selectCategory(cat) {
  currentCat = cat;
  renderCategorias();
  emptyState.classList.add('hidden');
  detailContent.classList.remove('hidden');
  renderDetailHeader();
  await loadGastos(cat.id);
}

function renderDetailHeader() {
  const cat = currentCat;
  if (!cat) return;
  detailIcon.textContent = cat.icone;
  detailName.textContent = cat.nome;
  const pendente = Math.max(0, cat.orcamento > 0
    ? cat.orcamento - (cat.total_pago || 0)
    : (cat.total_gasto || 0) - (cat.total_pago || 0));
  detailStats.textContent = `${cat.num_itens || 0} item(s) · Pago: ${fmt(cat.total_pago)} · Pendente: ${fmt(pendente)}`;

  if (cat.orcamento > 0) {
    budgetLabel.textContent = fmt(cat.orcamento);
    const pct = Math.min(100, ((cat.total_gasto || 0) / cat.orcamento) * 100);
    budgetUsedLabel.textContent = `${fmt(cat.total_gasto)} usado (${pct.toFixed(0)}%)`;
    budgetBar.style.width = pct + '%';
    budgetBar.classList.toggle('budget-over', pct >= 100);
    document.getElementById('budgetBarSection').style.display = '';
  } else {
    budgetLabel.textContent = 'Não definido';
    budgetUsedLabel.textContent = fmt(cat.total_gasto) + ' orçado';
    budgetBar.style.width = '0%';
    document.getElementById('budgetBarSection').style.display = '';
  }
}

// ── Load gastos ────────────────────────────────────
async function loadGastos(catId) {
  try {
    const { data, error } = await supabase
      .from('gastos')
      .select('*')
      .eq('categoria_id', catId)
      .order('criado_em', { ascending: false });
    
    if (error) throw error;
    gastos = data;
    renderGastos();
  } catch (e) {
    toast('Erro ao carregar gastos', 'error');
    console.error(e);
  }
}

function renderGastos() {
  gastosList.innerHTML = '';
  if (gastos.length === 0) {
    gastosList.innerHTML = `
      <div class="gasto-empty">
        <p>🧾</p>
        <p>Nenhum gasto cadastrado nesta categoria ainda.</p>
      </div>`;
    return;
  }
  gastos.forEach(g => {
    const div    = document.createElement('div');
    div.className = 'gasto-item';
    const isPago = !!g.pago;
    const meta   = [
      isPago ? '✅ Pago' : '⏳ Pendente',
      g.data_pagamento ? 'em ' + fmtDate(g.data_pagamento) : null,
      g.notas ? '· ' + g.notas : null,
    ].filter(Boolean).join(' ');

    div.innerHTML = `
      <button class="gasto-status ${isPago ? 'pago' : 'pendente'}"
              title="Clique para alternar status"
              aria-label="Status: ${isPago ? 'Pago' : 'Pendente'}">
        ${isPago ? '✅' : '⏳'}
      </button>
      <div class="gasto-info">
        <div class="gasto-descricao" title="${esc(g.descricao)}">${esc(g.descricao)}</div>
        <div class="gasto-meta">${esc(meta)}</div>
      </div>
      <div class="gasto-valor ${isPago ? 'pago' : 'pendente'}">${fmt(g.valor)}</div>
      <div class="gasto-btn-group">
        <button class="btn-icon" title="Editar" aria-label="Editar gasto">✏️</button>
        <button class="btn-icon delete" title="Excluir" aria-label="Excluir gasto">🗑️</button>
      </div>
    `;

    div.querySelector('.gasto-status').addEventListener('click', () => toggleGastoStatus(g));
    div.querySelector('.btn-icon:not(.delete)').addEventListener('click', () => openGastoModal(g));
    div.querySelector('.btn-icon.delete').addEventListener('click', () => confirmDeleteGasto(g.id));
    gastosList.appendChild(div);
  });
}

// ── Toggle payment status ──────────────────────────
async function toggleGastoStatus(g) {
  try {
    const newPago = g.pago ? false : true;
    const today   = new Date().toISOString().slice(0, 10);
    
    const { error } = await supabase
      .from('gastos')
      .update({ pago: newPago, data_pagamento: newPago ? today : null })
      .eq('id', g.id);
      
    if (error) throw error;

    toast(newPago ? 'Marcado como pago 🎉' : 'Marcado como pendente');
    await refreshAll();
  } catch (e) {
    toast('Erro ao atualizar status', 'error');
    console.error(e);
  }
}

// ── Refresh everything ─────────────────────────────
async function refreshAll() {
  await loadCategorias();
  if (currentCat) {
    const updated = categorias.find(c => c.id === currentCat.id);
    if (updated) currentCat = updated;
    await loadGastos(currentCat.id);
    renderDetailHeader();
  }
}

// ═══ GASTO MODAL ═════════════════════════════════
const gastoModal = document.getElementById('gastoModal');
const gastoForm  = document.getElementById('gastoForm');

function openGastoModal(g = null) {
  document.getElementById('gastoModalTitle').textContent = g ? 'Editar Gasto' : 'Adicionar Gasto';
  document.getElementById('gastoId').value           = g?.id || '';
  document.getElementById('gastoCategoriaId').value  = currentCat?.id || '';
  document.getElementById('gastoDescricao').value    = g?.descricao || '';
  document.getElementById('gastoValor').value        = g?.valor || '';
  document.getElementById('gastoPago').value         = g?.pago ? '1' : '0';
  document.getElementById('gastoData').value         = g?.data_pagamento || '';
  document.getElementById('gastoNotas').value        = g?.notas || '';
  gastoModal.classList.remove('hidden');
  document.getElementById('gastoDescricao').focus();
}

function closeGastoModal() { gastoModal.classList.add('hidden'); gastoForm.reset(); }

document.getElementById('closeGastoModal').addEventListener('click', closeGastoModal);
document.getElementById('cancelGasto').addEventListener('click', closeGastoModal);
gastoModal.addEventListener('click', e => { if (e.target === gastoModal) closeGastoModal(); });

gastoForm.addEventListener('submit', async e => {
  e.preventDefault();
  const id    = document.getElementById('gastoId').value;
  const catId = parseInt(document.getElementById('gastoCategoriaId').value);
  const body  = {
    categoria_id:   catId,
    descricao:      document.getElementById('gastoDescricao').value.trim(),
    valor:          parseFloat(document.getElementById('gastoValor').value),
    pago:           document.getElementById('gastoPago').value === '1',
    data_pagamento: document.getElementById('gastoData').value || null,
    notas:          document.getElementById('gastoNotas').value.trim(),
  };
  
  if (!body.descricao || isNaN(body.valor)) {
    toast('Preencha os campos obrigatórios', 'error');
    return;
  }
  
  try {
    if (id) {
      const { error } = await supabase.from('gastos').update(body).eq('id', id);
      if (error) throw error;
      toast('Gasto atualizado!');
    } else {
      const { error } = await supabase.from('gastos').insert([body]);
      if (error) throw error;
      toast('Gasto adicionado! 🎉');
    }
    closeGastoModal();
    await refreshAll();
  } catch (err) {
    toast('Erro ao salvar gasto', 'error');
    console.error(err);
  }
});

document.getElementById('btnAddGasto').addEventListener('click', () => openGastoModal());

// ═══ CATEGORY MODAL ════════════════════════════════
const catModal = document.getElementById('catModal');
const catForm  = document.getElementById('catForm');

function openCatModal(cat = null) {
  catForm.reset();
  document.getElementById('catId').value        = cat?.id || '';
  document.getElementById('catIcone').value     = cat?.icone || '💍';
  document.getElementById('catNome').value      = cat?.nome || '';
  document.getElementById('catOrcamento').value = cat?.orcamento || '';
  document.getElementById('catModalTitle').textContent = cat ? 'Editar Categoria' : 'Nova Categoria';
  document.getElementById('catSubmitBtn').textContent  = cat ? 'Salvar' : 'Criar';
  catModal.classList.remove('hidden');
  document.getElementById('catNome').focus();
}

document.getElementById('btnAddCategory').addEventListener('click', () => openCatModal());
document.getElementById('closeCatModal').addEventListener('click', () => catModal.classList.add('hidden'));
document.getElementById('cancelCat').addEventListener('click', () => catModal.classList.add('hidden'));
catModal.addEventListener('click', e => { if (e.target === catModal) catModal.classList.add('hidden'); });

catForm.addEventListener('submit', async e => {
  e.preventDefault();
  const id        = document.getElementById('catId').value;
  const nome      = document.getElementById('catNome').value.trim();
  const icone     = document.getElementById('catIcone').value.trim() || '💍';
  const orcamento = parseFloat(document.getElementById('catOrcamento').value) || 0;
  
  if (!nome) { toast('Informe o nome da categoria', 'error'); return; }
  
  try {
    if (id) {
      const { error } = await supabase.from('categorias').update({ nome, icone, orcamento }).eq('id', id);
      if (error) throw error;
      toast(`Categoria "${nome}" atualizada! ✏️`);
      if (currentCat?.id === parseInt(id)) {
        currentCat = { ...currentCat, nome, icone, orcamento };
        renderDetailHeader();
      }
    } else {
      const { error } = await supabase.from('categorias').insert([{ nome, icone, orcamento, padrao: 0 }]);
      if (error) throw error;
      toast(`Categoria "${nome}" criada!`);
    }
    catModal.classList.add('hidden');
    catForm.reset();
    await loadCategorias();
  } catch (err) {
    toast('Erro ao salvar categoria', 'error');
    console.error(err);
  }
});

// ═══ BUDGET MODAL ══════════════════════════════════
const budgetModal = document.getElementById('budgetModal');
const budgetForm  = document.getElementById('budgetForm');

document.getElementById('btnEditBudget').addEventListener('click', () => {
  if (!currentCat) return;
  document.getElementById('budgetCatId').value       = currentCat.id;
  document.getElementById('budgetCatName').textContent = currentCat.nome;
  document.getElementById('budgetValor').value       = currentCat.orcamento || '';
  budgetModal.classList.remove('hidden');
  document.getElementById('budgetValor').focus();
});
document.getElementById('closeBudgetModal').addEventListener('click', () => budgetModal.classList.add('hidden'));
document.getElementById('cancelBudget').addEventListener('click', () => budgetModal.classList.add('hidden'));
budgetModal.addEventListener('click', e => { if (e.target === budgetModal) budgetModal.classList.add('hidden'); });

budgetForm.addEventListener('submit', async e => {
  e.preventDefault();
  const id  = parseInt(document.getElementById('budgetCatId').value);
  const val = parseFloat(document.getElementById('budgetValor').value) || 0;
  
  try {
    const { error } = await supabase.from('categorias').update({ orcamento: val }).eq('id', id);
    if (error) throw error;
    
    toast('Orçamento atualizado!');
    budgetModal.classList.add('hidden');
    await refreshAll();
  } catch (err) {
    toast('Erro ao atualizar orçamento', 'error');
    console.error(err);
  }
});

// ═══ CONFIRM DELETE ════════════════════════════════
const confirmModal = document.getElementById('confirmModal');

function openConfirm(msg, cb) {
  document.getElementById('confirmMessage').textContent = msg;
  deleteCallback = cb;
  confirmModal.classList.remove('hidden');
}
function closeConfirm() { confirmModal.classList.add('hidden'); deleteCallback = null; }

document.getElementById('closeConfirmModal').addEventListener('click', closeConfirm);
document.getElementById('cancelConfirm').addEventListener('click', closeConfirm);
confirmModal.addEventListener('click', e => { if (e.target === confirmModal) closeConfirm(); });
document.getElementById('confirmDelete').addEventListener('click', async () => {
  if (deleteCallback) await deleteCallback();
  closeConfirm();
});

function confirmDeleteGasto(id) {
  openConfirm('Tem certeza que deseja excluir este gasto? Esta ação não pode ser desfeita.', async () => {
    try {
      const { error } = await supabase.from('gastos').delete().eq('id', id);
      if (error) throw error;
      toast('Gasto excluído');
      await refreshAll();
    } catch (err) {
      toast('Erro ao excluir', 'error');
      console.error(err);
    }
  });
}

// ═══ KEYBOARD E REALTIME ══════════════════════════
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (!gastoModal.classList.contains('hidden'))    closeGastoModal();
    else if (!catModal.classList.contains('hidden')) catModal.classList.add('hidden');
    else if (!budgetModal.classList.contains('hidden')) budgetModal.classList.add('hidden');
    else if (!confirmModal.classList.contains('hidden')) closeConfirm();
  }
});

// Escuta por mudanças em tempo real (Opcional, para sincronia instantânea)
if (SUPABASE_URL !== 'SUA_URL_AQUI') {
  supabase
    .channel('public:gastos')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'gastos' }, () => {
      // Pequeno debounce caso a gente mesmo tenha feito a alteração
      setTimeout(refreshAll, 500);
    })
    .subscribe();
}

// ═══ RECUPERAÇÃO DE DADOS LOCAIS ══════════════════
(function recoverLocalData() {
  const raw = localStorage.getItem('casamento_db');
  if (raw) {
    try {
      const blob = new Blob([raw], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'meu-backup-recuperado.json';
      a.click();
      URL.revokeObjectURL(url);
      localStorage.setItem('casamento_db_backup', raw);
      localStorage.removeItem('casamento_db');
      toast('Backup local recuperado e baixado! 📥', 'success');
    } catch (e) {
      console.error('Erro na recuperação', e);
    }
  }
})();

// ═══ INIT ══════════════════════════════════════════
loadCategorias();
