// Interfaz de la app. Patrón simple:
//   1. Hay un "state" (los datos) y un "ui" (qué pantalla/mes/filtro estás viendo).
//   2. render() dibuja todo a partir de esos dos objetos.
//   3. Cuando algo cambia: modificás state/ui, llamás commit() o render().

import * as store from './store.js';
import { uid, esc, parseAmount, money, todayISO, currentMonth, addMonths, monthLabel, dayLabel, variation, PALETTE } from './utils.js';
import { donut } from './charts.js';
import * as monefy from './monefy.js';

let state;
const ui = { tab: 'home', month: currentMonth(), currency: 'ARS', accountId: 'all', homeType: 'expense', filterCat: null, search: '' };

const $app = document.getElementById('app');
const $sheet = document.getElementById('sheet-root');

// ---------- Atajos ----------
const P = () => state.profiles.find((p) => p.id === state.settings.activeProfileId);
const cur = (code) => state.currencies.find((c) => c.code === code) || { code, symbol: code };
const accById = (id) => P().accounts.find((a) => a.id === id);
const catById = (id) => P().categories.find((c) => c.id === id);
const usedCurrencies = () => [...new Set(P().accounts.map((a) => a.currency))];

function commit() {
  store.save(state);
  render();
}

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => (t.hidden = true), 2200);
}

// ---------- Tema claro / oscuro ----------
const mq = matchMedia('(prefers-color-scheme: dark)');
function applyTheme() {
  const pref = state.settings.theme;
  const dark = pref === 'dark' || (pref === 'system' && mq.matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.querySelector('meta[name="theme-color"]').content = dark ? '#111418' : '#f4f5f7';
}
mq.addEventListener?.('change', () => applyTheme());

// ---------- Render principal ----------
function ensureValidUi() {
  const curs = usedCurrencies();
  if (!curs.includes(ui.currency)) ui.currency = curs[0] || 'ARS';
  if (ui.accountId !== 'all') {
    const a = accById(ui.accountId);
    if (!a || a.currency !== ui.currency) ui.accountId = 'all';
  }
  if (ui.filterCat && !catById(ui.filterCat)) ui.filterCat = null;
}

function render() {
  applyTheme();
  ensureValidUi();
  const views = { home: viewHome, tx: viewTx, accounts: viewAccounts, settings: viewSettings };
  $app.innerHTML = `
    ${header()}
    <main class="main">${views[ui.tab]()}</main>
    ${ui.tab === 'home' || ui.tab === 'tx' ? quickButtons() : ''}
    ${tabbar()}`;
}

function header() {
  const p = P();
  const showPeriod = ui.tab === 'home' || ui.tab === 'tx';
  const curs = usedCurrencies();
  const accs = p.accounts.filter((a) => a.currency === ui.currency);
  return `<header class="header">
    <div class="header-row">
      <button class="profile-chip" data-action="pick-profile">${esc(p.emoji)} ${esc(p.name)} <span class="caret">▾</span></button>
      ${showPeriod && curs.length > 1 ? `<div class="pills">${curs.map((c) => `<button class="pill ${c === ui.currency ? 'on' : ''}" data-action="set-currency" data-id="${esc(c)}">${esc(c)}</button>`).join('')}</div>` : ''}
    </div>
    ${showPeriod ? `
    <div class="header-row period">
      <button class="icon-btn" data-action="month" data-n="-1" aria-label="Mes anterior">‹</button>
      <button class="month-label" data-action="month-today">${monthLabel(ui.month)}</button>
      <button class="icon-btn" data-action="month" data-n="1" aria-label="Mes siguiente">›</button>
    </div>
    <select class="acc-filter" data-change="set-account" aria-label="Cuenta">
      <option value="all">Todas las cuentas (${esc(ui.currency)})</option>
      ${accs.map((a) => `<option value="${a.id}" ${a.id === ui.accountId ? 'selected' : ''}>${esc(a.emoji)} ${esc(a.name)}</option>`).join('')}
    </select>` : ''}
  </header>`;
}

function tabbar() {
  const svg = (d) => `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  const tabs = [
    ['home', svg('<path d="M21.2 15.9A10 10 0 1 1 8 2.8"/><path d="M22 12A10 10 0 0 0 12 2v10z"/>'), 'Inicio'],
    ['tx', svg('<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>'), 'Movimientos'],
    ['accounts', svg('<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>'), 'Cuentas'],
    ['settings', svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'), 'Ajustes'],
  ];
  return `<nav class="tabbar">${tabs
    .map(([id, ic, label]) => `<button class="tab ${ui.tab === id ? 'on' : ''}" data-action="tab" data-id="${id}"><span class="tab-ic">${ic}</span>${label}</button>`)
    .join('')}</nav>`;
}

function quickButtons() {
  return `<div class="quick">
    <button class="quick-btn expense" data-action="new-tx" data-type="expense">− Gasto</button>
    <button class="quick-btn income" data-action="new-tx" data-type="income">+ Ingreso</button>
  </div>`;
}

function badge(v, type) {
  if (!v) return '';
  if (v.isNew) return `<span class="badge neutral">nuevo</span>`;
  const r = Math.round(v.pct);
  if (r === 0) return `<span class="badge neutral">= 0%</span>`;
  const up = r > 0;
  const good = type === 'expense' ? !up : up;
  return `<span class="badge ${good ? 'good' : 'bad'}" title="vs. mes anterior">${up ? '▲' : '▼'} ${Math.abs(r)}%</span>`;
}

// ---------- Inicio ----------
function viewHome() {
  const p = P();
  const c = cur(ui.currency);
  const txs = store.monthTx(p, ui.month, ui.currency, ui.accountId);
  const prevTxs = store.monthTx(p, addMonths(ui.month, -1), ui.currency, ui.accountId);
  const sum = (arr, type) => arr.filter((t) => t.type === type).reduce((s, t) => s + t.amount, 0);
  const inc = sum(txs, 'income'), exp = sum(txs, 'expense');
  const pInc = sum(prevTxs, 'income'), pExp = sum(prevTxs, 'expense');
  const type = ui.homeType;

  const totals = store.totalsByCategory(txs, type);
  const prevTotals = store.totalsByCategory(prevTxs, type);
  const total = type === 'expense' ? exp : inc;
  const rows = [...totals.entries()]
    .map(([id, value]) => ({ cat: catById(id) || { id, name: 'Sin categoría', emoji: '❔', color: '#94a3b8' }, value }))
    .sort((a, b) => b.value - a.value);

  const slices = rows.map((r) => ({ id: r.cat.id, label: r.cat.name, color: r.cat.color, value: r.value }));

  return `
  <section class="card summary">
    <div class="sum-item"><span class="muted">Ingresos</span><strong class="pos">${money(inc, c, { compact: true })}</strong>${badge(variation(inc, pInc), 'income')}</div>
    <div class="sum-item"><span class="muted">Gastos</span><strong class="neg">${money(exp, c, { compact: true })}</strong>${badge(variation(exp, pExp), 'expense')}</div>
    <div class="sum-item"><span class="muted">Balance</span><strong class="${inc - exp >= 0 ? 'pos' : 'neg'}">${money(inc - exp, c, { compact: true })}</strong></div>
  </section>

  <section class="card">
    <div class="seg">
      <button class="${type === 'expense' ? 'on' : ''}" data-action="home-type" data-id="expense">Gastos</button>
      <button class="${type === 'income' ? 'on' : ''}" data-action="home-type" data-id="income">Ingresos</button>
    </div>
    <div class="donut-wrap">${donut(slices, money(total, c, { compact: true }), rows.length ? `${rows.length} categoría${rows.length > 1 ? 's' : ''}` : 'Sin movimientos')}</div>
    ${rows.length ? `<ul class="cat-list">
      ${rows.map((r) => `
        <li class="cat-row" data-action="filter-cat" data-id="${esc(r.cat.id)}">
          <span class="cat-ic" style="background:${esc(r.cat.color)}22">${esc(r.cat.emoji)}</span>
          <span class="cat-main">
            <span class="cat-name">${esc(r.cat.name)}</span>
            <span class="bar"><span style="width:${total ? (r.value / total) * 100 : 0}%;background:${esc(r.cat.color)}"></span></span>
          </span>
          <span class="cat-right">
            <strong>${money(r.value, c, { compact: true })}</strong>
            <span class="muted small">${total ? Math.round((r.value / total) * 100) : 0}% ${badge(variation(r.value, prevTotals.get(r.cat.id) || 0), type)}</span>
          </span>
        </li>`).join('')}
    </ul>
    <p class="muted small center">Las flechas comparan con ${monthLabel(addMonths(ui.month, -1)).toLowerCase()}.</p>`
    : `<p class="empty">No hay ${type === 'expense' ? 'gastos' : 'ingresos'} en este mes.<br>Tocá el botón de abajo para cargar uno.</p>`}
  </section>`;
}

// ---------- Movimientos ----------
function viewTx() {
  const p = P();
  const c = cur(ui.currency);
  const q = ui.search.trim().toLowerCase();
  const accIds = new Set(p.accounts.filter((a) => a.currency === ui.currency && (ui.accountId === 'all' || a.id === ui.accountId)).map((a) => a.id));
  let txs = p.transactions.filter((t) => t.date.startsWith(ui.month) && (accIds.has(t.accountId) || accIds.has(t.toAccountId)));
  if (ui.filterCat) txs = txs.filter((t) => t.categoryId === ui.filterCat);
  if (q) txs = txs.filter((t) => (t.note || '').toLowerCase().includes(q) || (catById(t.categoryId)?.name || '').toLowerCase().includes(q));
  txs.sort((a, b) => (b.date + b.createdAt).localeCompare(a.date + a.createdAt) || b.createdAt - a.createdAt);

  const groups = new Map();
  for (const t of txs) {
    if (!groups.has(t.date)) groups.set(t.date, []);
    groups.get(t.date).push(t);
  }
  const fc = ui.filterCat && catById(ui.filterCat);

  return `
  <div class="search-row">
    <input class="input" type="search" placeholder="Buscar por nota o categoría" value="${esc(ui.search)}" data-input="search" />
  </div>
  ${fc ? `<button class="chip" data-action="clear-cat">${esc(fc.emoji)} ${esc(fc.name)} ✕</button>` : ''}
  ${txs.length ? [...groups.entries()].map(([date, list]) => {
      const net = list.reduce((s, t) => s + (t.type === 'income' ? t.amount : t.type === 'expense' ? -t.amount : 0), 0);
      return `<section class="day">
        <div class="day-head"><span>${dayLabel(date)}</span><span class="${net >= 0 ? 'pos' : 'neg'}">${money(net, c)}</span></div>
        <ul class="card tx-list">${list.map(txRow).join('')}</ul>
      </section>`;
    }).join('')
    : `<p class="empty">No hay movimientos${fc || q ? ' con ese filtro' : ' en este mes'}.</p>`}`;
}

function txRow(t) {
  const acc = accById(t.accountId);
  if (t.type === 'transfer') {
    const to = accById(t.toAccountId);
    return `<li class="tx" data-action="edit-tx" data-id="${t.id}">
      <span class="cat-ic" style="background:#64748b22">⇄</span>
      <span class="tx-main"><span>Transferencia</span><span class="muted small">${esc(acc?.name)} → ${esc(to?.name)}${t.note ? ' · ' + esc(t.note) : ''}</span></span>
      <strong>${money(t.amount, cur(acc?.currency))}</strong>
    </li>`;
  }
  const cat = catById(t.categoryId) || { name: 'Sin categoría', emoji: '❔', color: '#94a3b8' };
  return `<li class="tx" data-action="edit-tx" data-id="${t.id}">
    <span class="cat-ic" style="background:${esc(cat.color)}22">${esc(cat.emoji)}</span>
    <span class="tx-main"><span>${esc(cat.name)}</span><span class="muted small">${esc(acc?.name)}${t.note ? ' · ' + esc(t.note) : ''}</span></span>
    <strong class="${t.type === 'income' ? 'pos' : 'neg'}">${t.type === 'income' ? '+' : '−'}${money(t.amount, cur(acc?.currency)).replace('−', '')}</strong>
  </li>`;
}

// ---------- Cuentas ----------
function viewAccounts() {
  const p = P();
  const byCur = new Map();
  for (const a of p.accounts) {
    if (!byCur.has(a.currency)) byCur.set(a.currency, []);
    byCur.get(a.currency).push(a);
  }
  return `
  ${[...byCur.entries()].map(([code, accs]) => {
    const total = accs.reduce((s, a) => s + store.accountBalance(p, a.id), 0);
    return `<section class="card">
      <div class="group-head"><span>${esc(cur(code).name || code)} (${esc(code)})</span><strong>${money(total, cur(code))}</strong></div>
      <ul class="tx-list">${accs.map((a) => {
        const b = store.accountBalance(p, a.id);
        return `<li class="tx" data-action="edit-account" data-id="${a.id}">
          <span class="cat-ic">${esc(a.emoji)}</span>
          <span class="tx-main"><span>${esc(a.name)}</span></span>
          <strong class="${b < 0 ? 'neg' : ''}">${money(b, cur(code))}</strong>
        </li>`;
      }).join('')}</ul>
    </section>`;
  }).join('')}
  <div class="btn-row">
    <button class="btn" data-action="edit-account">+ Nueva cuenta</button>
    <button class="btn" data-action="new-tx" data-type="transfer">⇄ Transferir</button>
  </div>`;
}

// ---------- Ajustes ----------
function viewSettings() {
  const p = P();
  const t = state.settings.theme;
  const nTx = state.profiles.reduce((s, x) => s + x.transactions.length, 0);
  const where = { idb: 'en este dispositivo', local: 'en este dispositivo (modo simple)', memory: 'solo en memoria: se pierde al cerrar' }[store.storageBackend()];
  return `
  <h2 class="sec-title">Perfiles</h2>
  <ul class="card tx-list">
    ${state.profiles.map((x) => `<li class="tx" data-action="edit-profile" data-id="${x.id}">
      <span class="cat-ic">${esc(x.emoji)}</span>
      <span class="tx-main"><span>${esc(x.name)}</span><span class="muted small">${x.accounts.length} cuentas · ${x.transactions.length} movimientos</span></span>
      ${x.id === p.id ? '<span class="badge good">activo</span>' : ''}
    </li>`).join('')}
  </ul>
  <button class="btn" data-action="edit-profile">+ Nuevo perfil</button>

  <h2 class="sec-title">Personalizar (${esc(p.name)})</h2>
  <ul class="card tx-list">
    <li class="tx" data-action="manage-cats"><span class="cat-ic">🏷️</span><span class="tx-main"><span>Categorías</span><span class="muted small">${p.categories.length} categorías</span></span><span class="muted">›</span></li>
    <li class="tx" data-action="manage-currencies"><span class="cat-ic">💱</span><span class="tx-main"><span>Monedas</span><span class="muted small">${state.currencies.map((c) => c.code).join(', ')}</span></span><span class="muted">›</span></li>
  </ul>

  <h2 class="sec-title">Apariencia</h2>
  <div class="seg">
    ${[['light', 'Claro'], ['dark', 'Oscuro'], ['system', 'Automático']].map(([id, l]) => `<button class="${t === id ? 'on' : ''}" data-action="theme" data-id="${id}">${l}</button>`).join('')}
  </div>

  <h2 class="sec-title">Datos</h2>
  <ul class="card tx-list">
    <li class="tx" data-action="export-json"><span class="cat-ic">💾</span><span class="tx-main"><span>Exportar respaldo</span><span class="muted small">Todos los perfiles, en un archivo .json</span></span></li>
    <li class="tx" data-action="import-json"><span class="cat-ic">📂</span><span class="tx-main"><span>Importar respaldo</span><span class="muted small">Reemplaza los datos actuales</span></span></li>
    <li class="tx" data-action="import-monefy"><span class="cat-ic">📥</span><span class="tx-main"><span>Importar desde Monefy</span><span class="muted small">Archivo .csv exportado de Monefy, al perfil ${esc(p.name)}</span></span></li>
    <li class="tx" data-action="export-csv"><span class="cat-ic">📊</span><span class="tx-main"><span>Exportar a Excel (CSV)</span><span class="muted small">Movimientos de ${esc(p.name)}</span></span></li>
  </ul>
  <input type="file" id="import-file" accept=".json,application/json" hidden />
  <input type="file" id="monefy-file" accept=".csv,text/csv,text/comma-separated-values" hidden />
  <p class="muted small center">${nTx} movimientos guardados ${where}.<br>Hacé un respaldo cada tanto: si borrás la app, se borran los datos.</p>`;
}

// ---------- Hojas (paneles que suben desde abajo) ----------
function openSheet(title, body, onMount) {
  $sheet.innerHTML = `<div class="backdrop" data-action="close-sheet"></div>
    <div class="sheet" role="dialog" aria-label="${esc(title)}">
      <div class="sheet-head"><h3>${esc(title)}</h3><button class="icon-btn" data-action="close-sheet" aria-label="Cerrar">✕</button></div>
      <div class="sheet-body">${body}</div>
    </div>`;
  document.body.classList.add('no-scroll');
  onMount?.($sheet.querySelector('.sheet'));
}
function closeSheet() {
  $sheet.innerHTML = '';
  document.body.classList.remove('no-scroll');
}

const EMOJIS = ['🍔', '🛒', '🚌', '🚗', '⛽', '🏠', '💡', '📱', '💊', '🏥', '👕', '🎉', '🍺', '☕', '🎬', '🎮', '📚', '🎓', '🎁', '🐾', '✈️', '🏋️', '💇', '🧾', '💳', '🏦', '💵', '💼', '💻', '🏷️', '📈', '💰', '👶', '🔧', '📦', '❤️'];

function emojiColorFields(emoji, color) {
  return `
  <label class="field"><span>Ícono</span>
    <input class="input emoji-input" name="emoji" value="${esc(emoji)}" maxlength="4" required />
  </label>
  <div class="emoji-grid">${EMOJIS.map((e) => `<button type="button" class="emoji-opt" data-emoji="${e}">${e}</button>`).join('')}</div>
  ${color !== undefined ? `<div class="field"><span>Color</span><div class="swatches">
    ${PALETTE.map((c) => `<label class="swatch" style="background:${c}"><input type="radio" name="color" value="${c}" ${c === color ? 'checked' : ''}/></label>`).join('')}
  </div></div>` : ''}`;
}
function wireEmojiGrid(el) {
  el.querySelectorAll('.emoji-opt').forEach((b) =>
    b.addEventListener('click', () => (el.querySelector('[name=emoji]').value = b.dataset.emoji))
  );
}

// --- Movimiento ---
function openTxSheet(draft) {
  const p = P();
  const isEdit = !!draft.id;
  const type = draft.type;
  const accOpts = (sel) => p.accounts.map((a) => `<option value="${a.id}" ${a.id === sel ? 'selected' : ''}>${esc(a.emoji)} ${esc(a.name)} (${esc(a.currency)})</option>`).join('');
  const defaultAcc = draft.accountId || (ui.accountId !== 'all' ? ui.accountId : p.accounts.find((a) => a.currency === ui.currency)?.id) || p.accounts[0].id;
  const acc = accById(defaultAcc);
  const cats = p.categories.filter((c) => c.type === type);
  const toAcc = draft.toAccountId || p.accounts.find((a) => a.id !== defaultAcc)?.id;

  const body = `<form id="tx-form" class="form" novalidate>
    <div class="seg">
      ${[['expense', 'Gasto'], ['income', 'Ingreso'], ['transfer', 'Transferencia']].map(([id, l]) => `<button type="button" class="${type === id ? 'on' : ''}" data-type="${id}">${l}</button>`).join('')}
    </div>
    <label class="amount ${type}">
      <span class="amount-sym" id="sym">${esc(cur(acc.currency).symbol)}</span>
      <input name="amount" inputmode="decimal" autocomplete="off" placeholder="0" value="${draft.amount != null ? String(draft.amount).replace('.', ',') : ''}" />
    </label>
    ${type === 'transfer' ? `
      <label class="field"><span>Desde</span><select class="input" name="accountId">${accOpts(defaultAcc)}</select></label>
      <label class="field"><span>Hacia</span><select class="input" name="toAccountId">${accOpts(toAcc)}</select></label>
      <label class="field" id="to-amount-field" hidden><span>Monto que llega (otra moneda)</span>
        <input class="input" name="toAmount" inputmode="decimal" value="${draft.toAmount != null ? String(draft.toAmount).replace('.', ',') : ''}" /></label>
    ` : `
      <label class="field"><span>Cuenta</span><select class="input" name="accountId">${accOpts(defaultAcc)}</select></label>
      <div class="field"><span>Categoría</span>
        <div class="cat-grid">${cats.map((c) => `<label class="cat-opt">
          <input type="radio" name="categoryId" value="${c.id}" ${c.id === draft.categoryId ? 'checked' : ''}/>
          <span class="cat-ic" style="background:${esc(c.color)}22">${esc(c.emoji)}</span><span class="cat-opt-name">${esc(c.name)}</span>
        </label>`).join('')}</div>
      </div>`}
    <div class="two">
      <label class="field"><span>Fecha</span><input class="input" type="date" name="date" value="${esc(draft.date || todayISO())}" required /></label>
      <label class="field"><span>Nota</span><input class="input" name="note" value="${esc(draft.note || '')}" placeholder="Opcional" maxlength="120" /></label>
    </div>
    <p class="form-error" id="tx-error" hidden></p>
    <button class="btn primary" type="submit">${isEdit ? 'Guardar cambios' : 'Guardar'}</button>
    ${isEdit ? `<button class="btn danger" type="button" id="tx-delete">Eliminar movimiento</button>` : ''}
  </form>`;

  const title = isEdit ? 'Editar movimiento' : { expense: 'Nuevo gasto', income: 'Nuevo ingreso', transfer: 'Transferencia' }[type];
  openSheet(title, body, (el) => {
    const f = el.querySelector('#tx-form');
    const read = () => ({
      ...draft,
      amount: parseAmount(f.amount.value),
      accountId: f.accountId.value,
      toAccountId: f.toAccountId?.value,
      toAmount: f.toAmount ? parseAmount(f.toAmount.value) : undefined,
      categoryId: f.querySelector('[name=categoryId]:checked')?.value,
      date: f.date.value,
      note: f.note.value.trim(),
    });
    const syncCurrency = () => {
      const a = accById(f.accountId.value);
      el.querySelector('#sym').textContent = cur(a.currency).symbol;
      if (f.toAccountId) {
        const b = accById(f.toAccountId.value);
        el.querySelector('#to-amount-field').hidden = a.currency === b.currency;
      }
    };
    f.accountId.addEventListener('change', syncCurrency);
    f.toAccountId?.addEventListener('change', syncCurrency);
    syncCurrency();

    el.querySelectorAll('.seg [data-type]').forEach((b) =>
      b.addEventListener('click', () => {
        const d = read();
        if (!Number.isFinite(d.amount)) d.amount = null;
        openTxSheet({ ...d, type: b.dataset.type, categoryId: undefined });
      })
    );
    if (!isEdit) setTimeout(() => f.amount.focus(), 250);

    f.addEventListener('submit', (e) => {
      e.preventDefault();
      const d = read();
      const err = (m) => { const x = el.querySelector('#tx-error'); x.textContent = m; x.hidden = false; };
      if (!(d.amount > 0)) return err('Poné un monto mayor a cero.');
      if (!d.date) return err('Elegí una fecha.');
      const tx = { id: d.id || uid(), type, amount: d.amount, accountId: d.accountId, date: d.date, note: d.note, createdAt: d.createdAt || Date.now() };
      if (type === 'transfer') {
        if (d.accountId === d.toAccountId) return err('Elegí dos cuentas distintas.');
        tx.toAccountId = d.toAccountId;
        const diff = accById(d.accountId).currency !== accById(d.toAccountId).currency;
        if (diff) {
          if (!(d.toAmount > 0)) return err('Poné cuánto llega en la otra moneda.');
          tx.toAmount = d.toAmount;
        }
      } else {
        if (!d.categoryId) return err('Elegí una categoría.');
        tx.categoryId = d.categoryId;
      }
      const i = p.transactions.findIndex((t) => t.id === tx.id);
      if (i >= 0) p.transactions[i] = tx; else p.transactions.push(tx);
      closeSheet();
      commit();
      toast(isEdit ? 'Cambios guardados' : 'Movimiento guardado');
    });

    el.querySelector('#tx-delete')?.addEventListener('click', () => {
      if (!confirm('¿Eliminar este movimiento?')) return;
      p.transactions = p.transactions.filter((t) => t.id !== draft.id);
      closeSheet();
      commit();
      toast('Movimiento eliminado');
    });
  });
}

// --- Cuenta ---
function openAccountSheet(acc) {
  const p = P();
  const isEdit = !!acc;
  acc = acc || { emoji: '💳', name: '', currency: ui.currency, initial: 0 };
  const n = isEdit ? p.transactions.filter((t) => t.accountId === acc.id || t.toAccountId === acc.id).length : 0;
  openSheet(isEdit ? 'Editar cuenta' : 'Nueva cuenta', `<form class="form" id="acc-form">
    <label class="field"><span>Nombre</span><input class="input" name="name" value="${esc(acc.name)}" required maxlength="40" placeholder="Ej: Billetera, Banco Nación" /></label>
    <label class="field"><span>Moneda</span><select class="input" name="currency">
      ${state.currencies.map((c) => `<option value="${esc(c.code)}" ${c.code === acc.currency ? 'selected' : ''}>${esc(c.code)} · ${esc(c.name)}</option>`).join('')}
    </select></label>
    <label class="field"><span>Saldo inicial</span><input class="input" name="initial" inputmode="decimal" value="${String(acc.initial || 0).replace('.', ',')}" /></label>
    ${emojiColorFields(acc.emoji)}
    <button class="btn primary" type="submit">Guardar</button>
    ${isEdit ? `<button class="btn danger" type="button" id="acc-delete">Eliminar cuenta${n ? ` y sus ${n} movimientos` : ''}</button>` : ''}
  </form>`, (el) => {
    wireEmojiGrid(el);
    const f = el.querySelector('#acc-form');
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      const initial = parseAmount(f.initial.value);
      const data = { name: f.name.value.trim(), currency: f.currency.value, initial: Number.isFinite(initial) ? initial : 0, emoji: f.emoji.value.trim() || '💳' };
      if (!data.name) return;
      if (isEdit) Object.assign(acc, data); else p.accounts.push({ id: uid(), ...data });
      closeSheet(); commit(); toast('Cuenta guardada');
    });
    el.querySelector('#acc-delete')?.addEventListener('click', () => {
      if (p.accounts.length === 1) return alert('Tiene que quedar al menos una cuenta.');
      if (!confirm(n ? `Se van a borrar ${n} movimientos de esta cuenta. ¿Seguro?` : '¿Eliminar esta cuenta?')) return;
      p.accounts = p.accounts.filter((a) => a.id !== acc.id);
      p.transactions = p.transactions.filter((t) => t.accountId !== acc.id && t.toAccountId !== acc.id);
      closeSheet(); commit(); toast('Cuenta eliminada');
    });
  });
}

// --- Categorías ---
function openCategoriesManager(type = 'expense') {
  const p = P();
  const cats = p.categories.filter((c) => c.type === type);
  openSheet('Categorías', `
    <div class="seg">
      <button class="${type === 'expense' ? 'on' : ''}" data-cats="expense">Gastos</button>
      <button class="${type === 'income' ? 'on' : ''}" data-cats="income">Ingresos</button>
    </div>
    <ul class="tx-list">${cats.map((c) => `<li class="tx" data-cat="${c.id}">
      <span class="cat-ic" style="background:${esc(c.color)}22">${esc(c.emoji)}</span>
      <span class="tx-main"><span>${esc(c.name)}</span></span><span class="dot" style="background:${esc(c.color)}"></span>
    </li>`).join('')}</ul>
    <button class="btn" data-newcat>+ Nueva categoría</button>`, (el) => {
    el.querySelectorAll('[data-cats]').forEach((b) => b.addEventListener('click', () => openCategoriesManager(b.dataset.cats)));
    el.querySelectorAll('[data-cat]').forEach((li) => li.addEventListener('click', () => openCategorySheet(catById(li.dataset.cat), type)));
    el.querySelector('[data-newcat]').addEventListener('click', () => openCategorySheet(null, type));
  });
}

function openCategorySheet(cat, type) {
  const p = P();
  const isEdit = !!cat;
  cat = cat || { name: '', emoji: '🏷️', color: PALETTE[Math.floor(Math.random() * PALETTE.length)], type };
  const n = isEdit ? p.transactions.filter((t) => t.categoryId === cat.id).length : 0;
  const others = p.categories.filter((c) => c.type === cat.type && c.id !== cat.id);
  openSheet(isEdit ? 'Editar categoría' : 'Nueva categoría', `<form class="form" id="cat-form">
    <label class="field"><span>Nombre</span><input class="input" name="name" value="${esc(cat.name)}" required maxlength="30" /></label>
    ${emojiColorFields(cat.emoji, cat.color)}
    <button class="btn primary" type="submit">Guardar</button>
    ${isEdit ? `
      ${n ? `<label class="field"><span>Al eliminar, mover sus ${n} movimientos a</span><select class="input" name="moveTo">
        ${others.map((o) => `<option value="${o.id}">${esc(o.emoji)} ${esc(o.name)}</option>`).join('')}</select></label>` : ''}
      <button class="btn danger" type="button" id="cat-delete">Eliminar categoría</button>` : ''}
  </form>`, (el) => {
    wireEmojiGrid(el);
    const f = el.querySelector('#cat-form');
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      const data = { name: f.name.value.trim(), emoji: f.emoji.value.trim() || '🏷️', color: f.querySelector('[name=color]:checked')?.value || cat.color };
      if (!data.name) return;
      if (isEdit) Object.assign(cat, data); else p.categories.push({ id: uid(), type: cat.type, ...data });
      store.save(state);
      openCategoriesManager(cat.type);
      render();
    });
    el.querySelector('#cat-delete')?.addEventListener('click', () => {
      if (!others.length) return alert('Tiene que quedar al menos una categoría de este tipo.');
      if (!confirm('¿Eliminar esta categoría?')) return;
      if (n) {
        const to = f.moveTo.value;
        p.transactions.forEach((t) => { if (t.categoryId === cat.id) t.categoryId = to; });
      }
      p.categories = p.categories.filter((c) => c.id !== cat.id);
      store.save(state);
      openCategoriesManager(cat.type);
      render();
    });
  });
}

// --- Monedas ---
function openCurrencies() {
  const inUse = new Set(state.profiles.flatMap((p) => p.accounts.map((a) => a.currency)));
  openSheet('Monedas', `
    <ul class="tx-list">${state.currencies.map((c) => `<li class="tx">
      <span class="cat-ic">${esc(c.symbol)}</span>
      <span class="tx-main"><span>${esc(c.code)} · ${esc(c.name)}</span>${inUse.has(c.code) ? '<span class="muted small">En uso</span>' : ''}</span>
      ${inUse.has(c.code) ? '' : `<button class="icon-btn" data-delcur="${esc(c.code)}" aria-label="Eliminar">🗑</button>`}
    </li>`).join('')}</ul>
    <form class="form" id="cur-form">
      <h4>Agregar moneda</h4>
      <div class="three">
        <label class="field"><span>Código</span><input class="input" name="code" placeholder="USDT" maxlength="6" required /></label>
        <label class="field"><span>Símbolo</span><input class="input" name="symbol" placeholder="₮" maxlength="4" required /></label>
        <label class="field"><span>Nombre</span><input class="input" name="name" placeholder="Tether" maxlength="24" required /></label>
      </div>
      <button class="btn primary" type="submit">Agregar</button>
      <p class="muted small">Para usar una moneda, creá una cuenta en esa moneda desde "Cuentas".</p>
    </form>`, (el) => {
    el.querySelectorAll('[data-delcur]').forEach((b) => b.addEventListener('click', () => {
      state.currencies = state.currencies.filter((c) => c.code !== b.dataset.delcur);
      store.save(state); openCurrencies(); render();
    }));
    el.querySelector('#cur-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const f = e.target;
      const code = f.code.value.trim().toUpperCase();
      if (!code || state.currencies.some((c) => c.code === code)) return alert('Esa moneda ya existe.');
      state.currencies.push({ code, symbol: f.symbol.value.trim(), name: f.name.value.trim() });
      store.save(state); openCurrencies(); render();
    });
  });
}

// --- Perfiles ---
function openProfilePicker() {
  openSheet('Cambiar de perfil', `<ul class="tx-list">
    ${state.profiles.map((x) => `<li class="tx" data-pid="${x.id}"><span class="cat-ic">${esc(x.emoji)}</span>
      <span class="tx-main"><span>${esc(x.name)}</span></span>${x.id === P().id ? '<span class="badge good">activo</span>' : ''}</li>`).join('')}
  </ul><button class="btn" data-newprofile>+ Nuevo perfil</button>`, (el) => {
    el.querySelectorAll('[data-pid]').forEach((li) => li.addEventListener('click', () => {
      state.settings.activeProfileId = li.dataset.pid;
      ui.accountId = 'all'; ui.filterCat = null;
      closeSheet(); commit();
    }));
    el.querySelector('[data-newprofile]').addEventListener('click', () => openProfileSheet(null));
  });
}

function openProfileSheet(profile) {
  const isEdit = !!profile;
  const pr = profile || { name: '', emoji: '💼' };
  openSheet(isEdit ? 'Editar perfil' : 'Nuevo perfil', `<form class="form" id="prof-form">
    <label class="field"><span>Nombre</span><input class="input" name="name" value="${esc(pr.name)}" required maxlength="30" placeholder="Ej: Personal, Empresa" /></label>
    ${emojiColorFields(pr.emoji)}
    <p class="muted small">Cada perfil tiene sus propias cuentas, categorías y movimientos.</p>
    <button class="btn primary" type="submit">Guardar</button>
    ${isEdit && profile.id !== P().id ? `<button class="btn" type="button" id="prof-use">Usar este perfil</button>` : ''}
    ${isEdit ? `<button class="btn danger" type="button" id="prof-delete">Eliminar perfil</button>` : ''}
  </form>`, (el) => {
    wireEmojiGrid(el);
    const f = el.querySelector('#prof-form');
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = f.name.value.trim();
      if (!name) return;
      const emoji = f.emoji.value.trim() || '🙂';
      if (isEdit) Object.assign(profile, { name, emoji });
      else {
        const np = store.newProfile(name, emoji, false);
        state.profiles.push(np);
        state.settings.activeProfileId = np.id;
      }
      closeSheet(); commit(); toast(isEdit ? 'Perfil guardado' : `Perfil "${name}" creado`);
    });
    el.querySelector('#prof-use')?.addEventListener('click', () => {
      state.settings.activeProfileId = profile.id;
      closeSheet(); commit();
    });
    el.querySelector('#prof-delete')?.addEventListener('click', () => {
      if (state.profiles.length === 1) return alert('Tiene que quedar al menos un perfil.');
      if (!confirm(`Se borra "${profile.name}" con todos sus movimientos. ¿Seguro?`)) return;
      state.profiles = state.profiles.filter((x) => x.id !== profile.id);
      if (state.settings.activeProfileId === profile.id) state.settings.activeProfileId = state.profiles[0].id;
      closeSheet(); commit(); toast('Perfil eliminado');
    });
  });
}

// ---------- Exportar / importar ----------
async function shareOrDownload(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const file = new File([blob], filename, { type: mime });
  const mobile = matchMedia('(pointer: coarse)').matches;
  if (mobile && navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: filename }); return; }
    catch (e) { if (e.name === 'AbortError') return; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

function exportJSON() {
  shareOrDownload(`finanzas-respaldo-${todayISO()}.json`, JSON.stringify(state, null, 2), 'application/json');
}

function exportCSV() {
  const p = P();
  const q = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`;
  const num = (n) => String(n).replace('.', ',');
  const rows = [['Fecha', 'Tipo', 'Cuenta', 'Categoría', 'Monto', 'Moneda', 'Cuenta destino', 'Monto destino', 'Nota']];
  const tipo = { expense: 'Gasto', income: 'Ingreso', transfer: 'Transferencia' };
  for (const t of [...p.transactions].sort((a, b) => a.date.localeCompare(b.date))) {
    const a = accById(t.accountId), b = t.toAccountId ? accById(t.toAccountId) : null;
    rows.push([t.date, tipo[t.type], a?.name, catById(t.categoryId)?.name || '', num(t.amount), a?.currency, b?.name || '', b ? num(t.toAmount ?? t.amount) : '', t.note]);
  }
  const csv = '﻿' + rows.map((r) => r.map(q).join(';')).join('\r\n');
  shareOrDownload(`finanzas-${p.name.replace(/\W+/g, '_')}-${todayISO()}.csv`, csv, 'text/csv');
}

async function importJSON(file) {
  try {
    const s = store.validateState(JSON.parse(await file.text()));
    const n = s.profiles.reduce((a, p) => a + p.transactions.length, 0);
    if (!confirm(`El respaldo tiene ${s.profiles.length} perfil(es) y ${n} movimientos. Esto REEMPLAZA lo que tenés ahora. ¿Seguir?`)) return;
    state = s;
    commit();
    toast('Respaldo importado');
  } catch (e) {
    alert('No se pudo importar: ' + e.message);
  }
}

async function importMonefy(file) {
  const p = P();
  let plan;
  try {
    plan = monefy.analyze(await file.text(), p, state.currencies);
  } catch (e) {
    return alert('No se pudo leer el archivo: ' + e.message);
  }
  const fmt = (iso) => iso.split('-').reverse().join('/');
  const lista = (arr) => arr.map((x) => esc(x.name || x)).join(', ');
  const body = `<div class="form">
    <div class="card import-box">
      <p><strong>${plan.total.toLocaleString('es-AR')}</strong> movimientos encontrados<br>
      <span class="muted small">del ${fmt(plan.desde)} al ${fmt(plan.hasta)} · ${plan.gastos.toLocaleString('es-AR')} gastos y ${plan.ingresos.toLocaleString('es-AR')} ingresos</span></p>
      ${plan.repetidos ? `<p class="small">${plan.repetidos.toLocaleString('es-AR')} ya estaban cargados y se van a saltear.</p>` : ''}
      ${plan.errores.length ? `<p class="small neg">${plan.errores.length} filas no se pudieron leer (filas ${plan.errores.slice(0, 5).join(', ')}${plan.errores.length > 5 ? '…' : ''}).</p>` : ''}
      ${plan.nuevasCats.length ? `<p class="small"><strong>Categorías nuevas:</strong> ${lista(plan.nuevasCats)}</p>` : ''}
      ${plan.nuevasCuentas.length ? `<p class="small"><strong>Cuentas nuevas:</strong> ${lista(plan.nuevasCuentas)}</p>` : ''}
      ${plan.nuevasMonedas.length ? `<p class="small"><strong>Monedas nuevas:</strong> ${lista(plan.nuevasMonedas)}</p>` : ''}
    </div>
    ${plan.sinUso.length ? `<label class="check"><input type="checkbox" id="del-unused" checked />
      <span>Borrar las categorías que no uso<br><span class="muted small">${lista(plan.sinUso)}</span></span></label>` : ''}
    <button class="btn primary" id="do-import" ${plan.items.length ? '' : 'disabled'}>${plan.items.length ? `Importar ${plan.items.length.toLocaleString('es-AR')} movimientos a "${esc(p.name)}"` : 'No hay nada nuevo para importar'}</button>
  </div>`;
  openSheet('Importar desde Monefy', body, (el) => {
    el.querySelector('#do-import').addEventListener('click', () => {
      const n = monefy.apply(plan, p, state, { borrarSinUso: !!el.querySelector('#del-unused')?.checked });
      closeSheet();
      ui.month = plan.hasta.slice(0, 7);
      ui.tab = 'home';
      commit();
      toast(`${n.toLocaleString('es-AR')} movimientos importados`);
    });
  });
}

// ---------- Eventos (un solo listener para todos los botones) ----------
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const { action, id } = el.dataset;
  const p = P();
  switch (action) {
    case 'tab': ui.tab = id; window.scrollTo(0, 0); render(); break;
    case 'month': ui.month = addMonths(ui.month, Number(el.dataset.n)); render(); break;
    case 'month-today': ui.month = currentMonth(); render(); break;
    case 'set-currency': ui.currency = id; ui.accountId = 'all'; render(); break;
    case 'home-type': ui.homeType = id; render(); break;
    case 'filter-cat': ui.filterCat = id; ui.tab = 'tx'; render(); break;
    case 'clear-cat': ui.filterCat = null; render(); break;
    case 'new-tx': openTxSheet({ type: el.dataset.type }); break;
    case 'edit-tx': openTxSheet({ ...p.transactions.find((t) => t.id === id) }); break;
    case 'edit-account': openAccountSheet(id ? accById(id) : null); break;
    case 'manage-cats': openCategoriesManager(); break;
    case 'manage-currencies': openCurrencies(); break;
    case 'pick-profile': openProfilePicker(); break;
    case 'edit-profile': openProfileSheet(id ? state.profiles.find((x) => x.id === id) : null); break;
    case 'theme': state.settings.theme = id; commit(); break;
    case 'export-json': exportJSON(); break;
    case 'export-csv': exportCSV(); break;
    case 'import-json': document.getElementById('import-file').click(); break;
    case 'import-monefy': document.getElementById('monefy-file').click(); break;
    case 'close-sheet': closeSheet(); break;
  }
});

document.addEventListener('change', (e) => {
  if (e.target.dataset.change === 'set-account') { ui.accountId = e.target.value; render(); }
  if (e.target.id === 'import-file' && e.target.files[0]) importJSON(e.target.files[0]);
  if (e.target.id === 'monefy-file' && e.target.files[0]) importMonefy(e.target.files[0]);
  if (e.target.type === 'file') e.target.value = '';
});

document.addEventListener('input', (e) => {
  if (e.target.dataset.input === 'search') {
    ui.search = e.target.value;
    const pos = e.target.selectionStart;
    render();
    const s = document.querySelector('[data-input=search]');
    s.focus(); s.setSelectionRange(pos, pos);
  }
});

document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSheet(); });

// ---------- Arranque ----------
(async function start() {
  state = await store.load();
  const fresh = state.profiles.length === 1 && !state.profiles[0].transactions.length;
  if (fresh && new URLSearchParams(location.search).has('demo')) {
    store.sampleTransactions(state.profiles[0]);
    store.save(state);
  }
  render();
  store.askPersist();
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
