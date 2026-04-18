/* ═══════════════════════════════════════════════════
   Casamento Scarlet & Matheus — Frontend Logic
   ═══════════════════════════════════════════════════ */

const API = '';   // same origin — server serves this file

// ── State ──────────────────────────────────────────
let categorias = [];
let currentCat = null;
let gastos = [];
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
const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

async function req(method, url, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'Erro na requisição'); }
  return res.json();
}

function toast(msg, type = 'success') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = (type === 'success' ? '✓ ' : '✕ ') + msg;
  document.getElementById('toastContainer').appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

// ── Date header ────────────────────────────────────
(function updateDate() {
  const now = new Date();
  const opts = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  document.getElementById('headerDate').textContent = now.toLocaleDateString('pt-BR', opts);
})();

// ── Load summary ───────────────────────────────────
async function loadSummary() {
  try {
    const s = await req('GET', '/api/resumo');
    // Total Orçado = soma dos orçamentos definidos por categoria
    sumTotal.textContent    = fmt(s.orcamento_total);
    sumPago.textContent     = fmt(s.total_pago);
    sumPendente.textContent = fmt(s.total_pendente);
    // Progresso = quanto do orçamento total já foi pago
    const base = s.orcamento_total > 0 ? s.orcamento_total : s.total_orcado;
    const pct = base > 0 ? Math.min(100, (s.total_pago / base) * 100) : 0;
    sumProgress.textContent = pct.toFixed(0) + '%';
    progBar.style.width = pct + '%';
  } catch (e) { console.error(e); }
}

// ── Load categories ────────────────────────────────
async function loadCategorias() {
  try {
    categorias = await req('GET', '/api/categorias');
    renderCategorias();
    loadSummary();
    if (currentCat) {
      const updated = categorias.find(c => c.id === currentCat.id);
      if (updated) { currentCat = updated; renderDetailHeader(); }
    }
  } catch (e) { toast('Erro ao carregar categorias', 'error'); }
}

function renderCategorias() {
  categoryList.innerHTML = '';
  categorias.forEach(cat => {
    const li = document.createElement('li');
    li.className = 'category-item' + (currentCat?.id === cat.id ? ' active' : '');
    li.setAttribute('role', 'option');
    li.setAttribute('aria-selected', currentCat?.id === cat.id ? 'true' : 'false');
    const base = cat.orcamento > 0 ? cat.orcamento : cat.total_gasto;
    const paid = cat.total_pago || 0;
    const pct  = base > 0 ? Math.min(100, (paid / base) * 100) : 0;
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
    `;
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
  detailStats.textContent = `${cat.num_itens || 0} item(s) · Pago: ${fmt(cat.total_pago)} · Pendente: ${fmt((cat.total_gasto || 0) - (cat.total_pago || 0))}`;

  // Budget bar
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
    gastos = await req('GET', `/api/gastos?categoria_id=${catId}`);
    renderGastos();
  } catch (e) { toast('Erro ao carregar gastos', 'error'); }
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
    const div = document.createElement('div');
    div.className = 'gasto-item';
    const isPago = !!g.pago;
    const meta = [
      isPago ? '✅ Pago' : '⏳ Pendente',
      g.data_pagamento ? 'em ' + fmtDate(g.data_pagamento) : null,
      g.notas ? '· ' + g.notas : null,
    ].filter(Boolean).join(' ');

    div.innerHTML = `
      <button class="gasto-status ${isPago ? 'pago' : 'pendente'}" 
              title="Clique para alternar status"
              aria-label="Status: ${isPago ? 'Pago' : 'Pendente'}"
              data-id="${g.id}" data-pago="${isPago ? 1 : 0}">
        ${isPago ? '✅' : '⏳'}
      </button>
      <div class="gasto-info">
        <div class="gasto-descricao" title="${esc(g.descricao)}">${esc(g.descricao)}</div>
        <div class="gasto-meta">${esc(meta)}</div>
      </div>
      <div class="gasto-valor ${isPago ? 'pago' : 'pendente'}">${fmt(g.valor)}</div>
      <div class="gasto-btn-group">
        <button class="btn-icon" title="Editar" aria-label="Editar gasto" data-edit="${g.id}">✏️</button>
        <button class="btn-icon delete" title="Excluir" aria-label="Excluir gasto" data-del="${g.id}">🗑️</button>
      </div>
    `;

    // Status toggle
    div.querySelector('.gasto-status').addEventListener('click', () => toggleGastoStatus(g));
    // Edit
    div.querySelector('[data-edit]').addEventListener('click', () => openGastoModal(g));
    // Delete
    div.querySelector('[data-del]').addEventListener('click', () => confirmDeleteGasto(g.id));

    gastosList.appendChild(div);
  });
}

function fmtDate(d) {
  if (!d) return '';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

function esc(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Toggle payment status ──────────────────────────
async function toggleGastoStatus(g) {
  try {
    const newPago = g.pago ? 0 : 1;
    const today = new Date().toISOString().slice(0,10);
    await req('PUT', `/api/gastos/${g.id}`, {
      pago: newPago,
      data_pagamento: newPago ? today : null,
    });
    toast(newPago ? 'Marcado como pago 🎉' : 'Marcado como pendente');
    await refreshAll();
  } catch (e) { toast(e.message, 'error'); }
}

// ── Refresh everything ─────────────────────────────
async function refreshAll() {
  await loadCategorias();
  if (currentCat) {
    const updated = categorias.find(c => c.id === currentCat.id);
    if (updated) { currentCat = updated; }
    await loadGastos(currentCat.id);
    renderDetailHeader();
  }
}

// ═══ GASTO MODAL ═════════════════════════════════
const gastoModal    = document.getElementById('gastoModal');
const gastoForm     = document.getElementById('gastoForm');

function openGastoModal(g = null) {
  document.getElementById('gastoModalTitle').textContent = g ? 'Editar Gasto' : 'Adicionar Gasto';
  document.getElementById('gastoId').value            = g?.id || '';
  document.getElementById('gastoCategoriaId').value   = currentCat?.id || '';
  document.getElementById('gastoDescricao').value     = g?.descricao || '';
  document.getElementById('gastoValor').value         = g?.valor || '';
  document.getElementById('gastoPago').value          = g?.pago ? '1' : '0';
  document.getElementById('gastoData').value          = g?.data_pagamento || '';
  document.getElementById('gastoNotas').value         = g?.notas || '';
  gastoModal.classList.remove('hidden');
  document.getElementById('gastoDescricao').focus();
}

function closeGastoModal() { gastoModal.classList.add('hidden'); gastoForm.reset(); }

document.getElementById('closeGastoModal').addEventListener('click', closeGastoModal);
document.getElementById('cancelGasto').addEventListener('click', closeGastoModal);
gastoModal.addEventListener('click', e => { if (e.target === gastoModal) closeGastoModal(); });

gastoForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id   = document.getElementById('gastoId').value;
  const catId = document.getElementById('gastoCategoriaId').value;
  const body = {
    categoria_id:   parseInt(catId),
    descricao:      document.getElementById('gastoDescricao').value.trim(),
    valor:          parseFloat(document.getElementById('gastoValor').value),
    pago:           document.getElementById('gastoPago').value === '1',
    data_pagamento: document.getElementById('gastoData').value || null,
    notas:          document.getElementById('gastoNotas').value.trim(),
  };
  if (!body.descricao || isNaN(body.valor)) { toast('Preencha os campos obrigatórios', 'error'); return; }
  try {
    if (id) {
      await req('PUT', `/api/gastos/${id}`, body);
      toast('Gasto atualizado!');
    } else {
      await req('POST', '/api/gastos', body);
      toast('Gasto adicionado! 🎉');
    }
    closeGastoModal();
    await refreshAll();
  } catch (err) { toast(err.message, 'error'); }
});

document.getElementById('btnAddGasto').addEventListener('click', () => openGastoModal());

// ═══ CATEGORY MODAL ════════════════════════════════
const catModal = document.getElementById('catModal');
const catForm  = document.getElementById('catForm');

document.getElementById('btnAddCategory').addEventListener('click', () => {
  catForm.reset();
  document.getElementById('catIcone').value = '💍';
  catModal.classList.remove('hidden');
  document.getElementById('catNome').focus();
});
document.getElementById('closeCatModal').addEventListener('click', () => catModal.classList.add('hidden'));
document.getElementById('cancelCat').addEventListener('click', () => catModal.classList.add('hidden'));
catModal.addEventListener('click', e => { if (e.target === catModal) catModal.classList.add('hidden'); });

catForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const nome = document.getElementById('catNome').value.trim();
  const icone = document.getElementById('catIcone').value.trim() || '💍';
  const orcamento = parseFloat(document.getElementById('catOrcamento').value) || 0;
  if (!nome) { toast('Informe o nome da categoria', 'error'); return; }
  try {
    await req('POST', '/api/categorias', { nome, icone, orcamento });
    toast(`Categoria "${nome}" criada!`);
    catModal.classList.add('hidden');
    catForm.reset();
    await loadCategorias();
  } catch (err) { toast(err.message, 'error'); }
});

// ═══ BUDGET MODAL ══════════════════════════════════
const budgetModal = document.getElementById('budgetModal');
const budgetForm  = document.getElementById('budgetForm');

document.getElementById('btnEditBudget').addEventListener('click', () => {
  if (!currentCat) return;
  document.getElementById('budgetCatId').value = currentCat.id;
  document.getElementById('budgetCatName').textContent = currentCat.nome;
  document.getElementById('budgetValor').value = currentCat.orcamento || '';
  budgetModal.classList.remove('hidden');
  document.getElementById('budgetValor').focus();
});
document.getElementById('closeBudgetModal').addEventListener('click', () => budgetModal.classList.add('hidden'));
document.getElementById('cancelBudget').addEventListener('click', () => budgetModal.classList.add('hidden'));
budgetModal.addEventListener('click', e => { if (e.target === budgetModal) budgetModal.classList.add('hidden'); });

budgetForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id  = document.getElementById('budgetCatId').value;
  const val = parseFloat(document.getElementById('budgetValor').value) || 0;
  try {
    await req('PUT', `/api/categorias/${id}`, { orcamento: val });
    toast('Orçamento atualizado!');
    budgetModal.classList.add('hidden');
    await refreshAll();
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
document.getElementById('confirmDelete').addEventListener('click', async () => {
  if (deleteCallback) await deleteCallback();
  closeConfirm();
});

function confirmDeleteGasto(id) {
  openConfirm('Tem certeza que deseja excluir este gasto? Esta ação não pode ser desfeita.', async () => {
    try {
      await req('DELETE', `/api/gastos/${id}`);
      toast('Gasto excluído');
      await refreshAll();
    } catch (err) { toast(err.message, 'error'); }
  });
}

// ═══ KEYBOARD ══════════════════════════════════════
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (!gastoModal.classList.contains('hidden'))   closeGastoModal();
    else if (!catModal.classList.contains('hidden')) catModal.classList.add('hidden');
    else if (!budgetModal.classList.contains('hidden')) budgetModal.classList.add('hidden');
    else if (!confirmModal.classList.contains('hidden')) closeConfirm();
  }
});

// ═══ INIT ══════════════════════════════════════════
loadCategorias();
