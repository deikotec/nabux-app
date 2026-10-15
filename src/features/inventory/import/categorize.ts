/**
 * Categorías: reconocer las que ya existen aunque vengan escritas distinto ("BEBIDAS", "bebida")
 * y colocar productos por palabras clave (las que propone la IA para cada categoría).
 *
 * Igual que en bdee-flow, la IA no lee todas las filas: propone las categorías y sus palabras
 * clave mirando una muestra, y esto coloca el resto gratis. Lo que no encaja se le pregunta a la
 * IA en lotes y, si tampoco, se queda sin categoría (visible y arreglable) en vez de forzarlo.
 */
import { normalize } from '@/lib/utils';

const STOPWORDS = new Set(['de', 'del', 'la', 'las', 'el', 'los', 'y', 'e', 'o', 'u', 'para', 'con', 'sin', 'en', 'por', 'al', 'a', 'x']);

function tokens(text: string): string[] {
  return normalize(text)
    .replace(/[^a-z0-9ñ]+/g, ' ')
    .split(' ')
    .filter((w) => w && !STOPWORDS.has(w));
}

/** "galletas" ~ "galleta", "jabones" ~ "jabon". */
function variants(word: string): string[] {
  const out = [word];
  if (word.length > 3 && word.endsWith('s')) out.push(word.slice(0, -1));
  if (word.length > 4 && word.endsWith('es')) out.push(word.slice(0, -2));
  return out;
}

/** Clave para comparar nombres de categoría: sin acentos, mayúsculas ni plurales. */
export function categoryKey(name: string): string {
  return tokens(name)
    .map((w) => variants(w).at(-1)!)
    .join(' ');
}

/** Nombre limpio para mostrar: espacios simples y primera letra en mayúscula. */
export function tidyCategory(name: string): string {
  const s = name.replace(/\s+/g, ' ').trim().slice(0, 40);
  if (!s) return '';
  // Si viene TODO EN MAYÚSCULAS se pasa a tipo oración ("BEBIDAS" → "Bebidas").
  const base = s === s.toUpperCase() && /[A-ZÁÉÍÓÚÑ]{3}/.test(s) ? s.toLowerCase() : s;
  return base.charAt(0).toUpperCase() + base.slice(1);
}

/** Índice clave → nombre de las categorías existentes. */
export function categoryIndex(categories: string[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const c of categories) {
    const k = categoryKey(c);
    if (k && !map.has(k)) map.set(k, c);
  }
  return map;
}

/** La categoría existente equivalente, o el texto limpio si es nueva. */
export function canonicalCategory(raw: string, index: Map<string, string>): string {
  const clean = tidyCategory(raw);
  if (!clean) return '';
  return index.get(categoryKey(clean)) ?? clean;
}

export interface CategoryRule {
  name: string;
  /** Palabras (sin acentos, en minúscula) que colocan un producto en esta categoría. */
  words: string[];
}

/**
 * Categoría por palabras clave: la que más palabras comparte con el nombre del producto.
 * Devuelve null si ninguna encaja (mejor sin categoría que mal clasificado).
 */
export function assignByWords(productName: string, rules: CategoryRule[]): string | null {
  const nameTokens = new Set(tokens(productName).flatMap(variants));
  const flat = ` ${tokens(productName).join(' ')} `;
  let best: { name: string; score: number } | null = null;
  for (const rule of rules) {
    let score = 0;
    for (const w of rule.words) {
      const parts = tokens(w);
      if (!parts.length) continue;
      const hit = parts.length > 1 ? flat.includes(` ${parts.join(' ')} `) : variants(parts[0]).some((v) => nameTokens.has(v));
      if (hit) score += parts.length > 1 ? 2 : 1;
    }
    if (score > 0 && (!best || score > best.score)) best = { name: rule.name, score };
  }
  return best?.name ?? null;
}

/** Palabras útiles de una categoría a partir de su propio nombre ("Snacks y Dulces" → snacks, dulces). */
export function wordsFromName(name: string): string[] {
  return tokens(name).filter((w) => w.length > 3);
}

/**
 * Hasta `max` nombres repartidos por todo el archivo, a paso fijo (nunca al azar: dos lecturas
 * del mismo archivo tienen que proponer lo mismo). Los primeros 300 de un catálogo ordenado por
 * familia serían todos de lo mismo.
 */
export function sampleNames(names: string[], max = 300): string[] {
  const unique = [...new Set(names.map((n) => n.replace(/\s+/g, ' ').trim().slice(0, 100)).filter(Boolean))];
  if (unique.length <= max) return unique;
  const step = unique.length / max;
  const out: string[] = [];
  for (let i = 0; out.length < max && Math.floor(i) < unique.length; i += step) out.push(unique[Math.floor(i)]);
  return out;
}
