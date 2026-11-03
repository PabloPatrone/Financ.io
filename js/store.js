// Todo lo que tiene que ver con guardar y leer datos.
// La app guarda UN objeto "state" con todo adentro, en IndexedDB del navegador.
// Si IndexedDB no está, usa localStorage; si tampoco, queda en memoria.

import { uid, todayISO } from './utils.js';

const DB_NAME = 'mis-finanzas';
const KEY = 'state';

export const DEFAULT_CURRENCIES = [
  { code: 'ARS', symbol: '$', name: 'Peso argentino' },
  { code: 'USD', symbol: 'US$', name: 'Dólar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'BRL', symbol: 'R$', name: 'Real' },
];

const CAT_GASTO = [
  ['Comida', '🍔', '#f97316'], ['Supermercado', '🛒', '#22c55e'], ['Transporte', '🚌', '#3b82f6'],
  ['Casa', '🏠', '#8b5cf6'], ['Servicios', '💡', '#eab308'], ['Salud', '💊', '#ef4444'],
  ['Ropa', '👕', '#ec4899'], ['Salidas', '🎉', '#d946ef'], ['Educación', '📚', '#06b6d4'],
  ['Regalos', '🎁', '#f59e0b'], ['Mascotas', '🐾', '#84cc16'], ['Otros', '📦', '#64748b'],
];
const CAT_INGRESO = [
  ['Sueldo', '💼', '#10b981'], ['Freelance', '💻', '#14b8a6'], ['Ventas', '🏷️', '#6366f1'],
  ['Regalos', '🎁', '#f59e0b'], ['Otros', '💰', '#64748b'],
];

export function defaultCategories() {
  return [
    ...CAT_GASTO.map(([name, emoji, color]) => ({ id: uid(), type: 'expense', name, emoji, color })),
    ...CAT_INGRESO.map(([name, emoji, color]) => ({ id: uid(), type: 'income', name, emoji, color })),
  ];
}

export function newProfile(name = 'Personal', emoji = '🙂', withAccounts = true) {
  return {
    id: uid(),
    name,
    emoji,
    accounts: withAccounts
      ? [
          { id: uid(), name: 'Efectivo', emoji: '💵', currency: 'ARS', initial: 0 },
          { id: uid(), name: 'Mercado Pago', emoji: '📱', currency: 'ARS', initial: 0 },
          { id: uid(), name: 'Banco', emoji: '🏦', currency: 'ARS', initial: 0 },
        ]
      : [{ id: uid(), name: 'Efectivo', emoji: '💵', currency: 'ARS', initial: 0 }],
    categories: defaultCategories(),
    transactions: [],
  };
}

export function freshState() {
  const p = newProfile();
  return {
    version: 1,
    settings: { theme: 'system', activeProfileId: p.id },
    currencies: DEFAULT_CURRENCIES.map((c) => ({ ...c })),
    profiles: [p],
  };
}

// Revisa que un objeto importado tenga la forma correcta.
export function validateState(s) {
  if (!s || typeof s !== 'object') throw new Error('El archivo no es un respaldo válido.');
  if (!Array.isArray(s.profiles) || !s.profiles.length) throw new Error('El respaldo no tiene perfiles.');
  if (!Array.isArray(s.currencies)) s.currencies = DEFAULT_CURRENCIES.map((c) => ({ ...c }));
  s.settings = s.settings || {};
  for (const p of s.profiles) {
    if (!p.id || !Array.isArray(p.accounts) || !Array.isArray(p.categories) || !Array.isArray(p.transactions))
      throw new Error('Hay un perfil con datos incompletos.');
  }
  if (!s.profiles.some((p) => p.id === s.settings.activeProfileId)) s.settings.activeProfileId = s.profiles[0].id;
  s.settings.theme = s.settings.theme || 'system';
  s.version = 1;
  return s;
}

// ---------- Persistencia ----------
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore('kv');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

let db = null;
let backend = 'memory';

export async function load() {
  try {
    db = await openDB();
    backend = 'idb';
    const s = await new Promise((resolve, reject) => {
      const r = db.transaction('kv').objectStore('kv').get(KEY);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    if (s) return validateState(s);
  } catch {
    db = null;
    try {
      localStorage.setItem('__t', '1');
      localStorage.removeItem('__t');
      backend = 'local';
      const raw = localStorage.getItem(DB_NAME);
      if (raw) return validateState(JSON.parse(raw));
    } catch {
      backend = 'memory';
    }
  }
  return freshState();
}

let pending = null;
export function save(state) {
  // Junta varios guardados seguidos en uno solo.
  clearTimeout(pending);
  pending = setTimeout(() => {
    try {
      if (backend === 'idb' && db) {
        db.transaction('kv', 'readwrite').objectStore('kv').put(state, KEY);
      } else if (backend === 'local') {
        localStorage.setItem(DB_NAME, JSON.stringify(state));
      }
    } catch (e) {
      console.error('No se pudo guardar', e);
    }
  }, 150);
}

export const storageBackend = () => backend;

// Le pide al navegador que no borre los datos si se queda sin espacio.
export async function askPersist() {
  try {
    if (navigator.storage?.persist) return await navigator.storage.persist();
  } catch {}
  return false;
}

// ---------- Cálculos ----------
export function accountBalance(profile, accId) {
  const acc = profile.accounts.find((a) => a.id === accId);
  let b = acc ? Number(acc.initial) || 0 : 0;
  for (const t of profile.transactions) {
    if (t.type === 'expense' && t.accountId === accId) b -= t.amount;
    else if (t.type === 'income' && t.accountId === accId) b += t.amount;
    else if (t.type === 'transfer') {
      if (t.accountId === accId) b -= t.amount;
      if (t.toAccountId === accId) b += t.toAmount ?? t.amount;
    }
  }
  return Math.round(b * 100) / 100;
}

// Movimientos de un mes, filtrados por moneda y (opcional) cuenta.
export function monthTx(profile, month, currency, accountId = 'all') {
  const accIds = new Set(
    profile.accounts.filter((a) => a.currency === currency && (accountId === 'all' || a.id === accountId)).map((a) => a.id)
  );
  return profile.transactions.filter((t) => t.date.startsWith(month) && accIds.has(t.accountId) && t.type !== 'transfer');
}

export function totalsByCategory(txs, type) {
  const m = new Map();
  for (const t of txs) if (t.type === type) m.set(t.categoryId, (m.get(t.categoryId) || 0) + t.amount);
  return m;
}

export const sampleTransactions = (profile) => {
  // Solo para la demo: mete algunos movimientos de ejemplo.
  const [efe, mp] = profile.accounts;
  const cat = (n, type = 'expense') => profile.categories.find((c) => c.name === n && c.type === type).id;
  const t = todayISO();
  const mes = t.slice(0, 7);
  const [y, m] = mes.split('-').map(Number);
  const prev = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
  const d = (mk, day) => `${mk}-${String(Math.min(day, Number(t.slice(8)) || 28)).padStart(2, '0')}`;
  const rows = [
    [prev, 1, 'income', 'Sueldo', mp, 950000, 'Sueldo octubre'],
    [prev, 3, 'expense', 'Supermercado', mp, 82000, 'Coto'],
    [prev, 8, 'expense', 'Comida', efe, 24000, 'Pizza'],
    [prev, 12, 'expense', 'Transporte', mp, 18000, 'SUBE'],
    [prev, 15, 'expense', 'Servicios', mp, 45000, 'Luz + internet'],
    [prev, 20, 'expense', 'Salidas', efe, 30000, 'Cumple'],
    [mes, 1, 'income', 'Sueldo', mp, 950000, 'Sueldo noviembre'],
    [mes, 1, 'expense', 'Supermercado', mp, 96500, 'Carrefour'],
    [mes, 1, 'expense', 'Comida', efe, 15500, 'Café y medialunas'],
    [mes, 1, 'expense', 'Transporte', mp, 12000, 'SUBE'],
    [mes, 1, 'expense', 'Servicios', mp, 47800, 'Luz + internet'],
  ];
  for (const [mk, day, type, c, acc, amount, note] of rows)
    profile.transactions.push({ id: uid(), type, amount, accountId: acc.id, categoryId: cat(c, type), date: d(mk, day), note, createdAt: Date.now() });
};
