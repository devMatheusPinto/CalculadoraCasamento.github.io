/* ═══════════════════════════════════════════════════
   Casamento Scarlet & Matheus — Frontend Logic
   (Versão estática / localStorage — GitHub Pages)
   ═══════════════════════════════════════════════════ */

// ── Default Categories ─────────────────────────────
const DEFAULT_CATEGORIES = [
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

const DB_KEY = 'casamento_db';

// ══════════════════════════════════════════════════════
//  DATABASE LAYER (localStorage)
// ══════════════════════════════════════════════════════

function dbLoad() {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* corrupt data — reinitialize */ }

  const now = new Date().toISOString();
  const data = {
    nextCatId: DEFAULT_CATEGORIES.length + 1,
    nextGastoId: 1,
    categorias: DEFAULT_CATEGORIES.map((c, i) => ({
      id: i + 1,
      nome: c.nome,
      icone: c.icone,
      orcamento: 0,
      padrao: 1,
      criado_em: now,
    })),
    gastos: [],
  };
  dbSave(data);
  return data;
}

function dbSave(data) {
  localStorage.setItem(DB_KEY, JSON.stringify(data));
}

function dbGetCategorias() {
  const data = dbLoad();
  return data.categorias
    .slice()
    .sort((a, b) => b.padrao - a.padrao || a.nome.localeCompare(b.nome, 'pt-BR'))
    .map(cat => {
      const catGastos = data.gastos.filter(g => g.categoria_id === cat.id);
      const total_gasto = catGastos.reduce((s, g) => s + (g.valor || 0), 0);
      const total_pago  = catGastos.filter(g => g.pago).reduce((s, g) => s + (g.valor || 0), 0);
      return { ...cat, total_gasto, total_pago, num_itens: catGastos.length };
    });
}

function dbGetGastos(categoriaId) {
  const data = dbLoad();
  const list = categoriaId
    ? data.gastos.filter(g => g.categoria_id === categoriaId)
    : data.gastos;
  return list.slice().sort((a, b) => new Date(b.criado_em) - new Date(a.criado_em));
}

function dbGetResumo() {
  const data   = dbLoad();
  const cats   = dbGetCategorias();
  const total_orcado    = data.gastos.reduce((s, g) => s + (g.valor || 0), 0);
  const total_pago      = data.gastos.filter(g => g.pago).reduce((s, g) => s + (g.valor || 0), 0);
  const total_pendente  = data.gastos.filter(g => !g.pago).reduce((s, g) => s + (g.valor || 0), 0);
  const orcamento_total = cats.reduce((s, c) => s + (c.orcamento || 0), 0);
  return { total_orcado, total_pago, total_pendente, orcamento_total };
}

function dbCreateCategoria(nome, icone, orcamento) {
  const data = dbLoad();
  if (data.categorias.find(c => c.nome.trim().toLowerCase() === nome.trim().toLowerCase())) {
    throw new Error('Categoria já existe');
  }
  const cat = {
    id: data.nextCatId++,
    nome: nome.trim(),
    icone: icone || '💍',
    orcamento: orcamento || 0,
    padrao: 0,
    criado_em: new Date().toISOString(),
  };
  data.categorias.push(cat);
  dbSave(data);
  return cat;
}

function dbUpdateCategoria(id, fields) {
  const data = dbLoad();
  const idx = data.categorias.findIndex(c => c.id === id);
  if (idx === -1) throw new Error('Não encontrado');
  data.categorias[idx] = { ...data.categorias[idx], ...fields };
  dbSave(data);
  return data.categorias[idx];
}

function dbDeleteCategoria(id) {
  const data = dbLoad();
  data.categorias = data.categorias.filter(c => c.id !== id);
  data.gastos     = data.gastos.filter(g => g.categoria_id !== id);
  dbSave(data);
}

function dbCreateGasto(fields) {
  const data  = dbLoad();
  const gasto = {
    id: data.nextGastoId++,
    categoria_id:   fields.categoria_id,
    descricao:      fields.descricao,
    valor:          fields.valor,
    pago:           fields.pago ? 1 : 0,
    data_pagamento: fields.data_pagamento || null,
    notas:          fields.notas || '',
    criado_em:      new Date().toISOString(),
  };
  data.gastos.push(gasto);
  dbSave(data);
  return gasto;
}

function dbUpdateGasto(id, fields) {
  const data = dbLoad();
  const idx  = data.gastos.findIndex(g => g.id === id);
  if (idx === -1) throw new Error('Não encontrado');
  const updated = { ...data.gastos[idx], ...fields };
  if ('pago' in fields) updated.pago = fields.pago ? 1 : 0;
  data.gastos[idx] = updated;
  dbSave(data);
  return updated;
}

function dbDeleteGasto(id) {
  const data = dbLoad();
  data.gastos = data.gastos.filter(g => g.id !== id);
  dbSave(data);
}

// ══════════════════════════════════════════════════════
//  STATE
// ══════════════════════════════════════════════════════
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

// ── Load summary ───────────────────────────────────
function loadSummary() {
  const s    = dbGetResumo();
  sumTotal.textContent    = fmt(s.orcamento_total);
  sumPago.textContent     = fmt(s.total_pago);
  sumPendente.textContent = fmt(s.total_pendente);
  const base = s.orcamento_total > 0 ? s.orcamento_total : s.total_orcado;
  const pct  = base > 0 ? Math.min(100, (s.total_pago / base) * 100) : 0;
  sumProgress.textContent = pct.toFixed(0) + '%';
  progBar.style.width = pct + '%';
}

// ── Load categories ────────────────────────────────
function loadCategorias() {
  categorias = dbGetCategorias();
  renderCategorias();
  loadSummary();
  if (currentCat) {
    const updated = categorias.find(c => c.id === currentCat.id);
    if (updated) { currentCat = updated; renderDetailHeader(); }
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
function selectCategory(cat) {
  currentCat = cat;
  renderCategorias();
  emptyState.classList.add('hidden');
  detailContent.classList.remove('hidden');
  renderDetailHeader();
  loadGastos(cat.id);
}

function renderDetailHeader() {
  const cat = currentCat;
  if (!cat) return;
  detailIcon.textContent = cat.icone;
  detailName.textContent = cat.nome;
  const pendente  = (cat.total_gasto || 0) - (cat.total_pago || 0);
  const restante  = cat.orcamento > 0 ? cat.orcamento - (cat.total_gasto || 0) : null;
  const restanteStr = restante !== null
    ? ` · Restante: ${fmt(restante)}`
    : ' · Sem orçamento definido';
  detailStats.textContent = `${cat.num_itens || 0} item(s) · Pago: ${fmt(cat.total_pago)} · Pendente: ${fmt(pendente)}${restanteStr}`;

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
function loadGastos(catId) {
  gastos = dbGetGastos(catId);
  renderGastos();
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
function toggleGastoStatus(g) {
  try {
    const newPago = g.pago ? 0 : 1;
    const today   = new Date().toISOString().slice(0, 10);
    dbUpdateGasto(g.id, { pago: newPago, data_pagamento: newPago ? today : null });
    toast(newPago ? 'Marcado como pago 🎉' : 'Marcado como pendente');
    refreshAll();
  } catch (e) { toast(e.message, 'error'); }
}

// ── Refresh everything ─────────────────────────────
function refreshAll() {
  loadCategorias();
  if (currentCat) {
    const updated = categorias.find(c => c.id === currentCat.id);
    if (updated) currentCat = updated;
    loadGastos(currentCat.id);
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

gastoForm.addEventListener('submit', e => {
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
  if (!body.descricao || isNaN(body.valor)) { toast('Preencha os campos obrigatórios', 'error'); return; }
  try {
    if (id) {
      dbUpdateGasto(parseInt(id), body);
      toast('Gasto atualizado!');
    } else {
      dbCreateGasto(body);
      toast('Gasto adicionado! 🎉');
    }
    closeGastoModal();
    refreshAll();
  } catch (err) { toast(err.message, 'error'); }
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

catForm.addEventListener('submit', e => {
  e.preventDefault();
  const id        = document.getElementById('catId').value;
  const nome      = document.getElementById('catNome').value.trim();
  const icone     = document.getElementById('catIcone').value.trim() || '💍';
  const orcamento = parseFloat(document.getElementById('catOrcamento').value) || 0;
  if (!nome) { toast('Informe o nome da categoria', 'error'); return; }
  try {
    if (id) {
      dbUpdateCategoria(parseInt(id), { nome, icone, orcamento });
      toast(`Categoria "${nome}" atualizada! ✏️`);
      if (currentCat?.id === parseInt(id)) {
        currentCat = { ...currentCat, nome, icone, orcamento };
        renderDetailHeader();
      }
    } else {
      dbCreateCategoria(nome, icone, orcamento);
      toast(`Categoria "${nome}" criada!`);
    }
    catModal.classList.add('hidden');
    catForm.reset();
    loadCategorias();
  } catch (err) { toast(err.message, 'error'); }
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

budgetForm.addEventListener('submit', e => {
  e.preventDefault();
  const id  = parseInt(document.getElementById('budgetCatId').value);
  const val = parseFloat(document.getElementById('budgetValor').value) || 0;
  try {
    dbUpdateCategoria(id, { orcamento: val });
    toast('Orçamento atualizado!');
    budgetModal.classList.add('hidden');
    refreshAll();
  } catch (err) { toast(err.message, 'error'); }
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
document.getElementById('confirmDelete').addEventListener('click', () => {
  if (deleteCallback) deleteCallback();
  closeConfirm();
});

function confirmDeleteGasto(id) {
  openConfirm('Tem certeza que deseja excluir este gasto? Esta ação não pode ser desfeita.', () => {
    try {
      dbDeleteGasto(id);
      toast('Gasto excluído');
      refreshAll();
    } catch (err) { toast(err.message, 'error'); }
  });
}

// ═══ EXPORT / IMPORT ═══════════════════════════════
function exportData() {
  const data = dbLoad();
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  const date = new Date().toISOString().slice(0, 10);
  a.href     = url;
  a.download = `casamento-backup-${date}.json`;
  a.click();
  URL.revokeObjectURL(url);
  toast('Backup exportado! 📥');
}

function importData(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = JSON.parse(e.target.result);
      if (!data.categorias || !data.gastos) throw new Error('Arquivo inválido');
      dbSave(data);
      currentCat = null;
      emptyState.classList.remove('hidden');
      detailContent.classList.add('hidden');
      loadCategorias();
      toast('Dados importados com sucesso! 🎉');
    } catch (err) {
      toast('Erro ao importar: arquivo inválido', 'error');
    }
  };
  reader.readAsText(file);
}

document.getElementById('btnExport').addEventListener('click', exportData);
document.getElementById('btnImport').addEventListener('click', () => {
  document.getElementById('importFileInput').click();
});
document.getElementById('importFileInput').addEventListener('change', e => {
  importData(e.target.files[0]);
  e.target.value = ''; // reset so same file can be re-imported
});

// ═══ KEYBOARD ══════════════════════════════════════
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (!gastoModal.classList.contains('hidden'))    closeGastoModal();
    else if (!catModal.classList.contains('hidden')) catModal.classList.add('hidden');
    else if (!budgetModal.classList.contains('hidden')) budgetModal.classList.add('hidden');
    else if (!confirmModal.classList.contains('hidden')) closeConfirm();
  }
});

// ═══ INIT ══════════════════════════════════════════
loadCategorias();
