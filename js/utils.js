// Funciones chicas que se usan en toda la app.

export const uid = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

// Escapa texto del usuario antes de meterlo en HTML (evita romper la página).
export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );

// Convierte lo que escribe el usuario ("1.234,56" o "1234.56") en número.
export function parseAmount(txt) {
  let s = String(txt ?? '').trim().replace(/\s/g, '').replace(/[^\d.,-]/g, '');
  if (!s) return NaN;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if ((s.match(/\./g) || []).length > 1) s = s.replace(/\./g, '');
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN;
}

const nf = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nf0 = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 });

export function money(amount, currency, { compact = false } = {}) {
  const sym = currency?.symbol ?? '$';
  const neg = amount < 0 ? '−' : '';
  const abs = Math.abs(amount);
  const num = compact && (abs >= 100000 || Number.isInteger(abs)) ? nf0.format(abs) : nf.format(abs);
  return `${neg}${sym} ${num}`;
}

// ---- Fechas (siempre como texto "AAAA-MM-DD" para evitar líos de zona horaria) ----
export const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
export const monthKey = (iso) => iso.slice(0, 7); // "2026-11"
export const currentMonth = () => todayISO().slice(0, 7);

export function addMonths(key, n) {
  let [y, m] = key.split('-').map(Number);
  m += n;
  while (m < 1) { m += 12; y--; }
  while (m > 12) { m -= 12; y++; }
  return `${y}-${String(m).padStart(2, '0')}`;
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

export function monthLabel(key) {
  const [y, m] = key.split('-').map(Number);
  const s = MESES[m - 1];
  return s[0].toUpperCase() + s.slice(1) + ' ' + y;
}

export function dayLabel(iso) {
  if (iso === todayISO()) return 'Hoy';
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const ayer = new Date(); ayer.setDate(ayer.getDate() - 1);
  if (dt.toDateString() === ayer.toDateString()) return 'Ayer';
  const s = `${DIAS[dt.getDay()]} ${d} de ${MESES[m - 1]}`;
  return s[0].toUpperCase() + s.slice(1);
}

// Variación porcentual entre dos montos. null = no hay base para comparar.
export function variation(curr, prev) {
  if (!prev) return curr ? { isNew: true } : null;
  return { pct: ((curr - prev) / prev) * 100 };
}

export const PALETTE = ['#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#64748b'];
