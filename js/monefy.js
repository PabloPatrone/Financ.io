// Importador del CSV que exporta Monefy.
// Columnas: date, account, category, amount, currency, converted amount, currency, description
// Los montos negativos son gastos y los positivos, ingresos.

import { uid, PALETTE } from './utils.js';

// Lee un CSV respetando comillas ("1,020" es un solo campo).
export function parseCSV(text) {
  const rows = [];
  let row = [], field = '', q = false;
  text = text.replace(/^﻿/, '');
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') q = false;
      else field += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((c) => c !== '')) rows.push(row);
      row = [];
    } else field += ch;
  }
  row.push(field);
  if (row.some((c) => c !== '')) rows.push(row);
  return rows;
}

// "1,020" / "-1,020.50" / "1.020,50" → número
export function parseMonefyAmount(s) {
  s = String(s).trim().replace(/\s/g, '');
  const lastComma = s.lastIndexOf(','), lastDot = s.lastIndexOf('.');
  if (lastComma >= 0 && lastDot >= 0) {
    s = lastComma > lastDot ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else if (lastComma >= 0) {
    s = /^-?\d{1,3}(,\d{3})+$/.test(s) ? s.replace(/,/g, '') : s.replace(',', '.');
  } else if (lastDot >= 0 && /^-?\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, '');
  }
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN;
}

// Detecta si las fechas vienen como día/mes o mes/día.
function dateParser(values) {
  let dayFirst = true;
  for (const v of values) {
    const m = v.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
    if (!m) continue;
    if (+m[1] > 12) { dayFirst = true; break; }
    if (+m[2] > 12) { dayFirst = false; break; }
  }
  return (v) => {
    v = v.trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
    const m = v.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
    if (!m) return null;
    const [d, mo] = dayFirst ? [m[1], m[2]] : [m[2], m[1]];
    return `${m[3]}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  };
}

// Íconos para las categorías típicas de Monefy (en español y en inglés).
const ICONOS = {
  salario: '💼', salary: '💼', depósitos: '🏦', depositos: '🏦', deposits: '🏦', ahorros: '🐷', savings: '🐷',
  comida: '🍔', food: '🍔', restaurante: '🍽️', 'eating out': '🍽️', cafe: '☕', entretenimiento: '🎬', entertainment: '🎬',
  casa: '🏠', house: '🏠', automóvil: '🚗', automovil: '🚗', car: '🚗', deportes: '⚽', sports: '⚽', ropa: '👕', clothes: '👕',
  facturas: '🧾', bills: '🧾', regalos: '🎁', gifts: '🎁', comunicaciones: '📱', communications: '📱', higiene: '🧴', toiletry: '🧴',
  salud: '💊', health: '💊', taxi: '🚕', transporte: '🚌', transport: '🚌', mascotas: '🐾', pets: '🐾',
};
const norm = (s) => s.trim().toLowerCase();

// Arma un resumen de lo que se va a importar, sin tocar nada todavía.
export function analyze(text, profile, currencies) {
  const rows = parseCSV(text);
  if (!rows.length) throw new Error('El archivo está vacío.');
  const head = rows[0].map(norm);
  if (head[0] !== 'date' || !head.includes('category') || !head.includes('amount'))
    throw new Error('No parece un CSV exportado de Monefy (falta la fila de títulos "date, account, category, amount...").');
  const iAcc = head.indexOf('account'), iCat = head.indexOf('category'), iAmt = head.indexOf('amount');
  const iCur = head.indexOf('currency'), iDesc = head.indexOf('description');
  const body = rows.slice(1);
  const toISO = dateParser(body.map((r) => r[0]));

  const items = [], errores = [];
  body.forEach((r, i) => {
    const date = toISO(r[0] || '');
    const amount = parseMonefyAmount(r[iAmt]);
    if (!date || !Number.isFinite(amount) || amount === 0) { errores.push(i + 2); return; }
    items.push({
      date,
      account: (r[iAcc] || 'Efectivo').trim(),
      category: (r[iCat] || 'Otros').trim(),
      type: amount < 0 ? 'expense' : 'income',
      amount: Math.abs(amount),
      currency: (r[iCur] || 'ARS').trim().toUpperCase(),
      note: (iDesc >= 0 ? r[iDesc] || '' : '').trim(),
    });
  });
  if (!items.length) throw new Error('No encontré movimientos válidos en el archivo.');

  // Qué cuentas, categorías y monedas faltan crear.
  const accNames = new Set(profile.accounts.map((a) => norm(a.name)));
  const nuevasCuentas = new Map();
  const catKeys = new Set(profile.categories.map((c) => c.type + '|' + norm(c.name)));
  const nuevasCats = new Map();
  const curCodes = new Set(currencies.map((c) => c.code));
  const nuevasMonedas = new Set();
  const usadas = new Set();
  for (const it of items) {
    if (!accNames.has(norm(it.account)) && !nuevasCuentas.has(norm(it.account))) nuevasCuentas.set(norm(it.account), { name: it.account, currency: it.currency });
    const k = it.type + '|' + norm(it.category);
    usadas.add(k);
    if (!catKeys.has(k) && !nuevasCats.has(k)) nuevasCats.set(k, { name: it.category, type: it.type });
    if (!curCodes.has(it.currency)) nuevasMonedas.add(it.currency);
  }

  // Evita duplicar si importás el mismo archivo dos veces.
  const firma = (date, acc, type, amount, cat, note) => [date, norm(acc), type, amount, norm(cat), norm(note)].join('|');
  const existentes = new Map();
  for (const t of profile.transactions) {
    if (t.type === 'transfer') continue;
    const acc = profile.accounts.find((a) => a.id === t.accountId)?.name || '';
    const cat = profile.categories.find((c) => c.id === t.categoryId)?.name || '';
    const f = firma(t.date, acc, t.type, t.amount, cat, t.note || '');
    existentes.set(f, (existentes.get(f) || 0) + 1);
  }
  const aImportar = [];
  let repetidos = 0;
  for (const it of items) {
    const f = firma(it.date, it.account, it.type, it.amount, it.category, it.note);
    const n = existentes.get(f) || 0;
    if (n > 0) { existentes.set(f, n - 1); repetidos++; } else aImportar.push(it);
  }

  const fechas = items.map((i) => i.date).sort();
  const sinUso = profile.categories.filter(
    (c) => !usadas.has(c.type + '|' + norm(c.name)) && !profile.transactions.some((t) => t.categoryId === c.id)
  );
  return {
    items: aImportar, total: items.length, repetidos, errores,
    desde: fechas[0], hasta: fechas[fechas.length - 1],
    ingresos: items.filter((i) => i.type === 'income').length,
    gastos: items.filter((i) => i.type === 'expense').length,
    nuevasCuentas: [...nuevasCuentas.values()], nuevasCats: [...nuevasCats.values()], nuevasMonedas: [...nuevasMonedas],
    sinUso,
  };
}

// Aplica la importación sobre el perfil.
export function apply(plan, profile, state, { borrarSinUso = false } = {}) {
  for (const code of plan.nuevasMonedas) state.currencies.push({ code, symbol: code, name: code });
  for (const a of plan.nuevasCuentas) profile.accounts.push({ id: uid(), name: a.name, currency: a.currency, initial: 0, emoji: '💳' });
  let ci = 0;
  for (const c of plan.nuevasCats) {
    profile.categories.push({
      id: uid(), type: c.type, name: c.name,
      emoji: ICONOS[norm(c.name)] || (c.type === 'income' ? '💰' : '🏷️'),
      color: PALETTE[(ci++ * 5) % PALETTE.length],
    });
  }
  if (borrarSinUso) {
    for (const type of ['expense', 'income']) {
      const ids = new Set(plan.sinUso.filter((c) => c.type === type).map((c) => c.id));
      const quedan = profile.categories.filter((c) => c.type === type && !ids.has(c.id));
      if (quedan.length) profile.categories = profile.categories.filter((c) => !ids.has(c.id));
    }
  }
  const acc = new Map(profile.accounts.map((a) => [norm(a.name), a.id]));
  const cat = new Map(profile.categories.map((c) => [c.type + '|' + norm(c.name), c.id]));
  const now = Date.now();
  plan.items.forEach((it, i) => {
    profile.transactions.push({
      id: uid() + i.toString(36), type: it.type, amount: it.amount,
      accountId: acc.get(norm(it.account)), categoryId: cat.get(it.type + '|' + norm(it.category)),
      date: it.date, note: it.note, createdAt: now + i,
    });
  });
  return plan.items.length;
}
