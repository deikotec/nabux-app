import type { Product } from '@/types';

type ClassValue = string | number | false | null | undefined | ClassValue[] | Record<string, boolean | null | undefined>;

/** Une clases condicionales: cn('a', cond && 'b', { c: true }) */
export function cn(...inputs: ClassValue[]): string {
  const out: string[] = [];
  const walk = (v: ClassValue) => {
    if (!v) return;
    if (typeof v === 'string' || typeof v === 'number') out.push(String(v));
    else if (Array.isArray(v)) v.forEach(walk);
    else for (const [k, on] of Object.entries(v)) if (on) out.push(k);
  };
  inputs.forEach(walk);
  return out.join(' ');
}

export function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/** Normaliza texto para búsquedas: minúsculas y sin acentos. */
export function normalize(text: string | null | undefined): string {
  return (text ?? '')
    .toString()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

export function buildSearchText(p: Pick<Product, 'name' | 'sku' | 'barcode' | 'brand' | 'category'>): string {
  return normalize([p.name, p.sku, p.barcode, p.brand, p.category].filter(Boolean).join(' '));
}

/** Coincidencia de producto con una consulta libre (nombre, SKU, código de barras, marca). */
export function productMatches(p: Product, query: string): boolean {
  const q = normalize(query);
  if (!q) return true;
  const haystack = p.searchText || buildSearchText(p);
  return q.split(/\s+/).every((token) => haystack.includes(token));
}

export type StockStatus = 'ok' | 'low' | 'out';

export function stockStatus(p: Pick<Product, 'stock' | 'minStock'>): StockStatus {
  const stock = Number(p.stock) || 0;
  if (stock <= 0) return 'out';
  if (stock <= (Number(p.minStock) || 0)) return 'low';
  return 'ok';
}

export const STOCK_STATUS_LABEL: Record<StockStatus, string> = {
  ok: 'Óptimo',
  low: 'Bajo stock',
  out: 'Agotado'
};

/** Margen bruto sobre precio de venta, en %. */
export function marginPct(cost: number, price: number): number {
  if (!price) return 0;
  return ((price - cost) / price) * 100;
}

export function randomDigits(n: number): string {
  let s = '';
  for (let i = 0; i < n; i++) s += Math.floor(Math.random() * 10);
  return s;
}

/** Genera un EAN-13 válido (prefijo 2 = uso interno de tienda). */
export function generateEan13(): string {
  const base = '2' + randomDigits(11);
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(base[i]) * (i % 2 === 0 ? 1 : 3);
  const check = (10 - (sum % 10)) % 10;
  return base + check;
}

export function generateSku(prefix: string, category?: string): string {
  const cat = normalize(category).replace(/[^a-z0-9]/g, '').slice(0, 3).toUpperCase();
  return [prefix || 'PRD', cat || null, randomDigits(5)].filter(Boolean).join('-');
}

export function downloadFile(filename: string, content: string, mime = 'text/csv;charset=utf-8') {
  const blob = new Blob(['﻿' + content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function toCsv(rows: (string | number | null | undefined)[][]): string {
  return rows
    .map((r) =>
      r
        .map((cell) => {
          const s = cell === null || cell === undefined ? '' : String(cell);
          return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(',')
    )
    .join('\n');
}

/** Parser CSV sencillo (soporta comillas, comas y ; como separador). */
export function parseCsv(text: string): string[][] {
  const clean = text.replace(/^﻿/, '');
  const firstLine = clean.split(/\r?\n/)[0] ?? '';
  const sep = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (inQuotes) {
      if (ch === '"') {
        if (clean[i + 1] === '"') {
          cell += '"';
          i++;
        } else inQuotes = false;
      } else cell += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === sep) {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && clean[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

/** Pitido corto para confirmar escaneos en el POS. */
export function beep(frequency = 1046, durationMs = 70) {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = frequency;
    gain.gain.value = 0.04;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + durationMs / 1000);
    osc.onended = () => ctx.close();
  } catch {
    /* sin audio disponible */
  }
}

export function errorMessage(err: unknown): string {
  const code = (err as { code?: string })?.code ?? '';
  const map: Record<string, string> = {
    'permission-denied': 'No tienes permiso para realizar esta acción.',
    unavailable: 'Sin conexión con el servidor. Intenta de nuevo.',
    'auth/invalid-credential': 'Correo o contraseña incorrectos.',
    'auth/wrong-password': 'Correo o contraseña incorrectos.',
    'auth/user-not-found': 'No existe una cuenta con ese correo.',
    'auth/email-already-in-use': 'Ya existe una cuenta con ese correo. Inicia sesión.',
    'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres.',
    'auth/invalid-email': 'El correo no es válido.',
    'auth/too-many-requests': 'Demasiados intentos. Espera un momento e intenta de nuevo.',
    'auth/popup-closed-by-user': 'Se cerró la ventana de Google antes de terminar.',
    'auth/network-request-failed': 'Error de red. Revisa tu conexión.',
    'auth/requires-recent-login': 'Por seguridad, vuelve a iniciar sesión e inténtalo de nuevo.',
    'storage/unauthorized': 'No tienes permiso para subir este archivo.',
    'storage/canceled': 'La subida fue cancelada.'
  };
  if (map[code]) return map[code];
  if (err instanceof Error && err.message && !err.message.startsWith('Firebase')) return err.message;
  return 'Ocurrió un error inesperado. Intenta de nuevo.';
}
