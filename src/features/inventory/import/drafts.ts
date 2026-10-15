/**
 * De la tabla del archivo a filas listas para guardar.
 *
 * `tableToDrafts` solo traduce columnas a campos (sin juzgar). `validateDrafts` decide qué pasa
 * con cada fila —producto nuevo, actualización de uno existente, omitida o con error— y se
 * vuelve a ejecutar con cada corrección del usuario, así que tiene que ser rápida y estable
 * (los SKU generados se guardan en `skuCache` para que no cambien en cada pasada).
 */
import { UNITS } from '@/config/app';
import { generateSku, normalize, round2 } from '@/lib/utils';
import type { InventorySettings, Product, ProductInput, Supplier } from '@/types';
import { ceilCents, grossFromNet, parseYesNo, type TaxCtx } from '../helpers';
import { canonicalCategory, categoryIndex, categoryKey } from './categorize';
import { NUMERIC_FIELDS } from './fields';
import { cellText, parseLocalNumber, parseNumber, parseWithReading } from './numbers';
import type { Cell, ColumnInfo, ColumnMapping, Draft, DraftValues, FieldKey, ImportOptions, ImportRow, ImportTable, RowStatus } from './types';

/* ------------------------------------------------------------------ */
/* Unidades                                                            */
/* ------------------------------------------------------------------ */

const keyOf = (h: string) => normalize(h).replace(/[^a-z0-9]/g, '');

const UNIT_ALIASES: Record<string, string> = {
  u: 'Unidad',
  un: 'Unidad',
  und: 'Unidad',
  unid: 'Unidad',
  ud: 'Unidad',
  uds: 'Unidad',
  unidades: 'Unidad',
  pza: 'Pieza',
  pz: 'Pieza',
  pzas: 'Pieza',
  piezas: 'Pieza',
  kg: 'Kg',
  kgs: 'Kg',
  kilo: 'Kg',
  kilos: 'Kg',
  kilogramo: 'Kg',
  kilogramos: 'Kg',
  g: 'Gramo',
  gr: 'Gramo',
  grs: 'Gramo',
  gramos: 'Gramo',
  l: 'Litro',
  lt: 'Litro',
  lts: 'Litro',
  litros: 'Litro',
  ml: 'Mililitro',
  mililitros: 'Mililitro',
  m: 'Metro',
  mt: 'Metro',
  mts: 'Metro',
  metros: 'Metro',
  paq: 'Paquete',
  pqt: 'Paquete',
  pack: 'Paquete',
  paquetes: 'Paquete',
  cja: 'Caja',
  cj: 'Caja',
  cajas: 'Caja',
  bulto: 'Caja',
  dz: 'Docena',
  docenas: 'Docena',
  pares: 'Par',
  servicios: 'Servicio'
};

export function resolveUnit(raw: string): string {
  const k = keyOf(raw);
  if (!k) return 'Unidad';
  const exact = UNITS.find((u) => keyOf(u) === k);
  return exact ?? UNIT_ALIASES[k] ?? raw.trim().slice(0, 20);
}

/* ------------------------------------------------------------------ */
/* Tabla → borradores                                                  */
/* ------------------------------------------------------------------ */

/** Traduce cada fila de la tabla a valores por campo, sin validar. Los números se leen con la convención de su columna. */
export function tableToDrafts(table: ImportTable, mapping: ColumnMapping[], infos: ColumnInfo[]): Draft[] {
  const cols = mapping.map((m, i) => ({ ...m, index: i, reading: infos[i]?.reading ?? null })).filter((m) => m.target !== 'ignorar');
  return table.rows.map((row) => {
    const values: DraftValues = {};
    for (const col of cols) {
      const field = col.target as FieldKey;
      const raw = row.cells[col.index];
      const text = cellText(raw);
      if (text === '') continue;
      if (NUMERIC_FIELDS.has(field)) {
        const n = parseWithReading(raw, col.reading, field === 'precio_bs');
        values[field] = n === null || Number.isNaN(n) ? text : n;
      } else if (field === 'exento' && col.rateLike) {
        // Columna "IVA": 0 (o "E") = exento; 16 (o "G") = gravado.
        const n = parseNumber(raw);
        values.exento = n !== null && !Number.isNaN(n) ? (n === 0 ? 'si' : 'no') : text;
      } else {
        values[field] = text;
      }
    }
    return {
      id: `L${table.sheet ? `${table.sheet}:` : ''}${row.line}`,
      origin: `Fila ${row.line}`,
      values,
      image: table.images.get(row.line) ?? null
    };
  });
}

/* ------------------------------------------------------------------ */
/* Validación                                                          */
/* ------------------------------------------------------------------ */

export interface ValidateContext {
  products: Product[];
  suppliers: Supplier[];
  categories: string[];
  settings: InventorySettings;
  /** Modo bimonetario: acepta precio en Bs. */
  dual: boolean;
  /** Tasa vigente (Bs por $) para convertir precios en Bs; null si no hay. */
  rate: number | null;
  tax: TaxCtx | null;
  money: (usd: number) => string;
  formatLocal: (bs: number) => string;
  /** "BCV (oficial) · 36,52 Bs/$". */
  rateText: string;
  /** SKU generado por borrador (estable entre validaciones). */
  skuCache: Map<string, string>;
}

const text = (v: Cell | undefined) => cellText(v);

/** Número de un valor: los de Excel ya vienen como número; los escritos a mano se leen con tolerancia. */
function num(v: Cell | undefined, local = false): number | null {
  if (v === undefined || v === '') return null;
  return local ? parseLocalNumber(v) : parseNumber(v);
}

export interface ValidationResult {
  rows: ImportRow[];
  counts: Record<RowStatus, number>;
  /** Filas cuyo precio en $ se calculó desde el precio en Bs con la tasa actual. */
  converted: number;
  /** Filas sin precio de venta pero con costo (se les puede calcular el precio con un margen). */
  missingPriceWithCost: number;
  /** Hay filas que coinciden con productos existentes. */
  matches: number;
  /** Categorías resultantes (nombre → productos), marcando las nuevas. */
  categories: { name: string; count: number; isNew: boolean; fromAi: number }[];
}

export function effectiveValues(draft: Draft, edits: Record<string, DraftValues>): DraftValues {
  const e = edits[draft.id];
  return e ? { ...draft.values, ...e } : draft.values;
}

export function validateDrafts(
  drafts: Draft[],
  edits: Record<string, DraftValues>,
  excluded: ReadonlySet<string>,
  ctx: ValidateContext,
  opts: ImportOptions
): ValidationResult {
  const counts: Record<RowStatus, number> = { new: 0, update: 0, skip: 0, error: 0 };

  // Índices del catálogo actual.
  const bySku = new Map<string, Product>();
  const byCode = new Map<string, Product>();
  const byName = new Map<string, Product>();
  for (const p of ctx.products) {
    if (p.sku) bySku.set(p.sku.trim().toUpperCase(), p);
    if (p.barcode) byCode.set(normalize(p.barcode), p);
    const nk = normalize(p.name);
    if (nk && !byName.has(nk)) byName.set(nk, p);
  }
  const suppliersByName = new Map(ctx.suppliers.map((s) => [normalize(s.name), s]));
  const catIndex = categoryIndex(ctx.categories);
  const renames = new Map(Object.entries(opts.renames));
  const seenSkus = new Set<string>();
  const seenCodes = new Set<string>();
  const usedExisting = new Set<string>();
  const catCounts = new Map<string, { count: number; fromAi: number }>();
  let converted = 0;
  let missingPriceWithCost = 0;
  let matches = 0;

  const resolveCategory = (raw: string) => {
    const canonical = canonicalCategory(raw, catIndex);
    if (!canonical) return '';
    const renamed = renames.get(categoryKey(canonical));
    return renamed ? canonicalCategory(renamed, catIndex) : canonical;
  };

  const rows: ImportRow[] = drafts.map((draft) => {
    const values = effectiveValues(draft, edits);
    const problems: string[] = [];
    const notes: string[] = [];
    const get = (f: FieldKey) => text(values[f]);

    const name = get('nombre').replace(/\s+/g, ' ').slice(0, 160);
    const rawSku = get('sku').toUpperCase().slice(0, 60);
    const barcode = get('codigo_barras').replace(/\s+/g, '').slice(0, 60);

    // ¿Ya existe? Por SKU, por código de barras y, si la fila no trae ninguno de los dos, por nombre.
    let existing: Product | undefined;
    let matchedBy = '';
    if (rawSku && bySku.has(rawSku)) {
      existing = bySku.get(rawSku);
      matchedBy = `SKU ${rawSku}`;
    } else if (barcode && byCode.has(normalize(barcode))) {
      existing = byCode.get(normalize(barcode));
      matchedBy = 'código de barras';
    } else if (!rawSku && !barcode && name && byName.has(normalize(name))) {
      existing = byName.get(normalize(name));
      matchedBy = 'nombre';
    }
    if (existing && usedExisting.has(existing.id)) {
      problems.push(`Otra fila del archivo ya corresponde a "${existing.name}"`);
    }
    if (existing) {
      usedExisting.add(existing.id);
      matches++;
    }

    // Categoría: la del archivo (o la corregida); si no hay, la propuesta por la IA.
    const fileCategory = resolveCategory(get('categoria'));
    const aiCategory = !fileCategory && opts.useAiCategories && draft.aiCategory ? resolveCategory(draft.aiCategory) : '';
    let category = fileCategory || aiCategory;
    let categorySource: ImportRow['categorySource'] = fileCategory ? 'file' : aiCategory ? 'ai' : 'default';

    // Números.
    const exempt = values.exento === undefined ? null : parseYesNo(get('exento'));
    if (exempt === undefined) problems.push(`Valor de "exento" no reconocido ("${get('exento')}"): usa si o no`);

    const cost = num(values.costo);
    if (cost !== null && (Number.isNaN(cost) || cost < 0)) problems.push(`Costo inválido ("${get('costo')}")`);
    const validCost = cost !== null && !Number.isNaN(cost) && cost >= 0 ? round2(cost) : null;

    let price = num(values.precio);
    let fromLocal: number | undefined;
    let autoPriced = false;
    if (price !== null && (Number.isNaN(price) || price <= 0)) {
      problems.push(price === 0 ? 'Precio en 0: corrígelo o quita la fila' : `Precio inválido ("${get('precio')}")`);
      price = null;
    }
    if (price === null && values.precio === undefined && values.precio_bs !== undefined && ctx.dual) {
      const bs = num(values.precio_bs, true);
      if (bs === null || Number.isNaN(bs) || bs <= 0) problems.push(`Precio en Bs inválido ("${get('precio_bs')}")`);
      else if (!ctx.rate) problems.push('Sin tasa de cambio: no se puede convertir el precio en Bs a $');
      else {
        const usd = round2(bs / ctx.rate);
        if (usd <= 0) problems.push(`Precio en Bs demasiado bajo ("${get('precio_bs')}")`);
        else {
          price = usd;
          fromLocal = bs;
          converted++;
          notes.push(`Precio convertido: ${ctx.formatLocal(bs)} → ${ctx.money(usd)} (${ctx.rateText})`);
        }
      }
    }
    if (price === null && values.precio === undefined && values.precio_bs === undefined && validCost && validCost > 0) {
      if (!existing) missingPriceWithCost++;
      if (opts.autoPriceMargin !== null && opts.autoPriceMargin < 100 && !existing) {
        price = ceilCents(grossFromNet(validCost / (1 - opts.autoPriceMargin / 100), exempt === true, ctx.tax));
        autoPriced = true;
        notes.push(`Precio calculado con margen de ${opts.autoPriceMargin}%: ${ctx.money(price)}`);
      }
    }

    const stock = num(values.stock);
    if (stock !== null && Number.isNaN(stock)) problems.push(`Stock inválido ("${get('stock')}")`);
    else if (stock !== null && stock < 0) problems.push('El stock no puede ser negativo');
    const validStock = stock !== null && !Number.isNaN(stock) && stock >= 0 ? stock : null;

    const minStock = num(values.stock_minimo);
    if (minStock !== null && (Number.isNaN(minStock) || minStock < 0)) problems.push(`Stock mínimo inválido ("${get('stock_minimo')}")`);
    const validMin = minStock !== null && !Number.isNaN(minStock) && minStock >= 0 ? minStock : null;

    // Código de barras: no puede repetirse en el archivo ni pertenecer a OTRO producto.
    if (barcode) {
      const code = normalize(barcode);
      const owner = byCode.get(code) ?? bySku.get(barcode.toUpperCase());
      if (owner && owner.id !== existing?.id) problems.push(`Código de barras ya usado por "${owner.name}"`);
      else if (seenCodes.has(code)) problems.push('Código de barras repetido en el archivo');
      seenCodes.add(code);
    }

    // SKU: se genera si falta (y se recuerda); repetido en el archivo es error.
    let sku = rawSku;
    if (!sku && !existing) {
      sku = ctx.skuCache.get(draft.id) ?? '';
      if (!sku || bySku.has(sku) || seenSkus.has(sku)) {
        for (let t = 0; t < 25; t++) {
          const candidate = generateSku(ctx.settings.skuPrefix, category).toUpperCase();
          if (!bySku.has(candidate) && !seenSkus.has(candidate)) {
            sku = candidate;
            break;
          }
        }
        ctx.skuCache.set(draft.id, sku);
      }
      notes.push(`SKU generado: ${sku}`);
    } else if (sku && seenSkus.has(sku)) {
      problems.push(`SKU ${sku} repetido en el archivo`);
    }
    if (sku) seenSkus.add(sku);

    // Proveedor por nombre.
    const rawSupplier = get('proveedor');
    const supplier = rawSupplier ? suppliersByName.get(normalize(rawSupplier)) : undefined;

    const imageUrl = get('imagen');
    if (imageUrl && !/^https?:\/\/\S+$/i.test(imageUrl)) problems.push('El enlace de la foto no es válido (debe empezar con http)');
    const hasImage = !!draft.image || (!!imageUrl && /^https?:\/\//i.test(imageUrl));

    let status: RowStatus;
    let input: ProductInput;
    let patch: Partial<ProductInput> | undefined;
    const changes: string[] = [];
    let stockDelta: number | undefined;

    if (existing) {
      // Actualización: solo cambia lo que trae el archivo. La categoría propuesta por la IA no
      // pisa la de un producto que ya existe.
      if (categorySource !== 'file') {
        category = existing.category;
        categorySource = 'keep';
      }
      const p: Partial<ProductInput> = {};
      patch = p;
      const set = <K extends keyof ProductInput>(key: K, value: ProductInput[K] | undefined, label: string) => {
        if (value === undefined || value === null || value === '') return;
        const before = existing[key as keyof Product] ?? (typeof value === 'string' ? '' : undefined);
        if (before === value) return;
        p[key] = value;
        changes.push(label);
      };
      set('name', name || undefined, 'nombre');
      if (barcode && !existing.barcode) set('barcode', barcode, 'código de barras');
      if (categorySource === 'file') set('category', category, 'categoría');
      set('brand', get('marca').slice(0, 60) || undefined, 'marca');
      if (values.unidad !== undefined) set('unit', resolveUnit(get('unidad')), 'unidad');
      if (validCost !== null) set('costPrice', validCost, 'costo');
      if (price !== null) set('salePrice', round2(price), 'precio');
      if (validMin !== null) set('minStock', validMin, 'stock mínimo');
      set('location', get('ubicacion').slice(0, 60) || undefined, 'ubicación');
      if (rawSupplier) {
        const nextId = supplier?.id ?? null;
        const nextName = supplier?.name ?? rawSupplier;
        if ((existing.supplierId ?? null) !== nextId || (existing.supplierName ?? '') !== nextName) {
          p.supplierId = nextId;
          p.supplierName = nextName;
          changes.push('proveedor');
        }
      }
      if (exempt === true || exempt === false) set('taxExempt', exempt !== !!existing.taxExempt ? exempt : undefined, exempt ? 'exento' : 'gravado');
      if (hasImage) changes.push(existing.imageUrl ? 'foto (reemplaza)' : 'foto');
      if (validStock !== null && opts.stockMode !== 'keep') {
        const current = Number(existing.stock) || 0;
        const delta = opts.stockMode === 'add' ? validStock : validStock - current;
        if (delta !== 0) {
          stockDelta = delta;
          changes.push(opts.stockMode === 'add' ? `stock +${delta}` : `stock ${current} → ${validStock}`);
        }
      }
      const uniqueChanges = [...new Set(changes)];
      changes.length = 0;
      changes.push(...uniqueChanges);

      // Si se omiten los existentes, la fila muestra el producto tal como está (sin los cambios del archivo).
      const applied: Partial<ProductInput> = opts.existing === 'update' ? p : {};
      if (opts.existing !== 'update') {
        stockDelta = undefined;
        category = existing.category;
      }
      input = {
        name: applied.name ?? existing.name,
        sku: existing.sku,
        barcode: applied.barcode ?? existing.barcode ?? '',
        category: applied.category ?? existing.category,
        brand: applied.brand ?? existing.brand ?? '',
        unit: applied.unit ?? existing.unit,
        costPrice: applied.costPrice ?? existing.costPrice,
        salePrice: applied.salePrice ?? existing.salePrice,
        stock: (Number(existing.stock) || 0) + (stockDelta ?? 0),
        minStock: applied.minStock ?? existing.minStock,
        location: applied.location ?? existing.location ?? '',
        supplierId: applied.supplierId !== undefined ? applied.supplierId : (existing.supplierId ?? null),
        supplierName: applied.supplierName !== undefined ? applied.supplierName : (existing.supplierName ?? null),
        active: existing.active !== false,
        taxExempt: applied.taxExempt ?? !!existing.taxExempt,
        imageUrl: existing.imageUrl ?? null,
        imagePath: existing.imagePath ?? null
      };

      if (problems.length) status = 'error';
      else if (opts.existing === 'skip') {
        status = 'skip';
        problems.push(`Ya existe "${existing.name}" (coincide por ${matchedBy}): se omite`);
      } else if (!changes.length) {
        status = 'skip';
        problems.push(`"${existing.name}" ya está al día: sin cambios`);
      } else {
        status = 'update';
        notes.unshift(`Coincide con "${existing.name}" por ${matchedBy}`);
      }
    } else {
      if (!name) problems.push('Falta el nombre');
      if (price === null && !problems.some((p) => p.startsWith('Precio'))) {
        problems.push(validCost && validCost > 0 ? 'Falta el precio de venta (puedes calcularlo desde el costo)' : 'Falta el precio de venta');
      }
      if (!category) {
        category = 'General';
        categorySource = 'default';
      }
      if (rawSupplier && !supplier) notes.push(`Proveedor "${rawSupplier}" no registrado: se guardará solo el nombre`);
      input = {
        name,
        sku,
        barcode,
        category,
        brand: get('marca').slice(0, 60),
        unit: resolveUnit(get('unidad')),
        costPrice: validCost ?? 0,
        salePrice: price !== null ? round2(price) : 0,
        stock: validStock ?? 0,
        minStock: validMin ?? ctx.settings.lowStockDefault,
        location: get('ubicacion').slice(0, 60),
        supplierId: supplier?.id ?? null,
        supplierName: supplier?.name ?? (rawSupplier || null),
        active: true,
        taxExempt: exempt === true,
        imageUrl: null,
        imagePath: null
      };
      status = problems.length ? 'error' : 'new';
    }

    if (excluded.has(draft.id)) {
      status = 'skip';
      problems.unshift('Quitado de la importación');
    }
    if ((status === 'new' || status === 'update') && categorySource !== 'keep' && input.category) {
      const c = catCounts.get(input.category) ?? { count: 0, fromAi: 0 };
      c.count++;
      if (categorySource === 'ai') c.fromAi++;
      catCounts.set(input.category, c);
    }
    counts[status]++;
    return { draft, values, status, problems, notes, input, existing, patch, changes, stockDelta, fromLocal, autoPriced, categorySource };
  });

  const known = new Set(ctx.categories.map((c) => categoryKey(c)));
  const categories = [...catCounts.entries()]
    .map(([name, c]) => ({ name, count: c.count, fromAi: c.fromAi, isNew: !known.has(categoryKey(name)) }))
    .sort((a, b) => Number(b.isNew) - Number(a.isNew) || b.count - a.count || a.name.localeCompare(b.name, 'es'));

  return { rows, counts, converted, missingPriceWithCost, matches, categories };
}
